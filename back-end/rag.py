import os
import sqlite3
import json
from typing import List, Dict, Any

try:
    from sentence_transformers import SentenceTransformer
    import faiss
    import numpy as np
except Exception:
    # If these imports fail, the module will raise at runtime when used.
    SentenceTransformer = None
    faiss = None
    np = None

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DB_PATH = os.path.join(DATA_DIR, "metadata.db")
INDEX_PATH = os.path.join(DATA_DIR, "faiss.index")


def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def get_conn():
    ensure_data_dir()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Sets up the new parent/child chunk schema.
    parent_chunks: coarse-grained ~2000-char blocks (keeps page ranges)
    child_chunks: fine-grained ~400-char snippets that are embedded and indexed
    """
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS papers (
            id INTEGER PRIMARY KEY,
            filename TEXT,
            filehash TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    # parent chunks (coarse)
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS parent_chunks (
            id INTEGER PRIMARY KEY,
            paper_id INTEGER,
            start_page INTEGER,
            end_page INTEGER,
            text TEXT
        )
        """
    )
    # child chunks (fine-grained) reference a parent chunk
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS child_chunks (
            id INTEGER PRIMARY KEY,
            parent_id INTEGER,
            start_page INTEGER,
            end_page INTEGER,
            text TEXT
        )
        """
    )
    c.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_child_parent ON child_chunks (parent_id)
        """
    )
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS analyses (
            id INTEGER PRIMARY KEY,
            paper_id INTEGER,
            prompt_id TEXT,
            model_output TEXT,
            parsed_json TEXT,
            retrieved_chunk_ids TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    conn.close()


def chunk_pdf_parents(file_path: str, parent_max_chars: int = 2000) -> List[Dict[str, Any]]:
    """Read the PDF and create coarse parent chunks (~parent_max_chars) by grouping consecutive pages.
    Each parent includes start_page, end_page and the combined text.
    """
    import fitz

    doc = fitz.open(file_path)
    parents: List[Dict[str, Any]] = []
    total = len(doc)

    cur_text_parts = []
    cur_start = 0
    cur_len = 0

    for p in range(total):
        page_text = doc[p].get_text()
        if not page_text:
            continue
        # if adding this page would exceed max and we already have content, flush current parent
        if cur_len + len(page_text) > parent_max_chars and cur_text_parts:
            parents.append({
                "start_page": cur_start + 1,
                "end_page": p,
                "text": "\n".join(cur_text_parts).strip(),
            })
            # reset
            cur_text_parts = [page_text]
            cur_start = p
            cur_len = len(page_text)
        else:
            if not cur_text_parts:
                cur_start = p
            cur_text_parts.append(page_text)
            cur_len += len(page_text)

    # flush remainder
    if cur_text_parts:
        parents.append({
            "start_page": cur_start + 1,
            "end_page": total,
            "text": "\n".join(cur_text_parts).strip(),
        })

    return parents


# Optional import for RecursiveCharacterTextSplitter (langchain). If unavailable fall back to a simple recursive splitter.
try:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
except Exception:
    RecursiveCharacterTextSplitter = None


def split_parent_into_children(parent_text: str, child_size: int = 400, overlap: int = 50) -> List[str]:
    """Split a parent text into child snippets. Prefer using RecursiveCharacterTextSplitter when available.
    Returns list of child strings.
    """
    if RecursiveCharacterTextSplitter is not None:
        splitter = RecursiveCharacterTextSplitter(chunk_size=child_size, chunk_overlap=overlap)
        return splitter.split_text(parent_text)

    # Fallback simple recursive splitter: try to split on double newlines, then newline, then spaces
    parts: List[str] = []

    def _split_text(s: str):
        if len(s) <= child_size:
            parts.append(s.strip())
            return
        # try double newline
        idx = s.rfind("\n\n", 0, child_size)
        if idx != -1 and idx > int(child_size * 0.5):
            first = s[:idx]
            rest = s[idx:]
        else:
            idx = s.rfind("\n", 0, child_size)
            if idx != -1 and idx > int(child_size * 0.5):
                first = s[:idx]
                rest = s[idx:]
            else:
                idx = s.rfind(" ", 0, child_size)
                if idx != -1 and idx > int(child_size * 0.5):
                    first = s[:idx]
                    rest = s[idx:]
                else:
                    first = s[:child_size]
                    rest = s[child_size:]
        parts.append(first.strip())
        _split_text(rest)

    _split_text(parent_text)
    return parts


def _load_or_create_index(d: int):
    ensure_data_dir()
    if faiss is None:
        raise RuntimeError("faiss is not installed")
    if os.path.exists(INDEX_PATH):
        index = faiss.read_index(INDEX_PATH)
        return index
    # create new IndexIDMap on top of IndexFlatL2
    quant = faiss.IndexFlatL2(d)
    index = faiss.IndexIDMap(quant)
    return index


_embed_model = None

def _ensure_embed_model():
    global _embed_model
    if _embed_model is None:
        if SentenceTransformer is None:
            raise RuntimeError("sentence-transformers not installed")
        _embed_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embed_model


def add_paper_and_index(file_path: str, filename: str, parent_max_chars: int = 2000, child_size: int = 400, child_overlap: int = 50) -> int:
    """Create parent/child chunks, persist them, create embeddings for child chunks only and index those vectors.
    Returns paper_id."""
    init_db()
    conn = get_conn()
    c = conn.cursor()
    c.execute("INSERT INTO papers (filename) VALUES (?)", (filename,))
    paper_id = c.lastrowid

    # 1) Create parents by grouping pages
    parents = chunk_pdf_parents(file_path, parent_max_chars)
    if not parents:
        conn.commit()
        conn.close()
        return paper_id

    child_texts = []
    child_ids = []

    for parent in parents:
        # insert parent and get parent_id
        c.execute(
            "INSERT INTO parent_chunks (paper_id, start_page, end_page, text) VALUES (?,?,?,?)",
            (paper_id, parent["start_page"], parent["end_page"], parent["text"]),
        )
        parent_id = c.lastrowid

        # split into children
        children = split_parent_into_children(parent["text"], child_size=child_size, overlap=child_overlap)
        for child_text in children:
            # store a child (we keep start_page/end_page from parent as approximation)
            c.execute(
                "INSERT INTO child_chunks (parent_id, start_page, end_page, text) VALUES (?,?,?,?)",
                (parent_id, parent["start_page"], parent["end_page"], child_text),
            )
            cid = c.lastrowid
            child_ids.append(cid)
            child_texts.append(child_text)

    conn.commit()

    # Embeddings only for children
    embed_model = _ensure_embed_model()
    if len(child_texts) == 0:
        conn.close()
        return paper_id

    vectors = embed_model.encode(child_texts)

    d = vectors[0].shape[0]
    index = _load_or_create_index(d)

    ids_arr = np.array(child_ids).astype("int64")
    arr = np.array(vectors).astype("float32")

    if isinstance(index, faiss.IndexIDMap):
        index.add_with_ids(arr, ids_arr)
    else:
        index.add(arr)

    faiss.write_index(index, INDEX_PATH)
    conn.close()
    return paper_id


def paper_indexed(paper_id: int) -> bool:
    init_db()
    conn = get_conn()
    c = conn.cursor()
    # paper is considered indexed if it has child_chunks
    c.execute("SELECT COUNT(1) FROM child_chunks WHERE parent_id IN (SELECT id FROM parent_chunks WHERE paper_id = ?)", (paper_id,))
    row = c.fetchone()
    conn.close()
    return row[0] > 0


def ensure_paper_indexed(file_path: str, filename: str) -> int:
    """If paper exists in DB by filename, return its id; otherwise add and index it."""
    init_db()
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT id FROM papers WHERE filename = ?", (filename,))
    row = c.fetchone()
    if row:
        paper_id = row[0]
        # if not indexed, index now
        if not paper_indexed(paper_id):
            conn.close()
            return add_paper_and_index(file_path, filename)
        conn.close()
        return paper_id
    conn.close()
    return add_paper_and_index(file_path, filename)


def retrieve_chunks(paper_id: int, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
    """Search FAISS for top_k child chunk IDs, then return the corresponding parent chunks.

    Returns a list of parent dicts in order of the first matching child, with keys:
      parent_id, start_page, end_page, text, child_ids (list of child ids that matched)
    """
    init_db()
    embed_model = _ensure_embed_model()
    qv = embed_model.encode([query]).astype("float32")
    if faiss is None:
        raise RuntimeError("faiss not installed")
    if not os.path.exists(INDEX_PATH):
        return []
    index = faiss.read_index(INDEX_PATH)
    D, I = index.search(qv, top_k)
    child_ids = [int(i) for i in I[0] if i != -1]

    if not child_ids:
        return []

    conn = get_conn()
    c = conn.cursor()
    placeholders = ",".join(["?" for _ in child_ids])
    # fetch child rows
    c.execute(f"SELECT id, parent_id, start_page, end_page, text FROM child_chunks WHERE id IN ({placeholders})", child_ids)
    child_rows = c.fetchall()

    # map parent_id -> {parent fields and matched child ids}
    parent_map: Dict[int, Dict[str, Any]] = {}
    child_to_parent = {}
    for r in child_rows:
        pid = r["parent_id"]
        child_to_parent[r["id"]] = pid
        if pid not in parent_map:
            parent_map[pid] = {"parent_id": pid, "start_page": r["start_page"], "end_page": r["end_page"], "child_ids": []}
        parent_map[pid]["child_ids"].append(r["id"])

    # preserve FAISS order of child matches, but return parent entries deduped in first-seen order
    ordered_parents: List[Dict[str, Any]] = []
    seen_parents = set()
    for cid in child_ids:
        pid = child_to_parent.get(cid)
        if pid and pid not in seen_parents:
            seen_parents.add(pid)
            ordered_parents.append(parent_map[pid])

    if not ordered_parents:
        conn.close()
        return []

    # fetch parent texts
    parent_ids = [p["parent_id"] for p in ordered_parents]
    placeholders = ",".join(["?" for _ in parent_ids])
    c.execute(f"SELECT id, start_page, end_page, text FROM parent_chunks WHERE id IN ({placeholders})", parent_ids)
    parent_rows = c.fetchall()
    parent_by_id = {r["id"]: r for r in parent_rows}

    result = []
    for p in ordered_parents:
        pr = parent_by_id.get(p["parent_id"])
        if pr:
            result.append({
                "parent_id": p["parent_id"],
                "start_page": pr["start_page"],
                "end_page": pr["end_page"],
                "text": pr["text"],
                "child_ids": p["child_ids"],
            })

    conn.close()
    return result


def save_analysis(paper_id: int, prompt_id: str, model_output: str, parsed_json: Dict[str, Any], retrieved_chunk_ids: List[int]):
    init_db()
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        "INSERT INTO analyses (paper_id, prompt_id, model_output, parsed_json, retrieved_chunk_ids) VALUES (?,?,?,?,?)",
        (paper_id, prompt_id, model_output, json.dumps(parsed_json), json.dumps(retrieved_chunk_ids)),
    )
    conn.commit()
    conn.close()
