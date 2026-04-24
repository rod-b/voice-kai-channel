const XAI_BASE_URL = process.env.XAI_BASE_URL || "https://api.x.ai";

export function getXaiConfig() {
  return {
    baseUrl: XAI_BASE_URL.replace(/\/$/, ""),
    apiKey: process.env.XAI_API_KEY || "",
    defaultVoice: process.env.KAI_VOICE_DEFAULT || "ara",
    language: process.env.KAI_VOICE_LANGUAGE || "en",
    stubsEnabled: (process.env.KAI_VOICE_ENABLE_STUBS || "true").toLowerCase() === "true",
    autoSpeak: (process.env.KAI_VOICE_AUTO_SPEAK || "true").toLowerCase() === "true",
  };
}

export function assertXaiApiKey() {
  const config = getXaiConfig();
  if (!config.apiKey) {
    throw new Error("XAI_API_KEY is not configured");
  }
  return config;
}

export async function xaiFetch(path: string, init: RequestInit = {}) {
  const config = assertXaiApiKey();
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      ...(init.headers || {}),
    },
  });
  return response;
}
