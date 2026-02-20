import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ChatMessage({ role, content }) {
  return (
    <div className={`chat-msg ${role}`}>
      {role === "assistant" ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ ...props }) => (
              <a
                {...props}
                target="_blank"
                rel="noopener noreferrer"
              />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      ) : (
        content
      )}
    </div>
  );
}
