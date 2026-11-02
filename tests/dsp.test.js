import test from 'node:test';
import assert from 'node:assert/strict';
import { TrackProcessor } from '../src/dsp.js';

const rate=44100;
function sine(seconds=2,freq=440){return Float32Array.from({length:Math.round(rate*seconds)},(_,i)=>Math.sin(i/rate*freq*Math.PI*2)*.5);}
function render(tempo=1,pitch=0,position=0,channels=[sine()]) {
  const processor=new TrackProcessor(channels,rate,position,tempo,pitch),scratch=new Float32Array(256),output=[];
  let total=0;
  for(let block=0;block<2000;block++) {
    const extracted=processor.render(scratch,128);if(!extracted)break;
    for(let i=0;i<extracted;i++){assert.ok(Number.isFinite(scratch[i*2]));output.push(scratch[i*2]);}
    total+=extracted;
  }
  assert.ok(total<2000*128,'processor must reach end of track');
  return {processor,output,total};
}
function frequency(samples){let count=0;const start=10000,end=Math.min(45000,samples.length);for(let i=start+1;i<end;i++)if(samples[i-1]<=0&&samples[i]>0)count++;return count/((end-start)/rate);}
test('real DSP renders finite, non-silent stereo samples and finishes',()=>{
  const {output,processor}=render();assert.ok(output.some(v=>Math.abs(v)>.1));assert.equal(processor.position,2);assert.ok(Math.abs(frequency(output)-440)<4);
});
test('speed changes duration while retaining musical pitch',()=>{
  const normal=render(),fast=render(1.3),slow=render(.7);
  assert.ok(fast.total<normal.total*.85);assert.ok(slow.total>normal.total*1.3);
  assert.ok(Math.abs(frequency(fast.output)-440)<5);assert.ok(Math.abs(frequency(slow.output)-440)<5);
});
test('pitch shifts by one octave without changing playback duration',()=>{
  const normal=render(),higher=render(1,12),lower=render(1,-12);
  assert.ok(Math.abs(frequency(higher.output)-880)<8);assert.ok(Math.abs(frequency(lower.output)-220)<5);
  assert.ok(Math.abs(higher.total-normal.total)<rate*.15);assert.ok(Math.abs(lower.total-normal.total)<rate*.15);
});
test('seek begins at requested source position and mono audio is supported',()=>{
  const {processor,total}=render(1,0,1);assert.equal(processor.position,2);assert.ok(total<rate*1.5);
});
