import test from 'node:test';
import assert from 'node:assert/strict';

let Processor;
globalThis.sampleRate=44100;
globalThis.AudioWorkletProcessor=class { constructor(){this.port={messages:[],postMessage(data){this.messages.push(data);}};} };
globalThis.registerProcessor=(name,processor)=>{assert.equal(name,'airdeck-track');Processor=processor;};
await import('../src/audio-processor.js');
const send=(node,data)=>node.port.onmessage({data});
function nodeFor(seconds=.5) {
  const node=new Processor();
  const channel=Float32Array.from({length:Math.round(44100*seconds)},(_,i)=>Math.sin(i/44100*440*Math.PI*2)*.4);
  send(node,{type:'load',channels:[channel],revision:3});return node;
}
function step(node){const out=[new Float32Array(128),new Float32Array(128)];assert.equal(node.process([],[out]),true);return out;}
test('worklet pauses, resumes, emits audio, and reports end with the load revision',()=>{
  const node=nodeFor();assert.ok(step(node)[0].every(v=>v===0));
  send(node,{type:'play'});let audible=false;
  for(let i=0;i<200;i++) {const out=step(node);audible ||= out[0].some(v=>Math.abs(v)>.01);assert.deepEqual(out[0],out[1]);}
  assert.ok(audible);assert.equal(node.playing,false);assert.ok(node.port.messages.some(m=>m.type==='ended'&&m.revision===3));
  send(node,{type:'seek',position:.2});send(node,{type:'play'});assert.equal(node.playing,true);
  send(node,{type:'pause'});assert.ok(step(node)[0].every(v=>v===0));
});
test('looping resets inside the audio thread, without ending or a silent round trip',()=>{
  const node=nodeFor();send(node,{type:'loop',enabled:true});send(node,{type:'play'});
  for(let i=0;i<500;i++)step(node);
  assert.equal(node.playing,true);assert.ok(node.track.position<.5);assert.equal(node.port.messages.filter(m=>m.type==='ended').length,0);
  send(node,{type:'settings',tempo:1.2,pitch:7});assert.equal(node.track.tempo,1.2);assert.equal(node.track.pitch,7);
});
