import test from 'node:test';
import assert from 'node:assert/strict';
import { GestureCamera } from '../src/gestures.js';

function points(x,pinch=true){const p=Array.from({length:21},()=>({x,y:.5}));p[0]={x,y:.9};p[9]={x,y:.5};p[8]={x,y:.3};p[4]={x:x+(pinch?.03:.25),y:.3};return p;}
function setup(){const calls=[],ctx=new Proxy({},{get:()=>()=>{}});const camera=new GestureCamera({videoWidth:960,videoHeight:540},{getContext:()=>ctx},(...args)=>calls.push(args),()=>{});return {camera,calls};}
function result(hands){return {landmarks:hands.map(h=>points(h[1],h[2])),handedness:hands.map(h=>[{categoryName:h[0]}])};}
test('deck selection stays locked until the pinch is released',()=>{
  const {camera,calls}=setup();camera.mode='volume';
  camera.process(result([['Left',.8,true]]));assert.equal(calls.at(-1)[1],0);
  camera.process(result([['Left',.1,true]]));assert.equal(calls.at(-1)[1],0);
  camera.process(result([['Left',.1,false]]));const count=calls.length;
  camera.process(result([['Left',.1,false]]));assert.equal(calls.length,count);
  camera.process(result([['Left',.1,true]]));assert.equal(calls.at(-1)[1],1);
});
test('crossfader ownership survives changes in hand detection order',()=>{
  const {camera,calls}=setup();camera.process(result([['Left',.8,true],['Right',.2,true]]));assert.equal(calls.length,1);assert.ok(calls[0][2]<.5);
  camera.process(result([['Right',.2,true],['Left',.8,true]]));assert.equal(calls.length,2);assert.ok(calls.at(-1)[2]<.5);
  camera.process(result([['Right',.2,true]]));assert.ok(calls.at(-1)[2]>.5);
});
test('tracking loss releases gesture state and simultaneous hands control separate decks',()=>{
  const {camera,calls}=setup();camera.mode='effect';camera.process(result([['Left',.8,true],['Right',.2,true]]));assert.deepEqual(calls.map(c=>c[1]),[0,1]);
  camera.process(result([]));assert.equal(camera.hands.size,0);
});
