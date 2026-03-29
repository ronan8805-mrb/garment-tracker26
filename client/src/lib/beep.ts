let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

async function ensureAudioReady() {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume().catch(() => {});
  }
}

function playTone(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.3) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available on this device
  }
}

/** Short click — plays on every barcode read / Enter (before result). */
export async function beepScan() {
  await ensureAudioReady();
  playTone(720, 0.06, "sine", 0.35);
}

export function beepSuccess() {
  playTone(880, 0.15, "sine", 0.4);
}

export function beepDuplicate() {
  playTone(300, 0.12, "square", 0.25);
  setTimeout(() => playTone(300, 0.12, "square", 0.25), 150);
}

export function beepError() {
  playTone(200, 0.3, "sawtooth", 0.25);
}
