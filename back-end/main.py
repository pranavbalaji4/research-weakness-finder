import os
import re
import fitz  # PyMuPDF
import google.generativeai as genai
import traceback
import json
from pathlib import Path

# optional RAG utilities (fall back if not available)
try:
    import rag
    ensure_paper_indexed = getattr(rag, "ensure_paper_indexed", None)
    retrieve_chunks = getattr(rag, "retrieve_chunks", None)
    save_analysis = getattr(rag, "save_analysis", None)
    ensure_data_dir = getattr(rag, "ensure_data_dir", None)
except Exception:
    ensure_paper_indexed = None
    retrieve_chunks = None
    save_analysis = None
    ensure_data_dir = None
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from scoring import compute_scores

# 1. LOAD ENVIRONMENT VARIABLES
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found in .env file!")
else:
    def _mask_key(k: str) -> str:
        if not k:
            return "<not set>"
        if len(k) <= 10:
            return k
        return f"{k[:6]}...{k[-4:]}"

    print(f"GEMINI_API_KEY present: True; masked key: {_mask_key(GEMINI_API_KEY)}")

# 2. CONFIGURE GEMINI
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')

app = FastAPI()

# SECURITY: Allow Next.js (port 3000) to talk to FastAPI (port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploaded_papers"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# If rag is available, ensure its data directory exists now (helps visibility)
if ensure_data_dir:
    try:
        ensure_data_dir()
    except Exception as e:
        print("Warning: could not ensure RAG data dir:", e)

# ---------------------------------------------------------
# HELPER FUNCTIONS
# ---------------------------------------------------------
def extract_text_from_pdf(file_path: str) -> str:
    text = ""
    try:
        with fitz.open(file_path) as doc:
            for page in doc:
                text += page.get_text() + "\n"
        return text
    except Exception as e:
        print(f"Extraction Error: {e}")
        return ""

