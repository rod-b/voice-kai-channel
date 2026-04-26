import { Message } from "@/lib/types";

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

interface Props {
  message: Message;
  showAvatar?: boolean;
}

export default function MessageBubble({ message, showAvatar }: Props) {
  const isAi = message.role === "ai";
  const body = message.transcript || message.body;

  return (
    <div className={`bubble-row ${isAi ? "ai" : "human"}`}>
      {showAvatar && <span className="avatar">{isAi ? "🐅" : ""}</span>}
      <div className="bubble-content">
        <div className="bubble">
          <p>{body}</p>
        </div>
        <span className="time">{formatTime(message.createdAt)}</span>
      </div>

      <style>{`
        .bubble-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          animation: slideUp 0.2s ease;
        }

        .bubble-row.human {
          flex-direction: row-reverse;
        }

        .avatar {
          font-size: 22px;
          flex-shrink: 0;
          margin-bottom: 2px;
        }

        .bubble-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
          max-width: min(75%, 320px);
        }

        .bubble-row.human .bubble-content {
          align-items: flex-end;
        }

        .bubble {
          padding: 10px 14px;
          border-radius: var(--radius-lg);
          background: var(--color-ai-bubble);
          border: 1px solid var(--color-border);
          box-shadow: var(--shadow-bubble);
        }

        .bubble-row.human .bubble {
          background: var(--color-human-bubble);
          border-color: transparent;
        }

        .bubble p {
          font-size: var(--font-size-base);
          line-height: 1.55;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .time {
          font-size: var(--font-size-xs);
          color: var(--color-text-faint);
          padding: 0 4px;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
