let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];

// iOS Safari supports audio/mp4, not audio/webm
function getSupportedMimeType(): string {
  const types = [
    "audio/mp4",
    "audio/mpeg",
    "audio/aac",
    "audio/webm;codecs=opus",
    "audio/webm",
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "audio/mp4"; // fallback
}

export async function startRecording(): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    audioChunks = [];
    const mimeType = getSupportedMimeType();
    console.log("[audio] Using MIME type:", mimeType);
    mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.start(100);
  } catch (err) {
    console.error("[audio] getUserMedia failed:", err);
    throw err;
  }
}

export function onRecordingData(cb: (blob: Blob) => void) {
  if (!mediaRecorder) return;
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) cb(e.data);
  };
}

export async function stopRecording(): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!mediaRecorder) return resolve(null);

    const mimeType = mediaRecorder.mimeType || "audio/mp4";

    // Timeout fallback — always resolves within 3s max
    const timer = setTimeout(() => {
      try { mediaRecorder?.stop(); } catch {}
    }, 3000);

    mediaRecorder.onstop = () => {
      clearTimeout(timer);
      const blob = new Blob(audioChunks, { type: mimeType });
      mediaRecorder?.stream.getTracks().forEach((t) => t.stop());
      mediaRecorder = null;
      audioChunks = [];
      resolve(blob.size > 0 ? blob : null);
    };

    try {
      if (mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      } else {
        clearTimeout(timer);
        mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        mediaRecorder = null;
        audioChunks = [];
        resolve(null);
      }
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

export function isRecording(): boolean {
  return mediaRecorder?.state === "recording";
}