async def analyze_with_gemini(text: str, file_path: str = None, filename: str = None):
    """Sends the text to Gemini. If RAG available, retrieve evidence and request structured JSON."""

    # If RAG utilities are available, ensure the paper is indexed and retrieve parent-level evidence
    evidence_blocks = []
    retrieved_ids = []
    try:
        if ensure_paper_indexed and retrieve_chunks and filename and file_path:
            paper_id = ensure_paper_indexed(file_path, filename)
            # retrieval query: focus on critique, methodology and citations
            query = "Find passages relevant to critique, methodology, and missing citations"
            parents = retrieve_chunks(paper_id, query, top_k=10)
            # Deduplicate parents preserving order and collect contributing child ids
            seen = set()
            for p in parents:
                pid = p.get("parent_id")
                if pid in seen:
                    continue
                seen.add(pid)
                start = p.get("start_page", "")
                end = p.get("end_page", "")
                # include a truncated preview of the parent text (keep prompt size reasonable)
                preview = (p.get("text") or "")[:1500]
                evidence_blocks.append(f"Evidence {len(evidence_blocks)+1} (pages {start}-{end}):\n{preview}")
                # store child ids that contributed to this parent
                cid_list = p.get("child_ids", [])
                for cid in cid_list:
                    retrieved_ids.append(cid)
    except Exception:
        # non-fatal: continue without RAG
        evidence_blocks = []
        retrieved_ids = []

    evidence_text = "\n\n".join(evidence_blocks)

    # Compose a prompt that requests strict JSON
    prompt = f"""
Persona: You are Socrates AI — a warm, encouraging, but intellectually brutal Thesis Advisor.

Task: Audit the manuscript for academic quality and readiness for submission.

Focus areas: Logical Fallacies, Literature Gaps, Methodology Flaws.

Instructions:
- Return ONLY valid JSON with keys: `mentor_note` (string), `brutal_truth` (array of strings), `roadmap` (array of strings), and optional `assumptions` (array of strings).
- Include short evidence references where relevant in `brutal_truth` items as objects if helpful.
- If you cannot answer, include nulls or empty arrays. Do not include any free-form prose outside the JSON.

EVIDENCE:
{evidence_text}

PAPER_TEXT (for context, truncated):
{text[:20000]}
"""

    # Using 20k characters to stay safe with token limits. Generate.
    response = model.generate_content(prompt)
    raw = response.text

    # Robust JSON extraction helper: handles code fences and finds balanced braces
    def _extract_json_from_text(s: str):
        try:
            # If there's a fenced block, try those first
            if "```" in s:
                parts = s.split("```")
                for p in parts:
                    if "{" in p and "}" in p:
                        candidate = p.strip()
                        # find first '{' and attempt to extract balanced object
                        st = candidate.find("{")
                        if st != -1:
                            cand = candidate[st:]
                            brace = 0
                            end_idx = None
                            for i, ch in enumerate(cand):
                                if ch == '{':
                                    brace += 1
                                elif ch == '}':
                                    brace -= 1
                                    if brace == 0:
                                        end_idx = i + 1
                                        break
                            if end_idx:
                                try:
                                    return json.loads(cand[:end_idx])
                                except Exception:
                                    pass
            # Otherwise scan whole string for first balanced JSON object
            start = s.find('{')
            if start == -1:
                return None
            brace = 0
            end_idx = None
            for i, ch in enumerate(s[start:]):
                if ch == '{':
                    brace += 1
                elif ch == '}':
                    brace -= 1
                    if brace == 0:
                        end_idx = start + i + 1
                        break
            if end_idx:
                candidate = s[start:end_idx]
                try:
                    return json.loads(candidate)
                except Exception:
                    return None
        except Exception:
            return None
        return None

    # try to parse JSON from the model output using the helper
    parsed = _extract_json_from_text(raw)
    assumptions = []

    # Fallback: attempt to extract assumptions from free text similar to previous logic
    if not parsed:
        try:
            m = re.split(r"\n\s*assumptions\s*[:\n]", raw, flags=re.I)
            if len(m) > 1:
                block = m[1].split("\n\n")[0]
                for line in block.splitlines():
                    line = line.strip()
                    if not line:
                        continue
                    if line.startswith("-") or line.startswith("*") or re.match(r"^[0-9]+[.)]", line):
                        assumptions.append(line.lstrip("-* 0123456789.()").strip())
                    else:
                        if len(assumptions) < 3 and len(line) < 200:
                            assumptions.append(line)
            assumptions = assumptions[:3]
        except Exception:
            assumptions = []

    # If parsed JSON available, extract assumptions if present
    if parsed and isinstance(parsed, dict):
        assumptions = parsed.get("assumptions", assumptions)

    # Save analysis record if RAG save available
    try:
        if save_analysis and filename:
            # locate paper id if indexed
            # best-effort: find by filename
            # note: rag.save_analysis expects paper_id, but we saved retrieved_ids above; store with paper_id if available
            # Here we attempt to find paper id via ensure_paper_indexed
            paper_id = None
            if ensure_paper_indexed and filename and file_path:
                paper_id = ensure_paper_indexed(file_path, filename)
            save_analysis(paper_id if paper_id else -1, "socrates-v1", raw, parsed if parsed else {}, retrieved_ids)
    except Exception:
        pass

    # Prepare pretty-formatted analysis text to return to frontend
    try:
        if parsed and isinstance(parsed, dict):
            pretty_analysis = json.dumps(parsed, indent=2, ensure_ascii=False)
        else:
            pretty_analysis = raw
    except Exception:
        pretty_analysis = raw

    return {"text": pretty_analysis, "assumptions": assumptions}

# ---------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------

@app.get("/")
def home():
    return {"status": "Argus AI Backend is Online"}

@app.post("/upload/")
async def upload_and_analyze(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    try:
        # Log receipt and Save file
        print(f"Received upload: {file.filename}")
        # ensure filename is safe in production — this is a dev helper log
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Step 5: Extract Text
        extracted_text = extract_text_from_pdf(file_path)
        
        # Step 6: AI Analysis (skip or handle Gemini failures gracefully)
        if not GEMINI_API_KEY:
            print("GEMINI_API_KEY not set — skipping Gemini analysis for debug")
            analysis_resp = {"text": "DEBUG: gemini skipped (no API key)", "assumptions": []}
        else:
            try:
                analysis_resp = await analyze_with_gemini(extracted_text, file_path=file_path, filename=file.filename)
            except Exception as e:
                print("Error during Gemini analysis:", str(e))
                traceback.print_exc()
                # Non-fatal fallback: return a placeholder analysis so frontend can continue
                analysis_resp = {"text": f"Gemini unavailable: {e}", "assumptions": []}
        analysis_report = analysis_resp.get("text") if isinstance(analysis_resp, dict) else analysis_resp
        assumptions = analysis_resp.get("assumptions") if isinstance(analysis_resp, dict) else []

        # Step 7: Heuristic scoring
        try:
            scores = compute_scores(extracted_text)
        except Exception:
            scores = None

        # attach detected citations from scoring (if available)
        citations = None
        try:
            citations = scores.get("citations") if isinstance(scores, dict) else None
        except Exception:
            citations = None

        return {
            "status": "success",
            "filename": file.filename,
            "analysis": analysis_report,
            "assumptions": assumptions,
            "scores": scores,
            "citations": citations,
        }
        
    except Exception as e:
        print("Upload handler exception:", str(e))
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))