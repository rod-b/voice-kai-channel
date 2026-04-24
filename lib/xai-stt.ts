import { getXaiConfig, xaiFetch } from "@/lib/xai-client";

export async function transcribeAudio(file: Blob, filename = "audio.webm") {
  const config = getXaiConfig();

  if (config.stubsEnabled && !config.apiKey) {
    return {
      text: "[stub transcript] xAI API key not configured yet.",
      duration: 0,
      language: config.language,
      stub: true,
    };
  }

  const form = new FormData();
  form.append("language", config.language);
  form.append("format", "true");
  form.append("file", file, filename);

  const response = await xaiFetch("/v1/stt", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(`xAI STT failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}
