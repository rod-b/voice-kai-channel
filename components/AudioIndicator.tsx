interface Props {
  recording: boolean;
  ttsPlaying: boolean;
}

export default function AudioIndicator({ recording, ttsPlaying }: Props) {
  if (!recording && !ttsPlaying) return null;

  return (
    <>
      <div className={`audio-indicator ${recording ? "recording" : "tts"}`}>
        {recording ? (
          <>
            <span className="dot-recording">●</span>
            <span>Recording...</span>
          </>
        ) : (
          <>
            <span>🔊</span>
            <span>Playing response...</span>
            <button className="stop-btn" onPointerDown={(e) => e.preventDefault()} aria-label="Stop">
              ■
            </button>
          </>
        )}
      </div>

      <style>{`
        .audio-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 8px 16px;
          font-size: var(--font-size-sm);
          font-weight: 600;
          flex-shrink: 0;
        }

        .audio-indicator.recording {
          color: var(--color-recording);
          background: color-mix(in srgb, var(--color-recording) 10%, transparent);
        }

        .audio-indicator.tts {
          color: var(--color-tts-playing);
          background: color-mix(in srgb, var(--color-tts-playing) 10%, transparent);
        }

        .dot-recording {
          font-size: 12px;
          animation: pulse 1s infinite;
        }

        .stop-btn {
          font-size: 10px;
          color: inherit;
          opacity: 0.7;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(255,255,255,0.1);
          transition: opacity var(--transition-fast);
        }

        .stop-btn:hover {
          opacity: 1;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </>
  );
}
