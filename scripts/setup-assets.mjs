import { mkdir, copyFile, readdir, writeFile, access } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const wasm = new URL('node_modules/@mediapipe/tasks-vision/wasm/', root);
await mkdir(new URL('public/vision/',root),{recursive:true});
await mkdir(new URL('public/models/',root),{recursive:true});
await mkdir(new URL('public/vendor/soundtouch/',root),{recursive:true});
await copyFile(new URL('node_modules/soundtouchjs/dist/soundtouch.js',root),new URL('public/vendor/soundtouch/soundtouch.js',root));
await copyFile(new URL('node_modules/soundtouchjs/LICENSE',root),new URL('public/vendor/soundtouch/LICENSE.txt',root));
for (const file of await readdir(wasm)) await copyFile(new URL(file,wasm),new URL(`public/vision/${file}`,root));
const model = new URL('public/models/hand_landmarker.task',root);
try { await access(model); } catch {
  const response = await fetch('https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task');
  if(!response.ok) throw new Error(`Model download failed: ${response.status}`);
  await writeFile(model,new Uint8Array(await response.arrayBuffer()));
}
console.log('Hand tracking model and WebAssembly assets ready.');
