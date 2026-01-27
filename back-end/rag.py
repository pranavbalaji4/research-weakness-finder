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
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS chunks (
            id INTEGER PRIMARY KEY,
            paper_id INTEGER,
            start_page INTEGER,
            end_page INTEGER,
            text TEXT
        )
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


def chunk_pdf_pages(file_path: str, pages_per_chunk: int = 2) -> List[Dict[str, Any]]:
    import fitz

    doc = fitz.open(file_path)
    chunks = []
    total = len(doc)
    for start in range(0, total, pages_per_chunk):
        texts = []
        for p in range(start, min(start + pages_per_chunk, total)):
            texts.append(doc[p].get_text())
        chunk_text = "\n".join(texts).strip()
        if chunk_text:
            chunks.append({
                "start_page": start + 1,
                "end_page": min(start + pages_per_chunk, total),
                "text": chunk_text,
            })
    return chunks


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


def add_paper_and_index(file_path: str, filename: str) -> int:
    """Chunk, embed, persist chunks and vectors. Returns paper_id."""
    init_db()
    conn = get_conn()
    c = conn.cursor()
    c.execute("INSERT INTO papers (filename) VALUES (?)", (filename,))
    paper_id = c.lastrowid

    chunks = chunk_pdf_pages(file_path)
    if not chunks:
        conn.commit()
        conn.close()
        return paper_id

    embed_model = _ensure_embed_model()
    texts = [ch["text"] for ch in chunks]
    vectors = embed_model.encode(texts)

    # Ensure index
    d = vectors[0].shape[0]
    index = _load_or_create_index(d)

    ids = []
    for i, ch in enumerate(chunks):
        c.execute(
            "INSERT INTO chunks (paper_id, start_page, end_page, text) VALUES (?,?,?,?)",
            (paper_id, ch["start_page"], ch["end_page"], ch["text"]),
        )
        chunk_id = c.lastrowid
        ids.append(chunk_id)

    conn.commit()

    # add vectors with explicit ids
    arr = np.array(vectors).astype("float32")
    ids_arr = np.array(ids).astype("int64")
    if isinstance(index, faiss.IndexIDMap):
        index.add_with_ids(arr, ids_arr)
    else:
        # fallback (should not happen if created correctly)
        index.add(arr)

    faiss.write_index(index, INDEX_PATH)
    conn.close()
    return paper_id


def paper_indexed(paper_id: int) -> bool:
    init_db()
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT COUNT(1) FROM chunks WHERE paper_id = ?", (paper_id,))
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


def retrieve_chunks(paper_id: int, query: str, top_k: int = 6) -> List[Dict[str, Any]]:
    """Return top_k chunks (dicts) for a query using FAISS retrieval."""
    init_db()
    embed_model = _ensure_embed_model()
    qv = embed_model.encode([query]).astype("float32")
    if faiss is None:
        raise RuntimeError("faiss not installed")
    if not os.path.exists(INDEX_PATH):
        return []
    index = faiss.read_index(INDEX_PATH)
    D, I = index.search(qv, top_k)
    ids = [int(i) for i in I[0] if i != -1]

    if not ids:
        return []

    conn = get_conn()
    c = conn.cursor()
    placeholders = ",".join(["?" for _ in ids])
    c.execute(f"SELECT id, start_page, end_page, text FROM chunks WHERE id IN ({placeholders})", ids)
    rows = c.fetchall()
    # preserve FAISS order
    rows_by_id = {r["id"]: r for r in rows}
    result = []
    for cid in ids:
        r = rows_by_id.get(cid)
        if r:
            result.append({"id": r["id"], "start_page": r["start_page"], "end_page": r["end_page"], "text": r["text"]})
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
