import { v4 as uuidv4 } from "uuid";

const TOKEN_KEY = "kai-voice-token";

export function getOrCreateToken(): string {
  if (typeof window === "undefined") return "";
  try {
    let token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      token = uuidv4();
      localStorage.setItem(TOKEN_KEY, token);
    }
    return token;
  } catch {
    return uuidv4();
  }
}
