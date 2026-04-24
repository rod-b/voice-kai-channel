export interface Message {
  id: string;
  role: "human" | "ai";
  body: string;
  audioUrl?: string;
  createdAt: string;
}

export interface VoiceSession {
  token: string;
  ok: boolean;
}

export interface StreamEvent {
  type: "transcript" | "token_used" | "response" | "audio" | "done" | "error";
  data: Record<string, unknown>;
}
