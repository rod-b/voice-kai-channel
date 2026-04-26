"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Message } from "@/lib/types";
import { getOrCreateToken } from "@/lib/tokens";
import { startRecording, stopRecording, isRecording } from "@/lib/audio";
import { playSendSound, playReceiveSound, playBase64Audio, stopAudio, getCtx } from "@/lib/sounds";
import MessageBubble from "./MessageBubble";
import TalkButton from "./TalkButton";
import TextComposer from "./TextComposer";
import AudioIndicator from "./AudioIndicator";

const BASE = process.env.NEXT_PUBLIC_VOICE_URL || "";

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
  const transcriptRef = useRef(""); // always fresh, avoids stale closure in sendAudio
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

  // Unlock AudioContext on first user interaction — required for Safari autoplay policy.
  // Safari suspends all AudioContext until a user gesture occurs.
  // We use the shared getCtx() so this resume propagates to all audio playback.
  useEffect(() => {
    const unlock = () => {
      try {
        const c = getCtx();
        if (c.state === "suspended") {
          c.resume().catch(() => {});
        }
      } catch {}
    };
    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("touchstart", unlock, { once: true });
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Keep transcriptRef in sync so sendAudio can read the current value
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

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
        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
            console.log("[voice] SSE event:", currentEvent);
            continue;
          }
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          try {
            const msg = JSON.parse(raw);
            console.log("[voice] SSE data:", JSON.stringify(msg).substring(0, 100), "event=", currentEvent);
            if (msg.type === "response_start" || msg.type === "done") { currentEvent = ""; continue; }
            if (currentEvent === "response" && msg.text) lastResponse = msg.text;
            else if (currentEvent === "error" && msg.message) errorMsg = msg.message;
            if (msg.transcript && msg.transcript.text) {
              console.log("[voice] transcript received:", msg.transcript.text);
              setTranscript(msg.transcript.text);
            }
            if (msg.audio) {
              console.log("[voice] audio event received, base64 length:", msg.audio.base64.length, "contentType:", msg.audio.contentType);
              playBase64Audio(msg.audio.base64, msg.audio.contentType);
            } else if (msg.base64 && msg.contentType) {
              playBase64Audio(msg.base64, msg.contentType);
            }
            currentEvent = "";
          } catch { currentEvent = ""; }
        }
        console.log("[voice] SSE parsed: lastResponse=", JSON.stringify(lastResponse), "errorMsg=", errorMsg);
        if (lastResponse) {
          const aiMsg: Message = {
            id: `ai-${Date.now()}`,
            role: "ai",
            body: lastResponse,
            createdAt: new Date().toISOString(),
          };
          setMessages((m) => [...m, aiMsg]);
          console.log("[voice] AI message added to chat, body:", aiMsg.body.substring(0, 80));
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
      body: transcriptRef.current || "🎤 Voice message",
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
        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
            console.log("[voice] SSE event:", currentEvent);
            continue;
          }
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          try {
            const msg = JSON.parse(raw);
            console.log("[voice] SSE data:", JSON.stringify(msg).substring(0, 100), "event=", currentEvent);
            if (msg.type === "response_start" || msg.type === "done") { currentEvent = ""; continue; }
            if (currentEvent === "response" && msg.text) lastResponse = msg.text;
            else if (currentEvent === "error" && msg.message) errorMsg = msg.message;
            if (msg.transcript && msg.transcript.text) {
              console.log("[voice] transcript received:", msg.transcript.text);
              setTranscript(msg.transcript.text);
            }
            if (msg.audio) {
              console.log("[voice] audio event received, base64 length:", msg.audio.base64.length, "contentType:", msg.audio.contentType);
              playBase64Audio(msg.audio.base64, msg.audio.contentType);
              setTtsPlaying(true);
            } else if (msg.base64 && msg.contentType) {
              playBase64Audio(msg.base64, msg.contentType);
              setTtsPlaying(true);
            }
            currentEvent = "";
          } catch { currentEvent = ""; }
        }
        console.log("[voice] SSE parsed: lastResponse=", JSON.stringify(lastResponse), "errorMsg=", errorMsg);
        if (lastResponse) {
          const aiMsg: Message = {
            id: `ai-${Date.now()}`,
            role: "ai",
            body: lastResponse,
            createdAt: new Date().toISOString(),
          };
          setMessages((m) => [...m, aiMsg]);
          console.log("[voice] AI message added to chat, body:", aiMsg.body.substring(0, 80));
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
      const message = err instanceof Error ? err.message : "Microphone failed to start.";
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: "ai",
        body: `Mic error: ${message}`,
        createdAt: new Date().toISOString(),
      };
      setMessages((m) => [...m, aiMsg]);
      setTextMode(true);
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
            <p className="feed-empty-title">Kai Channel</p>
            <p className="feed-empty-hint">Hold the mic to talk, or tap Aa to type</p>
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

      {/* Bottom Control Band - 55% dark overlay */}
      <div className="bottom-bar">
        {/* Top row: hint + Aa + TALK */}
        <div className="bottom-bar-top">
          <span className="bottom-bar-hint">
            <span className="bottom-bar-hint-brand">Kai Channel</span>
            <span className="bottom-bar-hint-sep"> · </span>
            <span className="bottom-bar-hint-text">Hold mic to talk · tap Aa to type</span>
          </span>
          <div className="bottom-bar-top-actions">
            <button
              className={`text-toggle ${textMode ? "active" : ""}`}
              onClick={() => setTextMode((m) => !m)}
              aria-label="Toggle text input"
            >
              Aa
            </button>
            <TalkButton
              recording={recording}
              onHoldStart={handleHoldStart}
              onHoldEnd={handleHoldEnd}
            />
          </div>
        </div>

        {/* Bottom row: text input (shown only when textMode is true) */}
        <div className="bottom-bar-input-row" style={{ display: textMode ? 'flex' : 'none' }}>
            <TextComposer onSubmit={handleTextSubmit} disabled={isThinking} />
        </div>
      </div>

      <style>{`
        .voice-ui {
          display: flex;
          flex-direction: column;
          height: 100dvh;
          background: transparent;
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
          background: transparent;
          transition: background var(--transition-fast);
        }

        .icon-btn:hover {
          background: var(--color-surface-raised);
        }

        .feed {
          flex: 1;
          overflow-y: auto;
          padding: 16px 12px;
          padding-bottom: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: transparent;
        }



        .feed-empty-title {
          font-size: 15px;
          font-weight: 500;
          color: rgba(200, 146, 42, 0.7);
        }

        .feed-empty-hint {
          font-size: var(--font-size-xs);
          line-height: 1.4;
          color: rgba(160, 144, 128, 0.5);
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



        .text-toggle {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-full);
          background: var(--color-primary);
          font-size: 14px;
          font-weight: 700;
          color: #1a1510;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
          flex-shrink: 0;
        }

        .text-toggle:hover {
          background: var(--color-primary-hover);
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }


        .bottom-bar {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px 20px 14px;
          padding-bottom: max(14px, env(safe-area-inset-bottom));
          background: rgba(10, 8, 6, 0.55);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-top: 1px solid rgba(61, 53, 44, 0.5);
          flex-shrink: 0;
          width: 100%;
          box-sizing: border-box;
        }

        .bottom-bar-top {
          display: flex;
          align-items: center;
          width: 100%;
          box-sizing: border-box;
          gap: 10px;
        }

        .bottom-bar-hint {
          flex: 1;
          font-size: 12px;
          color: rgba(250, 248, 244, 0.8);
          display: flex;
          align-items: center;
          gap: 0;
          overflow: hidden;
          white-space: nowrap;
          min-width: 0;
        }

        .bottom-bar-hint-brand {
          color: var(--color-primary);
          font-weight: 600;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .bottom-bar-hint-sep {
          color: rgba(250, 248, 244, 0.5);
          margin: 0 3px;
        }

        .bottom-bar-hint-text {
          color: rgba(250, 248, 244, 0.7);
        }

        .bottom-bar-top-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .bottom-bar-input-row {
          display: none;
          align-items: center;
          gap: 10px;
          width: 100%;
        }

        .bottom-bar-input-row.visible {
          display: flex;
        }





        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
