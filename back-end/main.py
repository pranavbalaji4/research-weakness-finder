import os
import re
import fitz  # PyMuPDF
import google.generativeai as genai
import traceback
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

async def analyze_with_gemini(text: str):
    """Sends the text to Gemini with the Socrates AI thesis-reviewer prompt."""
    prompt = f"""
    Persona: You are Socrates AI — a warm, encouraging, but intellectually brutal Thesis Advisor. Speak like a mentor who wants the student to succeed but will not let weak arguments pass.

    Task: Audit the attached thesis or dissertation manuscript for academic quality and readiness for submission.

    Focus areas (use the manuscript text as evidence):
    - Logical Fallacies: identify where the argument breaks down, unsupported leaps, or faulty inference.
    - Literature Gaps: missing key references, contextual framing, or theoretical grounding.
    - Methodology Flaws: questionable data collection, sampling, measurement, identification, or analysis techniques.

    Instructions:
    - Tone: start with a short warm note (mentor-style), then deliver clear, blunt critique, then a concise actionable roadmap.
    - Structure: return three labeled sections exactly: "Mentor's Note", "The Brutal Truth", and "Roadmap to an A".
    - Length: keep the whole response concise (prefer bullets), and ensure each section is present. Use brief citations or paraphrases from the manuscript where helpful.

    PAPER TEXT:
    {text[:20000]}
    """
    # Using 20k characters to stay safe with standard token limits
    response = model.generate_content(prompt)
    text = response.text
    # Try to extract an 'Assumptions' section (3 bullets) from the AI output
    assumptions = []
    try:
        # look for a heading called 'Assumptions' (case-insensitive)
        m = re.split(r"\n\s*assumptions\s*[:\n]", text, flags=re.I)
        if len(m) > 1:
            block = m[1]
            # stop at next blank line followed by a capitalized heading or end
            block = block.split("\n\n")[0]
            # extract lines starting with -, *, or numbered
            for line in block.splitlines():
                line = line.strip()
                if not line:
                    continue
                if line.startswith("-") or line.startswith("*") or re.match(r"^[0-9]+[.)]", line):
                    assumptions.append(line.lstrip("-* 0123456789.()" ).strip())
                else:
                    # also accept short sentences as assumption bullets
                    if len(assumptions) < 3 and len(line) < 200:
                        assumptions.append(line)
        # trim to 3
        assumptions = assumptions[:3]
    except Exception:
        assumptions = []

    return {"text": text, "assumptions": assumptions}

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
                analysis_resp = await analyze_with_gemini(extracted_text)
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