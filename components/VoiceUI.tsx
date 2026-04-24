"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Message } from "@/lib/types";
import { getOrCreateToken } from "@/lib/tokens";
import { startRecording, stopRecording, isRecording } from "@/lib/audio";
import { playSendSound, playReceiveSound, playBase64Audio, stopAudio } from "@/lib/sounds";
import MessageBubble from "./MessageBubble";
import TalkButton from "./TalkButton";
import TextComposer from "./TextComposer";
import AudioIndicator from "./AudioIndicator";

const BASE = process.env.NEXT_PUBLIC_VOICE_URL || "http://localhost:3005";

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function VoiceUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [recording, setRecording] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [transcript, setTranscript] = useState("");
  const [token, setToken] = useState<string>("");
  const feedRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load theme + token
  useEffect(() => {
    const savedTheme = localStorage.getItem("kai-theme") as "dark" | "light" | null;
    if (savedTheme) setTheme(savedTheme);
    setToken(getOrCreateToken());
  }, []);

  // Apply theme to html
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("kai-theme", theme);
  }, [theme]);

  // Scroll to bottom on new messages
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const sendEvent = useCallback((text: string) => {
    if (!text.trim()) return;

    const humanMsg: Message = {
      id: `human-${Date.now()}`,
      role: "human",
      body: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, humanMsg]);
    setIsThinking(true);
    setTranscript("");
    playSendSound();

    // Abort any in-flight request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    const token = localStorage.getItem("kai-voice-token") || "";
    const fd = new FormData();
    fd.append("text", text);
    fetch(`${BASE}/api/voice/message`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
      signal: abortRef.current.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        // SSE parse
        const lines = text.split("\n");
        let lastResponse = "";
        let errorMsg = "";
        for (const line of lines) {
          if (line.startsWith("event:")) continue;
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          try {
            const msg = JSON.parse(raw);
            if (msg.type === "response_start" || msg.type === "done") continue;
            if (msg.text && typeof msg.text === "string") lastResponse = msg.text;
            if (msg.message) errorMsg = msg.message;
            if (msg.transcript && msg.transcript.text) setTranscript(msg.transcript.text);
            if (msg.audio) {
              playBase64Audio(msg.audio.base64, msg.audio.contentType);
            }
          } catch {}
        }
        if (lastResponse) {
          const aiMsg: Message = {
            id: `ai-${Date.now()}`,
            role: "ai",
            body: lastResponse,
            createdAt: new Date().toISOString(),
          };
          setMessages((m) => [...m, aiMsg]);
          playReceiveSound();
        } else if (errorMsg) {
          const aiMsg: Message = {
            id: `ai-${Date.now()}`,
            role: "ai",
            body: `Error: ${errorMsg}`,
            createdAt: new Date().toISOString(),
          };
          setMessages((m) => [...m, aiMsg]);
        }
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        console.error(e);
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          role: "ai",
          body: `Error: ${e.message || "Request failed"}`,
          createdAt: new Date().toISOString(),
        };
        setMessages((m) => [...m, aiMsg]);
        playReceiveSound();
      })
      .finally(() => {
        setIsThinking(false);
        setTtsPlaying(false);
      });
  }, []);

  const sendAudio = useCallback(async () => {
    const blob = await stopRecording();
    console.log("[voice] Recording stopped, blob size:", blob?.size);
    if (!blob || blob.size === 0) {
      // Recording failed — show text mode as fallback
      console.error("[voice] Recording produced empty blob");
      setRecording(false);
      setIsThinking(false);
      setTextMode(true);
      return;
    }

    setRecording(false);
    setIsThinking(true);

    const humanMsg: Message = {
      id: `human-${Date.now()}`,
      role: "human",
      body: transcript || "🎤 Voice message",
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, humanMsg]);
    setTranscript("");
    playSendSound();

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    const token = localStorage.getItem("kai-voice-token") || "";
    const fd = new FormData();
    const ext = blob.type.includes("mp4") || blob.type.includes("mpeg") ? "m4a" : "webm";
    fd.append("audio", blob, `recording.${ext}`);

    fetch(`${BASE}/api/voice/message`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
      signal: abortRef.current.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        const lines = text.split("\n");
        let lastResponse = "";
        let errorMsg = "";
        let thinkingMsg = "";
        for (const line of lines) {
          if (line.startsWith("event:")) continue;
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          try {
            const msg = JSON.parse(raw);
            if (msg.type === "response_start" || msg.type === "done") continue;
            if (msg.text && typeof msg.text === "string") lastResponse = msg.text;
            if (msg.message) errorMsg = msg.message;
            if (msg.transcript && msg.transcript.text) setTranscript(msg.transcript.text);
            if (msg.audio) {
              playBase64Audio(msg.audio.base64, msg.audio.contentType);
              setTtsPlaying(true);
            }
          } catch {}
        }
        if (lastResponse) {
          const aiMsg: Message = {
            id: `ai-${Date.now()}`,
            role: "ai",
            body: lastResponse,
            createdAt: new Date().toISOString(),
          };
          setMessages((m) => [...m, aiMsg]);
          playReceiveSound();
        } else if (errorMsg) {
          const aiMsg: Message = {
            id: `ai-${Date.now()}`,
            role: "ai",
            body: `Error: ${errorMsg}`,
            createdAt: new Date().toISOString(),
          };
          setMessages((m) => [...m, aiMsg]);
        }
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        console.error(e);
      })
      .finally(() => {
        setIsThinking(false);
        setTtsPlaying(false);
      });
  }, [transcript]);

  const handleHoldStart = useCallback(() => {
    setRecording(true);
    setTranscript("");
    startRecording().catch((err) => {
      console.error("Mic error:", err);
      setRecording(false);
    });
  }, []);

  const handleHoldEnd = useCallback(() => {
    if (!isRecording()) return;
    sendAudio();
  }, [sendAudio]);

  const handleTextSubmit = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      stopAudio();
      sendEvent(text);
    },
    [sendEvent]
  );

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <div className="voice-ui">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <span className="kai-avatar">🐅</span>
          <span className="kai-name">Kai Channel</span>
        </div>
        <div className="header-right">
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {/* Message Feed */}
      <div className="feed" ref={feedRef}>
        {messages.length === 0 && (
          <div className="feed-empty">
            <div className="feed-empty-avatar">🐅</div>
            <p>Hey Rod, ready when you are.</p>
            <p>Hold the mic and talk, or type a message below.</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            showAvatar={msg.role === "ai"}
          />
        ))}
        {recording && transcript && (
          <div className="feed-live-transcript">
            <span className="live-dot">●</span>
            <span>{transcript}</span>
          </div>
        )}
        {isThinking && !recording && (
          <div className="feed-thinking">
            <div className="thinking-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
      </div>

      {/* Audio Indicator */}
      <AudioIndicator recording={recording} ttsPlaying={ttsPlaying} />

      {/* Bottom Controls */}
      <div className="controls">
        <TalkButton
          recording={recording}
          onHoldStart={handleHoldStart}
          onHoldEnd={handleHoldEnd}
        />
        <button
          className={`text-toggle ${textMode ? "active" : ""}`}
          onClick={() => setTextMode((m) => !m)}
          aria-label="Toggle text input"
        >
          Aa
        </button>
      </div>

      {/* Text Composer */}
      {textMode && (
        <TextComposer onSubmit={handleTextSubmit} disabled={isThinking} />
      )}

      <style>{`
        .voice-ui {
          display: flex;
          flex-direction: column;
          height: 100dvh;
          background: var(--color-bg);
          overflow: hidden;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-border);
          flex-shrink: 0;
          padding-top: max(12px, env(safe-area-inset-top));
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .kai-avatar {
          font-size: 28px;
          line-height: 1;
        }

        .kai-name {
          font-size: var(--font-size-lg);
          font-weight: 700;
          color: var(--color-text);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .icon-btn {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          background: var(--color-surface-alt);
          transition: background var(--transition-fast);
        }

        .icon-btn:hover {
          background: var(--color-surface-raised);
        }

        .feed {
          flex: 1;
          overflow-y: auto;
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .feed-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 12px;
          color: var(--color-text-muted);
          text-align: center;
          padding: 40px 20px;
        }

        .feed-empty-avatar {
          font-size: 56px;
          margin-bottom: 8px;
        }

        .feed-empty p {
          font-size: var(--font-size-base);
          line-height: 1.6;
          max-width: 280px;
        }

        .feed-live-transcript {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: var(--color-surface);
          border-radius: var(--radius-lg);
          border-left: 3px solid var(--color-primary);
          font-size: var(--font-size-base);
          color: var(--color-text);
          animation: fadeIn 0.2s ease;
        }

        .live-dot {
          color: var(--color-recording);
          font-size: 10px;
          animation: pulse 1s infinite;
        }

        .feed-thinking {
          display: flex;
          align-items: center;
          padding: 14px;
        }

        .thinking-dots {
          display: flex;
          gap: 4px;
        }

        .thinking-dots span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--color-text-muted);
          animation: bounce 1.2s infinite;
        }

        .thinking-dots span:nth-child(2) { animation-delay: 0.15s; }
        .thinking-dots span:nth-child(3) { animation-delay: 0.3s; }

        .controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 12px 20px;
          padding-bottom: max(12px, env(safe-area-inset-bottom));
          background: var(--color-surface);
          border-top: 1px solid var(--color-border);
          flex-shrink: 0;
        }

        .text-toggle {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-full);
          background: var(--color-surface-alt);
          font-size: 16px;
          font-weight: 700;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
          flex-shrink: 0;
        }

        .text-toggle.active,
        .text-toggle:hover {
          background: var(--color-primary);
          color: var(--color-bg);
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
