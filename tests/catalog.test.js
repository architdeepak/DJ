import test from 'node:test';
import assert from 'node:assert/strict';
import { searchTracks, fetchAudio } from '../src/catalog.js';

test('catalog filters unavailable/gated tracks and escapes search queries',async()=>{
  const original=globalThis.fetch;let called;
  globalThis.fetch=async url=>{called=url;return Response.json({data:[{id:'ok',title:'Track',user:{name:'Artist'},duration:180},{id:'gated',is_stream_gated:true},{id:'missing',is_available:false},{id:'deleted',is_delete:true}]});};
  try {const result=await searchTracks('a & b',new AbortController().signal);assert.equal(result.length,1);assert.equal(result[0].artist,'Artist');assert.ok(called.includes('a%20%26%20b'));assert.ok(result[0].url.includes('/tracks/ok/stream'));}
  finally{globalThis.fetch=original;}
});
test('catalog fails over to another host and honors cancellation',async()=>{
  const original=globalThis.fetch;let count=0;
  globalThis.fetch=async()=>{if(!count++)throw new Error('offline');return Response.json({data:[]});};
  try{assert.deepEqual(await searchTracks('',new AbortController().signal),[]);assert.equal(count,2);const controller=new AbortController();controller.abort();globalThis.fetch=async()=>{throw new DOMException('Aborted','AbortError');};await assert.rejects(searchTracks('',controller.signal),{name:'AbortError'});}
  finally{globalThis.fetch=original;}
});
test('track fetch rejects unavailable and oversized audio, and assembles streaming chunks',async()=>{
  const original=globalThis.fetch,signal=new AbortController().signal;
  try {
    globalThis.fetch=async()=>new Response('',{status:403});await assert.rejects(fetchAudio({url:'https://example.com'},signal),/unavailable/);
    globalThis.fetch=async()=>new Response('',{headers:{'content-length':100*1024*1024}});await assert.rejects(fetchAudio({url:'https://example.com'},signal),/too large/);
    globalThis.fetch=async()=>new Response(new Uint8Array([1,2,3,4]));assert.deepEqual(new Uint8Array(await fetchAudio({url:'https://example.com'},signal)),new Uint8Array([1,2,3,4]));
  } finally{globalThis.fetch=original;}
});
