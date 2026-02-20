import { useState, useEffect, useRef } from "react";
import { api, apiStream } from "../api/client";
import ChatMessage from "../components/ChatMessage";

export default function Chat() {
  const MAX_SESSION_TITLE_LENGTH = 25;
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef(null);

  function truncateSessionTitle(title) {
    if (title.length <= MAX_SESSION_TITLE_LENGTH) return title;
    return `${title.slice(0, MAX_SESSION_TITLE_LENGTH)}...`;
  }

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) loadMessages(activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadSessions() {
    try {
      const data = await api("/chat/sessions");
      setSessions(data);
      if (data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id);
      }
    } catch {
      /* empty */
    }
  }

  async function loadMessages(sessionId) {
    try {
      const data = await api(`/chat/sessions/${sessionId}/messages`);
      setMessages(data);
    } catch {
      /* empty */
    }
  }

  function startNewChat() {
    setActiveSessionId(null);
    setMessages([]);
  }

  async function deleteSession(id) {
    try {
      await api(`/chat/sessions/${id}`, { method: "DELETE" });
      const updated = sessions.filter((s) => s.id !== id);
      setSessions(updated);
      if (activeSessionId === id) {
        setActiveSessionId(updated.length > 0 ? updated[0].id : null);
        setMessages([]);
      }
    } catch {
      /* empty */
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text, id: crypto.randomUUID() }]);
    setStreaming(true);

    const streamingMsgId = crypto.randomUUID();
    setMessages((prev) => [...prev, { role: "assistant", content: "", id: streamingMsgId }]);

    try {
      const body = { message: text };
      if (activeSessionId) body.session_id = activeSessionId;

      const stream = await apiStream("/chat/send", body);
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamingMsgId
                    ? { ...m, content: m.content + data.token }
                    : m
                )
              );
            }
            if (data.session_id && !activeSessionId) {
              setActiveSessionId(data.session_id);
              loadSessions();
            }
          } catch {
            /* skip malformed lines */
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingMsgId
            ? { ...m, content: `Error: ${err.message}` }
            : m
        )
      );
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="chat-page">
      <div className="chat-header">
        <select
          value={activeSessionId || ""}
          onChange={(e) => setActiveSessionId(e.target.value || null)}
        >
          <option value="">Select a chat...</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {truncateSessionTitle(s.title)}
            </option>
          ))}
        </select>
        <button onClick={startNewChat}>+ New</button>
        {activeSessionId && (
          <button
            className="chat-delete-btn"
            onClick={() => deleteSession(activeSessionId)}
            aria-label="Delete chat"
            title="Delete chat"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M3 6H5H21"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M10 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M14 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            Start a conversation about meal planning, recipes, or your grocery list.
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
        />
        <button type="submit" disabled={streaming || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
