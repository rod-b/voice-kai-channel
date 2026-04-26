# Voice Session Context and Conversation Export

## What it does

Kai Channel now keeps an in-memory conversation for the active browser session. Each new text or voice turn sends the prior conversation history to `/api/voice/message`, and the API includes that history when requesting Kai's response.

A session continues until Rod clears it or the browser has been inactive for 30 minutes. After 30 minutes of inactivity, the next message starts a fresh context.

Voice messages now show Rod's transcription in the human chat bubble once transcription completes, replacing the temporary `🎤 Voice message` placeholder.

## How to use it

- Talk or type normally in `/channel`.
- Use **Save conversation** in the header to download the current transcript as Markdown.
- Use **Clear** in the header to end the current session and remove the local transcript/context.

Downloaded files use this filename pattern:

```text
conversation-YYYY-MM-DD-HHMMSS.md
```

The download is browser-local only; no server-side transcript storage is added.

## Configuration

No new environment variables are required.

The API accepts an optional `conversationHistory` form field containing a JSON array of prior messages:

```json
[
  { "role": "human", "body": "What did we decide?", "createdAt": "2026-04-26T20:00:00.000Z" },
  { "role": "ai", "body": "We decided to keep it simple.", "createdAt": "2026-04-26T20:00:03.000Z" }
]
```

The server validates the array, trims empty messages, caps context to the latest 20 turns, maps `human` to `user`, and maps `ai` to `assistant` for the chat completion request.
