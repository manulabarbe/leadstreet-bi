"""
chat_server.py — Local FastAPI server for chat-with-data.

Serves the existing dashboard with a chat widget injected at runtime.
The actual docs/index.html file is never modified on disk.

Usage:
    python scripts/chat_server.py
    → http://localhost:8000
"""
from __future__ import annotations

import sys
from pathlib import Path

# Ensure scripts/ is on the path for sibling imports
sys.path.insert(0, str(Path(__file__).parent))

from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from pydantic import BaseModel

from chat_db import init_db, execute_safe, get_schema_description
from chat_llm import generate_sql, format_response

DOCS_DIR = Path(__file__).parent.parent / "docs"

db = None
schema_text = ""


class ChatRequest(BaseModel):
    question: str
    conversation: list[dict] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    global db, schema_text
    print("Loading data into DuckDB...")
    db = init_db()
    schema_text = get_schema_description(db)
    print("Chat server ready.")
    yield


app = FastAPI(title="LeadStreet BI Chat", lifespan=lifespan)


@app.get("/", response_class=HTMLResponse)
async def serve_dashboard():
    """Serve index.html with chat widget script injected."""
    html = (DOCS_DIR / "index.html").read_text()
    inject = '<script src="/chat_widget.js"></script>'
    html = html.replace("</body>", f"{inject}\n</body>")
    return HTMLResponse(html)


@app.get("/chat_widget.js")
async def serve_widget():
    return FileResponse(DOCS_DIR / "chat_widget.js", media_type="application/javascript")


@app.post("/api/chat")
async def chat(req: ChatRequest):
    """Handle a chat question. Returns answer + SQL + data."""
    question = req.question.strip()
    if not question:
        return JSONResponse({"answer": "Please ask a question.", "sql": None, "data": None})

    # Step 1: Generate SQL
    try:
        sql, explanation = generate_sql(question, schema_text, req.conversation)
    except Exception as e:
        return JSONResponse({"answer": f"LLM error: {e}", "sql": None, "data": None, "error": str(e)})

    if sql is None:
        return JSONResponse({"answer": explanation, "sql": None, "data": None})

    # Step 2: Execute SQL
    try:
        rows, columns = execute_safe(db, sql)
    except Exception as e:
        return JSONResponse({
            "answer": f"Query failed: {e}",
            "sql": sql,
            "data": None,
            "error": str(e),
        })

    # Step 3: Summarize results
    try:
        answer = format_response(question, sql, rows, columns)
    except Exception as e:
        # If summarization fails, return raw data
        answer = f"Got {len(rows)} results but couldn't summarize: {e}"

    # Cap returned data at 100 rows
    return JSONResponse({
        "answer": answer,
        "sql": sql,
        "data": rows[:100],
    })


@app.get("/api/health")
async def health():
    return {"status": "ok", "tables": ["time_entries", "deals"]}


if __name__ == "__main__":
    uvicorn.run(
        "chat_server:app",
        host="127.0.0.1",
        port=8000,
        reload=False,
        log_level="info",
    )
