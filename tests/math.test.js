import test from 'node:test';
import assert from 'node:assert/strict';
import { crossfadeGains, timeLabel, readGesture, gestureValue } from '../src/math.js';

test('crossfader isolates each deck and maintains equal power throughout the blend',()=>{
  assert.deepEqual(crossfadeGains(0),[1,0]);
  assert.ok(crossfadeGains(1)[0]<1e-12);
  assert.equal(crossfadeGains(1)[1],1);
  for(let i=0;i<=100;i++){const [a,b]=crossfadeGains(i/100);assert.ok(Math.abs(a*a+b*b-1)<1e-12);}
});
test('pinch uses hand-relative scale, mirrored coordinates and hysteresis',()=>{
  const points=Array.from({length:21},()=>({x:.5,y:.5}));
  points[0]={x:.5,y:.9};points[9]={x:.5,y:.5};points[8]={x:.2,y:.3};points[4]={x:.3,y:.3};
  assert.deepEqual(readGesture(points),{pinching:true,x:.8,y:.7,ratio:.24999999999999994});
  points[4]={x:.35,y:.3};
  assert.equal(readGesture(points,false).pinching,false);
  assert.equal(readGesture(points,true).pinching,true);
  points[4]={x:.45,y:.3};assert.equal(readGesture(points,true).pinching,false);
});
test('gesture control ranges and time formatting',()=>{
  assert.equal(gestureValue('pitch',{y:0}),-12);assert.equal(gestureValue('pitch',{y:1}),12);
  assert.equal(gestureValue('tempo',{y:0}),.65);assert.equal(gestureValue('tempo',{y:1}),1.35);
  assert.equal(gestureValue('volume',{y:.8}),.8);
  assert.equal(timeLabel(125.9),'2:05');assert.equal(timeLabel(-1),'0:00');
});
