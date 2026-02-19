import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.chat import ChatSession, ChatMessage
from app.models.user import User
from app.schemas.chat import ChatSendRequest, ChatSessionOut, ChatMessageOut
from app.services.auth import get_current_user
from app.services.ai import stream_agent_response, db_messages_to_langchain

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/sessions", response_model=list[ChatSessionOut])
async def list_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == user.id)
        .order_by(ChatSession.updated_at.desc())
    )
    return result.scalars().all()


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageOut])
async def get_messages(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.id == session_id, ChatSession.user_id == user.id)
        .options(selectinload(ChatSession.messages))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session.messages


@router.post("/send")
async def send_message(
    body: ChatSendRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.session_id:
        result = await db.execute(
            select(ChatSession)
            .where(ChatSession.id == body.session_id, ChatSession.user_id == user.id)
            .options(selectinload(ChatSession.messages))
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    else:
        session = ChatSession(user_id=user.id, title=body.message[:60])
        db.add(session)
        await db.commit()
        await db.refresh(session)
        result = await db.execute(
            select(ChatSession)
            .where(ChatSession.id == session.id)
            .options(selectinload(ChatSession.messages))
        )
        session = result.scalar_one()

    user_msg = ChatMessage(session_id=session.id, role="user", content=body.message)
    db.add(user_msg)
    await db.commit()

    chat_history = db_messages_to_langchain(session.messages)

    collected_tokens: list[str] = []

    async def event_stream():
        async for chunk in stream_agent_response(db, user.id, chat_history, body.message):
            yield chunk

            try:
                data = json.loads(chunk.replace("data: ", "").strip())
                if "token" in data:
                    collected_tokens.append(data["token"])
                if data.get("done"):
                    assistant_content = "".join(collected_tokens)
                    ai_msg = ChatMessage(
                        session_id=session.id, role="assistant", content=assistant_content
                    )
                    db.add(ai_msg)
                    await db.commit()
                    yield f"data: {json.dumps({'session_id': str(session.id)})}\n\n"
            except (json.JSONDecodeError, ValueError):
                pass

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    await db.delete(session)
    await db.commit()
