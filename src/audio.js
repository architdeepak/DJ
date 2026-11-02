import processorURL from './audio-processor.js?worker&url';
import { clamp, crossfadeGains } from './math.js';

export class Mixer {
  constructor() { this.decks = []; this.crossfade = .5; this.recording = false; }
  async init() {
    if (!this.context) {
      const ctx = this.context = new AudioContext();
      try { await ctx.audioWorklet.addModule(processorURL); }
      catch(error) { await ctx.close(); this.context=null; throw error; }
      this.master = ctx.createGain(); this.master.gain.value = .75;
      this.limiter = ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -3; this.limiter.knee.value = 6; this.limiter.ratio.value = 12;
      this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 256;
      this.recordDestination = ctx.createMediaStreamDestination();
      this.master.connect(this.limiter); this.limiter.connect(this.analyser);
      this.analyser.connect(ctx.destination); this.limiter.connect(this.recordDestination);
      this.decks = [new Deck(this, 0), new Deck(this, 1)];
      this.setCrossfade(this.crossfade);
    }
    await this.context.resume();
    return this;
  }
  setCrossfade(value) {
    this.crossfade = clamp(value);
    crossfadeGains(this.crossfade).forEach((gain, i) => this.decks[i]?.fade.gain.setTargetAtTime(gain, this.context.currentTime, .025));
  }
  setMaster(value) { if (this.master) this.master.gain.setTargetAtTime(value, this.context.currentTime, .02); }
  startRecording(onStop) {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    const mimeType = types.find(t => MediaRecorder.isTypeSupported(t));
    this.recorder = new MediaRecorder(this.recordDestination.stream, mimeType ? { mimeType } : {});
    const chunks = [];
    this.recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    this.recorder.onstop = () => onStop(new Blob(chunks, { type: this.recorder.mimeType }));
    this.recorder.start(1000); this.recording = true;
  }
  stopRecording() { if (this.recording) { this.recorder.stop(); this.recording = false; } }
}

export class Deck {
  constructor(mixer, index) {
    this.mixer = mixer; this.index = index; this.ctx = mixer.context;
    this.volume = .8; this.tempo = 1; this.pitch = 0; this.effect = 0;
    this.playing = false; this.loop = false; this.position = 0; this.loadId = 0;
    const ctx = this.ctx;
    this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 20000;
    this.gain = ctx.createGain(); this.gain.gain.value = this.volume;
    this.fade = ctx.createGain();
    this.delay = ctx.createDelay(2); this.delay.delayTime.value = .375;
    this.feedback = ctx.createGain(); this.feedback.gain.value = .28;
    this.wet = ctx.createGain(); this.wet.gain.value = 0;
    this.filter.connect(this.gain); this.filter.connect(this.delay);
    this.delay.connect(this.feedback); this.feedback.connect(this.delay);
    this.delay.connect(this.wet); this.wet.connect(this.gain);
    this.gain.connect(this.fade); this.fade.connect(mixer.master);
    this.node = new AudioWorkletNode(ctx, 'airdeck-track', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
    this.node.connect(this.filter);
    this.revision=0;
    this.node.port.onmessage=({data})=>{
      if(data.revision!==this.revision)return;
      if(data.type==='position'&&this.playing)this.position=data.position;
      if(data.type==='ended') {
        this.playing=false;this.position=this.buffer.duration;
        if(this.loop){this.seek(0);this.play();}
        this.onChange?.();
      }
      if(data.type==='error'){this.playing=false;this.onError?.(data.message);this.onChange?.();}
    };
  }
  async load(track, arrayBuffer) {
    const request = ++this.loadId;
    const buffer = arrayBuffer instanceof AudioBuffer ? arrayBuffer : await this.ctx.decodeAudioData(arrayBuffer);
    if (request !== this.loadId) return false;
    if (!buffer.length) throw new Error('This audio file is empty.');
    this.pause(); this.buffer = buffer; this.track = track; this.position = 0;
    this.revision++;
    const channels=Array.from({length:Math.min(2,buffer.numberOfChannels)},(_,i)=>buffer.getChannelData(i).slice());
    this.node.port.postMessage({type:'load',channels,revision:this.revision},channels.map(c=>c.buffer));
    this.updateSettings();
    this.peaks = waveformPeaks(buffer);
    return true;
  }
  updateSettings() { this.node.port.postMessage({type:'settings',tempo:this.tempo,pitch:this.pitch}); }
  get loop() { return this._loop; }
  set loop(enabled) { this._loop=enabled;this.node?.port.postMessage({type:'loop',enabled}); }
  async play() {
    if (!this.buffer || this.playing) return;
    this.playing = true;
    try { await this.ctx.resume(); }
    catch(error) { this.playing=false;throw error; }
    if(!this.playing)return;
    if (this.position >= this.buffer.duration - .1) this.seek(0);
    this.node.port.postMessage({type:'play'});
  }
  pause() { this.node.port.postMessage({type:'pause'}); this.playing = false; }
  seek(fraction) {
    if (!this.buffer) return;
    this.position = clamp(fraction, 0, .999) * this.buffer.duration;
    this.node.port.postMessage({type:'seek',position:this.position});
  }
  set(param, value) {
    if (param === 'volume') { this.volume = clamp(value); this.gain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, .03); }
    if (param === 'tempo') { this.tempo = clamp(value, .65, 1.35); this.updateSettings(); }
    if (param === 'pitch') { this.pitch = clamp(value, -12, 12); this.updateSettings(); }
    if (param === 'effect') {
      this.effect = clamp(value);
      this.wet.gain.setTargetAtTime(this.effect * .65, this.ctx.currentTime, .03);
      this.filter.frequency.setTargetAtTime(20000 * (.025 ** this.effect), this.ctx.currentTime, .03);
    }
  }
}

