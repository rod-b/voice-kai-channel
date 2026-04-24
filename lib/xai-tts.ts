import { getXaiConfig, xaiFetch } from "@/lib/xai-client";

export function isVoiceDisabled(voice?: string | null) {
  return !voice || voice === "none";
}

export async function synthesizeSpeech(text: string, voice?: string) {
  const config = getXaiConfig();
  const selectedVoice = voice || config.defaultVoice;

  if (isVoiceDisabled(selectedVoice)) {
    return {
      contentType: "audio/mpeg",
      audioBase64: "",
      stub: false,
      voice: selectedVoice,
      disabled: true,
    };
  }

  if (config.stubsEnabled && !config.apiKey) {
    return {
      contentType: "audio/mpeg",
      audioBase64: "",
      stub: true,
      voice: selectedVoice,
      disabled: false,
    };
  }

  const response = await xaiFetch("/v1/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice_id: selectedVoice,
      language: config.language,
      output_format: {
        codec: "mp3",
        sample_rate: 24000,
        bit_rate: 128000,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`xAI TTS failed: ${response.status} ${await response.text()}`);
  }

  const contentType = response.headers.get("content-type") || "audio/mpeg";
  const buffer = Buffer.from(await response.arrayBuffer());

  return {
    contentType,
    audioBase64: buffer.toString("base64"),
    stub: false,
    voice: selectedVoice,
    disabled: false,
  };
}
