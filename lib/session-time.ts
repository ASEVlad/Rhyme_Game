export type AudioLike = { currentTime: number; duration: number };

export function makeSessionTimer(audio: AudioLike): () => number {
  let loops = 0;
  let lastT = audio.currentTime;
  return () => {
    const t = audio.currentTime;
    // Treat a drop of more than half a second as a wraparound; smaller drops are jitter.
    if (t < lastT - 0.5) loops += 1;
    lastT = t;
    const dur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    return loops * dur + t;
  };
}
