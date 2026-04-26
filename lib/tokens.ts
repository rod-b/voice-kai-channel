import { v4 as uuidv4 } from "uuid";

const TOKEN_KEY = "kai-voice-token";
const DEFAULT_TOKEN = process.env.NEXT_PUBLIC_DEFAULT_VOICE_TOKEN || "";

export function getOrCreateToken(): string {
  if (typeof window === "undefined") return "";
  try {
    let token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      token = DEFAULT_TOKEN || uuidv4();
      localStorage.setItem(TOKEN_KEY, token);
    }
    return token;
  } catch {
    return DEFAULT_TOKEN || uuidv4();
  }
}
