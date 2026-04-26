import { useCallback, useRef } from "react";

interface Props {
  recording: boolean;
  onHoldStart: () => void;
  onHoldEnd: () => void;
}

export default function TalkButton({ recording, onHoldStart, onHoldEnd }: Props) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHolding = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      isHolding.current = true;
      // Start recording after short press-and-hold (100ms)
      holdTimer.current = setTimeout(() => {
        if (isHolding.current) onHoldStart();
      }, 100);
    },
    [onHoldStart]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      if (holdTimer.current) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
      // If it was a quick tap (not held long enough to start recording), treat as tap-to-talk
      if (isHolding.current && !recording) {
        onHoldStart();
      }
      if (recording) {
        onHoldEnd();
      }
      isHolding.current = false;
    },
    [recording, onHoldStart, onHoldEnd]
  );

  const handlePointerLeave = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    isHolding.current = false;
  }, []);

  return (
    <>
      <button
        className={`talk-btn ${recording ? "recording" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={recording ? "Release to send" : "Hold to talk"}
      >
        <div className="talk-btn-inner">
          <span className="mic-icon">{recording ? "🔴" : "🎤"}</span>
          <span className="talk-label">
            {recording ? "REC..." : "TALK"}
          </span>
        </div>
        {recording && <div className="pulse-ring" />}
      </button>

      <style>{`
        .talk-btn {
          position: relative;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: var(--shadow-button);
          transition: transform 0.15s ease, background 0.15s ease;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          cursor: pointer;
        }

        .talk-btn:active:not(.recording) {
          transform: scale(0.94);
        }

        .talk-btn.recording {
          background: var(--color-recording);
        }

        .talk-btn-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          pointer-events: none;
        }

        .mic-icon {
          font-size: 28px;
          line-height: 1;
        }

        .talk-label {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1px;
          color: var(--color-bg);
        }

        .pulse-ring {
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          border: 2px solid var(--color-recording);
          animation: pulse-ring 1.2s ease-out infinite;
          pointer-events: none;
        }

        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </>
  );
}
