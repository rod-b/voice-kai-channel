# Voice Kai Channel — SPEC

## 1. Concept & Vision

**What:** A mobile-first PWA voice channel to Kai — Telegram-like but voice-first and ambient-capable. You talk, Kai responds with voice and text.

**Vision:** Open the app, hold the mic and talk, Kai hears and responds. When voice isn't convenient, type. Always a direct line to Kai, no workpad context needed.

**Relationship to workpad:** None. Completely separate app. Shares the xAI STT/TTS/LLM backend infrastructure only.

---

## 2. Technical Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (TypeScript), PWA |
| Port | `:3005` |
| Audio | MediaRecorder API (WAV/MP3) |
| STT | xAI STT (existing) |
| LLM | xAI Grok via Kai bridge (existing) |
| TTS | xAI TTS (existing) |
| Streaming | SSE (existing pattern) |
| Auth | Token only — random UUID stored in localStorage, pre-shared with Rod |
| Hosting | Ubuntu via cloudflared HTTPS |
| PWA | manifest.json + Service Worker |

---

## 3. Auth Model

- On first open, generate a random UUID token, store in localStorage
- Pre-share Rod's token (configured in env) so his app authenticates immediately without setup
- All API requests include `Authorization: Bearer <token>` header
- Token = user identity, no username/password needed
- No DB, no user management

---

## 4. Features

### Core (Phase 1)
- [ ] PWA installable on iOS home screen
- [ ] Tap-or-hold-to-talk mic input
- [ ] Text input as always-available backup
- [ ] AI response displayed as text bubbles
- [ ] AI response spoken aloud via TTS auto-play
- [ ] Sound effects: send blip, receive chime
- [ ] Emoji picker for text input
- [ ] Dark amber theme matching workpad
- [ ] iPhone Max screen optimized (428pt wide)

### Interactions
- **Hold mic button** → recording, release → send
- **Tap mic button** → start recording, tap again → stop and send
- **Text input** → toggle with keyboard icon
- **Auto-scroll** → conversation scrolls to latest message
- **Haptic feedback** → light on send, stronger on AI response

---

## 5. UI Design

### Screen Layout — iPhone Max optimized (428×926pt)
```
┌──────────────────────────────────────┐
│  ░░░░░░░░░░ Status Bar ░░░░░░░░░░░░  │
├──────────────────────────────────────┤
│  🔒 Kai Channel          [⚙️] [☀️/🌙] │
├──────────────────────────────────────┤
│                                      │
│         🐅                           │
│       Kai                            │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ 🤖 Kai: Hey Rod, what can I    │  │
│  │    help you with today?        │  │
│  │                        10:32p │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ 🗣️ Rod: Let's plan the Chile  │  │
│  │    trip                        │  │
│  │                        10:33p │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ 🤖 Kai: I have your Chile trip │  │
│  │    notes here...               │  │
│  │                        10:33p │  │
│  │         🔊 [playing]          │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ 🗣️ Rod: [🎤 Recording...]     │  │
│  │                        10:34p │  │
│  └────────────────────────────────┘  │
│                                      │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │ 📝 Add a message...        😀 │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  ◉◉◉◉◉◉◉◉◉◉◉◉◉◉◉◉◉◉◉◉◉◉◉◉◉  │  │
│  │   [    🎤 TALK    ]   [Aa]    │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### Color Palette
```
--color-primary:       #c8922a   /* amber gold */
--color-primary-hover: #d4a017
--color-bg:            #1a1510   /* deep warm dark */
--color-surface:       #2a231c
--color-surface-alt:   #352e26
--color-text:          #faf8f4
--color-text-muted:   #a09080
--color-border:       #3d352c
--color-ai-bubble:   #2a231c
--color-human-bubble: #c8922a20
```

### Typography
- Font: System font stack (San Francisco on iOS)
- Kai name: 18px bold
- Bubbles: 16px, line-height 1.5
- Timestamps: 11px muted

### Sound Effects
- **Send**: short soft "pop" (200ms)
- **Receive**: gentle chime (400ms)
- **TTS start**: subtle fade-in indicator
- Generated via Web Audio API (no files needed)

### PWA Manifest
- `display: standalone`
- `orientation: portrait`
- Theme color: `#1a1510`
- Icons: 192×192, 512×512

---

## 6. Backend Design

### Endpoints

```
POST /api/voice/session
  Body: { token: string }
  Returns: { ok: true, token: string } or { error: string }

POST /api/voice/message
  Auth: Bearer <token>
  Body: FormData { audio?: Blob, text?: string }
  Returns: SSE stream
    event: transcript    → { text: string }
    event: token_used    → { token: string, messages_today: number }
    event: response      → { text: string }
    event: audio         → { base64: string, contentType: string }
    event: done          → {}
    event: error         → { message: string }

GET /api/voice/history
  Auth: Bearer <token>
  Returns: { messages: Message[] }
```

