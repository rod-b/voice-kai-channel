import { useState, useRef, useCallback } from "react";

interface Props {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

const EMOJIS = ["😂", "🙏", "👍", "❤️", "🔥", "🚀", "💡", "🎯", "✅", "⭐", "🌟", "💪", "🤔", "😎", "🎉", "✨"];

export default function TextComposer({ onSubmit, disabled }: Props) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    if (!text.trim() || disabled) return;
    onSubmit(text.trim());
    setText("");
    setShowEmoji(false);
  }, [text, disabled, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const insertEmoji = (emoji: string) => {
    setText((t) => t + emoji);
    inputRef.current?.focus();
  };

  return (
    <>
      <div className="text-composer">
        {showEmoji && (
          <div className="emoji-picker">
            {EMOJIS.map((e) => (
              <button key={e} className="emoji-btn" onPointerDown={(e) => { e.preventDefault(); insertEmoji(e.currentTarget.textContent || ""); }}>{e}</button>
            ))}
          </div>
        )}
        <div className="composer-row">
          <textarea
            ref={inputRef}
            className="composer-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Kai..."
            rows={1}
            disabled={disabled}
            autoFocus
          />
          <button
            className="emoji-toggle"
            onPointerDown={(e) => { e.preventDefault(); setShowEmoji((s) => !s); }}
            aria-label="Emoji"
          >
            😀
          </button>
          <button
            className="send-btn"
            onPointerDown={(e) => { e.preventDefault(); handleSubmit(); }}
            disabled={!text.trim() || disabled}
            aria-label="Send"
          >
            ➤
          </button>
        </div>
      </div>

      <style>{`
        .text-composer {
          padding: 8px 12px;
          padding-bottom: max(8px, env(safe-area-inset-bottom));
          background: var(--color-surface);
          border-top: 1px solid var(--color-border);
          flex-shrink: 0;
        }

        .composer-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }

        .composer-input {
          flex: 1;
          resize: none;
          background: var(--color-surface-alt);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: 10px 14px;
          font-size: var(--font-size-base);
          color: var(--color-text);
          max-height: 120px;
          overflow-y: auto;
          line-height: 1.5;
        }

        .composer-input::placeholder {
          color: var(--color-text-faint);
        }

        .composer-input:focus {
          border-color: var(--color-primary);
        }

        .emoji-toggle {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-full);
          background: var(--color-surface-alt);
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background var(--transition-fast);
        }

        .emoji-toggle:hover {
          background: var(--color-surface-raised);
        }

        .send-btn {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-full);
          background: var(--color-primary);
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all var(--transition-fast);
        }

        .send-btn:disabled {
          opacity: 0.4;
        }

        .send-btn:not(:disabled):hover {
          background: var(--color-primary-hover);
        }

        .emoji-picker {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          padding: 8px;
          background: var(--color-surface-raised);
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          margin-bottom: 8px;
        }

        .emoji-btn {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background var(--transition-fast);
        }

        .emoji-btn:hover {
          background: var(--color-surface-alt);
        }
      `}</style>
    </>
  );
}
