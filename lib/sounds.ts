// Web Audio API sound effects — no files needed

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
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

export function playBase64Audio(base64: string, contentType: string) {
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    const data = `data:${contentType};base64,${base64}`;
    const audio = new Audio(data);
    currentAudio = audio;
    audio.play().catch(console.error);
    return audio;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}
