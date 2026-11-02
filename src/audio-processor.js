import { TrackProcessor } from './dsp.js';

class DeckProcessor extends AudioWorkletProcessor {
  constructor() {
    super(); this.playing=false; this.tempo=1; this.pitch=0; this.tick=0; this.revision=0;
    this.samples=new Float32Array(256);
    this.port.onmessage=({data})=>{
      if(data.type==='load') { this.revision=data.revision; this.channels=data.channels;this.playing=false;this.rebuild(0); }
      if(data.type==='play')this.playing=!!this.track;
      if(data.type==='pause')this.playing=false;
      if(data.type==='loop')this.loop=data.enabled;
      if(data.type==='seek'&&this.track)this.rebuild(data.position);
      if(data.type==='settings') { this.tempo=data.tempo;this.pitch=data.pitch;this.track?.set(this.tempo,this.pitch); }
    };
  }
  rebuild(position) { this.track=new TrackProcessor(this.channels,sampleRate,position,this.tempo,this.pitch); }
  process(inputs,outputs) {
    const output=outputs[0]; if(!this.playing||!this.track||!output?.length)return true;
    const frames=output[0].length;
    if(this.samples.length!==frames*2)this.samples=new Float32Array(frames*2);
    try {
      let cursor=0;
      while(cursor<frames&&this.playing) {
        const extracted=this.track.render(this.samples,frames-cursor);
        for(let i=0;i<extracted;i++) { output[0][cursor+i]=this.samples[i*2]; if(output[1])output[1][cursor+i]=this.samples[i*2+1]; }
        cursor+=extracted;
        if(!extracted) {
          if(this.loop)this.rebuild(0);
          else { this.playing=false;this.port.postMessage({type:'ended',revision:this.revision}); }
        }
      }
      if((this.tick++%32)===0)this.port.postMessage({type:'position',position:this.track.position,revision:this.revision});
    } catch(error) { this.playing=false;this.port.postMessage({type:'error',message:error.message,revision:this.revision}); }
    return true;
  }
}
registerProcessor('airdeck-track',DeckProcessor);
