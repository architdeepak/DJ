import { SoundTouch, SimpleFilter } from 'soundtouchjs';

// Shared by the audio worklet and deterministic signal-processing tests.
export class TrackProcessor {
  constructor(channels, rate, position = 0, tempo = 1, pitch = 0) {
    this.channels = channels; this.rate = rate; this.length = channels[0].length;
    this.soundtouch = new SoundTouch();
    this.soundtouch.tempo = tempo; this.soundtouch.pitch = 2 ** (pitch / 12);
    this.filter = new SimpleFilter({ extract: (target, count, offset) => {
      const available = Math.max(0, Math.min(count, this.length + 16384 - offset));
      const left = channels[0], right = channels[1] || left;
      for (let i=0; i<available; i++) { target[i*2] = left[offset+i] || 0; target[i*2+1] = right[offset+i] || 0; }
      return available;
    } }, this.soundtouch);
    this.filter.sourcePosition = Math.floor(position * rate);
    this.position = position; this.tempo = tempo; this.pitch = pitch;
  }
  set(tempo, pitch) {
    this.tempo = tempo; this.pitch = pitch;
    this.soundtouch.tempo = tempo; this.soundtouch.pitch = 2 ** (pitch / 12);
  }
  render(target, frames) {
    const remaining = Math.max(0,Math.ceil((this.length / this.rate-this.position)*this.rate/this.tempo-1e-7));
    if(!remaining)return 0;
    const extracted = this.filter.extract(target, Math.min(frames,remaining));
    this.position = Math.min(this.length / this.rate, this.position + extracted * this.tempo / this.rate);
    return extracted;
  }
}
