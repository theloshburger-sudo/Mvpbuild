// Tiny synthesized sound effects: no audio files to load.

let ctx: AudioContext | null = null
let muted = (() => {
  try {
    return localStorage.getItem('psych.muted') === '1'
  } catch {
    return false
  }
})()

// Browsers only allow audio after a user gesture, so unlock on the first tap.
if (typeof window !== 'undefined') {
  const unlock = () => {
    try {
      ctx ??= new AudioContext()
      void ctx.resume()
    } catch {
      /* no audio support */
    }
  }
  window.addEventListener('pointerdown', unlock, { capture: true })
  window.addEventListener('keydown', unlock, { capture: true })
}

export const isMuted = () => muted
export function setMuted(m: boolean) {
  muted = m
  try {
    localStorage.setItem('psych.muted', m ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.18, slideTo?: number) {
  if (!ctx || muted) return
  const t = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

const buzz = (ms: number | number[]) => {
  if (!muted) navigator.vibrate?.(ms)
}

export const sfx = {
  tap: () => tone(660, 0, 0.08, 'triangle', 0.12),
  submit: () => {
    tone(523, 0, 0.1, 'triangle')
    tone(784, 0.08, 0.14, 'triangle')
  },
  newRound: () => {
    tone(330, 0, 0.25, 'sawtooth', 0.06, 660)
    buzz(30)
  },
  vote: () => tone(440, 0, 0.18, 'square', 0.06, 880),
  tick: () => tone(1000, 0, 0.05, 'square', 0.05),
  fooled: () => {
    tone(392, 0, 0.12, 'triangle')
    tone(311, 0.1, 0.22, 'triangle')
    buzz(40)
  },
  nobody: () => tone(220, 0, 0.12, 'sine', 0.08),
  truth: () => {
    for (const [i, f] of [523, 659, 784, 1047].entries()) tone(f, i * 0.09, 0.3, 'triangle', 0.14)
    buzz([60, 40, 60])
  },
  win: () => {
    for (const [i, f] of [523, 659, 784, 659, 784, 1047].entries()) tone(f, i * 0.12, 0.35, 'triangle', 0.16)
    buzz([80, 60, 80, 60, 160])
  },
}
