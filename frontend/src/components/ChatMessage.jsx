export default function ChatMessage({ role, content }) {
  return (
    <div className={`chat-msg ${role}`}>
      {content}
    </div>
  );
}
