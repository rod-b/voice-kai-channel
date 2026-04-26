let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];

// iOS Safari supports audio/mp4, while Chromium prefers audio/webm.
function getSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;

  const types = [
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
  ];

  return types.find((type) => MediaRecorder.isTypeSupported(type));
}

// No-op stub — kept for future reference
function safeMimeType(): string | undefined { return undefined; }

export async function startRecording(): Promise<void> {
  if (!window.isSecureContext) {
    throw new Error("Microphone access requires localhost or HTTPS. Use http://localhost:3005 on this Mac, or the HTTPS tunnel on iPhone.");
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not expose microphone capture here. Check browser permissions or try Safari/Chrome.");
  }

  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser does not support MediaRecorder audio capture.");
  }

  // Log all available audio input devices for diagnostics
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((d) => d.kind === "audioinput");
    console.log("[audio] Available audio input devices:", audioInputs.map((d) => ({
      deviceId: d.deviceId,
      label: d.label || "(no label — permission not granted)",
      groupId: d.groupId,
    })));
  } catch (e) {
    console.warn("[audio] Could not enumerate devices:", e);
  }

  let stream: MediaStream;

  // Strategy 1 — try empty constraints first (browser picks system default)
  console.log("[audio] step 1: navigator.mediaDevices.getUserMedia({ audio: true })");
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("[audio] getUserMedia SUCCESS, stream id:", stream.id, "active:", stream.active, "#tracks:", stream.getTracks().length);
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    const message = err instanceof Error ? err.message : String(err);
    console.error("[audio] getUserMedia FAILED:", name, message, err);
    const isConstraintError =
      name === "OverconstrainedError" ||
      name === "ConstraintNotSatisfiedError" ||
      /constraint/i.test(message);

    if (!isConstraintError) throw err;

    // Strategy 2 — enumerate devices and try each one explicitly (without 'exact' constraint)
    console.warn("[audio] getUserMedia(audio:true) overconstrained; trying per-device fallback", err);
    let fallbackStream: MediaStream | null = null;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      console.log("[audio] Devices for fallback:", audioInputs.map((d) => `${d.label || d.deviceId}`));
      for (const device of audioInputs) {
        try {
          console.log("[audio] Trying device:", device.label || device.deviceId);
          fallbackStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: device.deviceId },
          });
          console.log("[audio] Device succeeded:", device.deviceId);
          break;
        } catch (deviceErr) {
          console.warn("[audio] Device failed:", device.deviceId, deviceErr);
        }
      }
    } catch (e) {
      console.warn("[audio] Per-device fallback enumerate failed:", e);
    }

    if (fallbackStream) {
      stream = fallbackStream;
    } else {
      // Strategy 3 — try with all constraints explicitly disabled
      console.warn("[audio] Trying with all audio constraints as ideal:false", err);
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    }
  }

  try {
    audioChunks = [];
    let mimeType = getSupportedMimeType();
    console.log("[audio] step 2: new MediaRecorder(stream, opts) mimeType:", mimeType || "browser default");
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    console.log("[audio] MediaRecorder created, state:", mediaRecorder.state, "mimeType:", mediaRecorder.mimeType);
    mediaRecorder.onerror = (e: Event) => {
      console.error("[audio] recorder error event:", e);
    };
    try {
      console.log("[audio] step 3: mediaRecorder.start(250)...");
      // Use timeslice=250ms so ondataavailable fires every 250ms automatically,
      // guaranteeing we get data even if stop() is called before requestData().
      mediaRecorder.start(250);
      console.log("[audio] mediaRecorder.start() succeeded, state:", mediaRecorder.state);
      mediaRecorder.ondataavailable = (e) => {
        console.log(`[audio] ondataavailable size=${e.data.size} type=${e.data.type}`);
        if (e.data.size > 0) audioChunks.push(e.data);
      };
    } catch (startErr) {
      console.warn("[audio] mediaRecorder.start() FAILED:", startErr, "— retrying without mimeType", startErr);
      try {
        mediaRecorder = new MediaRecorder(stream);
        console.log("[audio] retry: new MediaRecorder(stream), state:", mediaRecorder.state, "mimeType:", mediaRecorder.mimeType);
        mediaRecorder.start(250);
        console.log("[audio] retry start() succeeded, state:", mediaRecorder.state);
        mediaRecorder.ondataavailable = (e) => {
          console.log(`[audio] ondataavailable size=${e.data.size} type=${e.data.type}`);
          if (e.data.size > 0) audioChunks.push(e.data);
        };
      } catch {
        console.error("[audio] retry start() also failed, stopping stream tracks");
        stream.getTracks().forEach((t) => t.stop());
        throw startErr;
      }
    }
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    console.error("[audio] recorder setup FAILED:", err);
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
        try { mediaRecorder.requestData(); } catch {}
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
