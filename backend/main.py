
import os
import asyncio
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

app = FastAPI(title="AURA AI Backend")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


api_key = os.getenv("OPENAI_API_KEY", "").strip()
model = os.getenv("AI_MODEL", "gpt-4.1-mini")

client = AsyncOpenAI(
    api_key=api_key,
    timeout=45.0,
    max_retries=0,
) if api_key else None


class ChatRequest(BaseModel):
    messages: list[dict[str, str]] = Field(min_length=1)


@app.get("/api/health")
async def health():
    return {
        "status": "online",
        "api_key_configured": bool(api_key),
        "model": model,
    }


@app.post("/api/chat")
async def chat(request: ChatRequest):
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="OpenAI API key is missing. Add OPENAI_API_KEY to backend/.env.",
        )

    allowed_roles = {"user", "assistant", "system"}
    messages = []

    for item in request.messages:
        role = item.get("role", "")
        content = item.get("content", "")

        if role not in allowed_roles or not isinstance(content, str):
            continue

        if role == "system":
            continue

        if content.strip():
            messages.append({"role": role, "content": content})

    if not messages or messages[-1]["role"] != "user":
        raise HTTPException(
            status_code=400,
            detail="Please send a valid user message.",
        )

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are AURA, a helpful personal AI assistant. "
                        "Answer naturally in the response language requested "
                        "by the user. Help with general tasks, explanations, "
                        "planning, writing, coding, and ideas. "
                        "Be clear about actions you cannot actually perform."
                    ),
                },
                *messages,
            ],
            max_completion_tokens=800,
        )

        reply = response.choices[0].message.content

        if not reply:
            reply = "I couldn't generate a response. Please try again."

        return {"reply": reply}

    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="AURA's request timed out. Please try again.",
        )
    except Exception as exc:
        print(f"AURA API error: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=502,
            detail=f"AI request failed ({type(exc).__name__}). Check the backend terminal.",
        )