export function waveformPeaks(buffer, count = 180) {
  const samples = buffer.getChannelData(0), step = Math.max(1, Math.floor(samples.length / count));
  return Array.from({ length: count }, (_, i) => {
    let peak = 0;
    for (let j = i * step; j < Math.min((i + 1) * step, samples.length); j += 16) peak = Math.max(peak, Math.abs(samples[j]));
    return peak;
  });
}

// Original, deterministic instrumentals. No network or licensed recordings required.
export function createDemo(ctx, variant = 0) {
  const bpm = variant ? 124 : 120, beat = 60 / bpm, duration = beat * 64, rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(2, Math.ceil(duration * rate), rate);
  const root = variant ? 110 : 130.8128;
  const notes = [0, 0, 7, 10, 0, 3, 7, 5];
  let seed = 1927 + variant;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
  const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
  for (let i = 0; i < buffer.length; i++) {
    const t = i / rate, b = t / beat, phase = t % beat;
    const kick = Math.sin(2 * Math.PI * (48 * phase + 8 * (1 - Math.exp(-phase * 35)))) * Math.exp(-phase * 17) * .65;
    const hatPhase = t % (beat / 2), noise = random();
    const hat = noise * Math.exp(-hatPhase * 160) * .13;
    const snarePhase = t % (beat * 2) - beat;
    const snare = snarePhase >= 0 ? noise * Math.exp(-snarePhase * 28) * .23 : 0;
    const note = notes[Math.floor(b / 2) % notes.length];
    const freq = root / 2 * 2 ** (note / 12);
    const bass = (Math.sin(t * freq * 2 * Math.PI) + .2 * Math.sin(t * freq * 4 * Math.PI)) * .22 * Math.min(1, phase * 40) * Math.exp(-phase * 3);
    const arpPhase = t % (beat / 2), arpFreq = root * 2 ** ((notes[Math.floor(b * 2) % 8] + 12) / 12);
    const arp = Math.sin(t * arpFreq * 2 * Math.PI) * Math.exp(-arpPhase * 13) * .11;
    const fade = Math.min(1, t * 5, (duration - t) * 8);
    left[i] = (kick + hat + snare + bass + arp) * fade * .72;
    right[i] = (kick + hat + snare + bass + arp * .78) * fade * .72;
  }
  return buffer;
}