### Message Shape
```typescript
interface Message {
  id: string;
  role: "human" | "ai";
  body: string;
  audioUrl?: string;
  createdAt: string; // ISO
}
```

---

## 7. Project Structure

```
projects/voice-kai-channel/
  app/
    layout.tsx           # PWA shell, theme init
    page.tsx              # Main page (redirects to /channel)
    channel/
      page.tsx            # Main voice channel UI
    globals.css           # Theme variables + base styles
    manifest.json         # PWA manifest
    api/
      voice/
        session/
          route.ts        # POST /api/voice/session
        message/
          route.ts        # POST /api/voice/message (STT→LLM→TTS→SSE)
        history/
          route.ts        # GET /api/voice/history
  components/
    VoiceUI.tsx           # Main orchestrator
    MessageBubble.tsx     # Individual message
    TranscriptFeed.tsx   # Scroll area with messages
    TalkButton.tsx       # Mic hold/tap button
    Waveform.tsx         # Live audio visualization
    TextComposer.tsx    # Text input + emoji toggle
    EmojiPicker.tsx      # Lightweight emoji picker
    AudioIndicator.tsx   # TTS playing / recording indicator
    ThemeToggle.tsx      # Light/dark toggle
    Header.tsx           # Top bar
  lib/
    audio.ts              # MediaRecorder helpers
    tts.ts               # TTS playback (Web Audio API)
    sounds.ts             # Web Audio API sound effects
    api.ts               # Fetch wrapper with auth
    tokens.ts            # Token generation/retrieval
    types.ts              # Shared types
  public/
    icons/               # PWA icons
    sw.js                # Service worker
  next.config.ts
  package.json
```

---

## 8. Shared Code with Workpad

The following are copied/adapted from workpad (not imported, to keep clean separation):

- `lib/xai-client.ts` — STT + TTS API calls
- `lib/xai-stt.ts` — speech-to-text
- `lib/xai-tts.ts` — text-to-speech
- `lib/kai-bridge.ts` — Kai LLM prompt construction
- `lib/prompts.ts` — system prompts

Copied, not imported. Version-locked to today's workpad state.

---

## 9. Env Variables

```env
# Server
VOICE_PORT=3005
VOICE_TOKEN=rod-pre-shared-token   # Rod's pre-shared token
XAI_API_KEY=xai-...                # Existing key (reuse)
DB_PATH=./data/voice.db            # SQLite for message history (Phase 1 optional)

# xAI endpoints
XAI_STT_URL=https://api.x.ai/v1/audio/transcriptions
XAI_TTS_URL=https://api.x.ai/v1/audio/speech
XAI_CHAT_URL=https://api.x.ai/v1/chat/completions
```

---

## 10. Open Questions — RESOLVED

| Question | Resolution |
|---|---|
| Relationship to workpad | Completely separate — own codebase, own DB, own auth |
| Port | `:3005` |
| Auth | Token only (UUID in localStorage, pre-shared for Rod) |
| Wake word | Skip for now |
| Screen | iPhone Max optimized |
| Text backup | Always available via toggle |
| Emoji | Yes |
| Sounds | Yes (Web Audio API, no files) |
| Theme | Dark amber (matches workpad) |

---

## 11. Success Criteria

- [ ] PWA installs on iOS home screen
- [ ] Hold mic → speak → release → AI responds in <5s
- [ ] AI response plays as audio automatically
- [ ] Text input works as fallback
- [ ] Conversation visible with bubbles
- [ ] Emoji picker functional
- [ ] Sounds play on send/receive
- [ ] Dark amber theme applied
- [ ] No crashes, no 500 errors on core flow

---

## 11. Known Issues

### iOS Safari Voice Recording
iOS Safari's MediaRecorder may not capture valid audio. Symptoms: mic permission granted, "Recording..." shows, but no audio sent to server → Kai shows "Error: No audio" or "Error: Request failed".

**Workaround**: Use text input (`Aa` button) — fully functional.

**Status**: Root cause investigation ongoing. Server-side STT pipeline verified working with WAV input. Client-side MediaRecorder on iOS Safari is the likely failure point.

## 12. Cloudflare Tunnel

Quick tunnel URL (ephemeral, changes on restart):
```
https://occurs-strange-sri-handle.trycloudflare.com/channel
```

Permanent tunnel: requires free Cloudflare account + named tunnel. Run `./start-tunnel.sh` to restart.
