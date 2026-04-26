// Web Audio API sound effects — no files needed
// Single shared AudioContext so Safari's autoplay unlock on first user click
// propagates to all audio playback in the app.
let ctx: AudioContext | null = null;

export function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function playSendSound() {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, c.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.15);
  } catch {}
}

export function playReceiveSound() {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = "sine";
    // Two-tone chime
    osc.frequency.setValueAtTime(660, c.currentTime);
    gain.gain.setValueAtTime(0.12, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.12);
  } catch {}
}

let currentAudio: HTMLAudioElement | null = null;
let activeSource: AudioBufferSourceNode | null = null;

export function playBase64Audio(base64: string, contentType: string) {
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if (activeSource) {
      try { activeSource.stop(); } catch {}
      activeSource = null;
    }
    const data = `data:${contentType};base64,${base64}`;
    const audio = new Audio(data);
    currentAudio = audio;

    // First try: HTMLAudioElement (works in most browsers)
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        // HTMLAudioElement playback succeeded
      }).catch((e) => {
        console.warn("[audio] HTMLAudioElement play blocked, trying Web Audio API:", e);
        // Fallback: decode and play via Web Audio API
        tryDecodeAndPlay(base64, contentType);
      });
    }
    return audio;
  } catch (e) {
    console.error("[audio] playBase64Audio error:", e);
    return null;
  }
}

function tryDecodeAndPlay(base64: string, contentType: string) {
  const c = getCtx();
  if (c.state === "suspended") {
    c.resume().then(() => decodeAndPlay(base64, contentType, c)).catch(() => {});
  } else {
    decodeAndPlay(base64, contentType, c);
  }
}

function decodeAndPlay(base64: string, contentType: string, ctx: AudioContext) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  ctx.decodeAudioData(bytes.buffer, (buffer) => {
    if (activeSource) { try { activeSource.stop(); } catch {} }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    activeSource = source;
  }, (e) => {
    console.error("[audio] decodeAudioData failed:", e);
  });
}

export function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (activeSource) {
    try { activeSource.stop(); } catch {}
    activeSource = null;
  }
}
