declare module 'music-tempo' {
  export default class MusicTempo {
    constructor(audioData: Float32Array, options?: Record<string, unknown>);
    tempo: number;
    beats: number[];
  }
}
