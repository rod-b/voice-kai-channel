import { NextRequest } from "next/server";
import { getAiReply } from "@/lib/kai-bridge";
import { transcribeAudio } from "@/lib/xai-stt";
import { synthesizeSpeech } from "@/lib/xai-tts";
import { getXaiConfig } from "@/lib/xai-client";

const encoder = new TextEncoder();

function sseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function sseData(data: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  const allowed = process.env.VOICE_TOKEN || "rod-voice-token";

  if (!token || token !== allowed) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (bytes: Uint8Array) => controller.enqueue(bytes);

      try {
        // Parse form data
        const formData = await req.formData();
        const audioBlob = formData.get("audio") as Blob | null;
        const textInput = formData.get("text") as string | null;
        const voice = (formData.get("voice") as string | null) || undefined;

        let userMessage = "";

        // STT if audio provided
        if (audioBlob && audioBlob.size > 0) {
          send(sseEvent("status", { text: "🎙️ Transcribing..." }));
          const text = await transcribeAudio(audioBlob, "audio.webm");
          userMessage = text;
          send(sseEvent("transcript", { text }));
        } else if (textInput) {
          userMessage = textInput.trim();
        }

        if (!userMessage) {
          send(sseEvent("error", { message: "No audio or text provided" }));
          controller.close();
          return;
        }

        send(sseData({ type: "response_start" }));

        // Get AI reply
        send(sseEvent("status", { text: "🤖 Kai is thinking..." }));
        const reply = await getAiReply({
          humanMessage: userMessage,
          userName: "Rod",
          continuitySummaries: [],
        });

        send(sseEvent("response", { text: reply }));

        // TTS
        const config = getXaiConfig();
        if (!config.autoSpeak) {
          send(sseData({ type: "done" }));
          controller.close();
          return;
        }

        send(sseEvent("status", { text: "🔊 Speaking..." }));
        const speech = await synthesizeSpeech(reply, voice);

        if (speech.audioBase64 && speech.contentType) {
          send(sseEvent("audio", { base64: speech.audioBase64, contentType: speech.contentType }));
        }

        send(sseData({ type: "done" }));
      } catch (err) {
        console.error("[voice/message]", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        send(sseEvent("error", { message: errMsg }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
