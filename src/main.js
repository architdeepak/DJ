import './style.css';
import { Mixer, createDemo } from './audio.js';
import { GestureCamera } from './gestures.js';
import { demos, searchTracks, fetchAudio } from './catalog.js';
import { timeLabel } from './math.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name, size=18) => {
  const paths = {
    play:'<path d="m8 5 11 7-11 7Z"/>', pause:'<path d="M8 5v14M16 5v14"/>',
    camera:'<rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3"/>',
    upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>', search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    reset:'<path d="M3 11a9 9 0 1 1 3 8M3 4v7h7"/>', loop:'<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3"/>',
    stop:'<rect x="6" y="6" width="12" height="12" rx="1"/>', arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
    volume:'<path d="m11 5-6 5H2v4h3l6 5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    hand:'<path d="M8 12V5a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v10c0 5-3 7-7 7-3 0-5-2-6-4l-4-6a2 2 0 0 1 3-2l2 2Z"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.arrow}</svg>`;
};
const modes = [['crossfade','Transition','01'],['volume','Volume','02'],['pitch','Pitch','03'],['tempo','Speed','04'],['effect','Effects','05']];
function deckHTML(i) {
  const letter = i ? 'B' : 'A';
  return `<section class="deck deck-${i}" id="deck-${i}" aria-label="Deck ${letter}">
    <div class="deck-top"><span class="deck-letter">${letter}</span><span>DECK ${letter}</span><span class="deck-state" id="state-${i}">EMPTY</span></div>
    <div class="track-display"><div class="record-art" id="art-${i}"><div class="record-label">${letter}</div></div><div class="track-info"><h2 id="title-${i}">Make it yours.</h2><p id="artist-${i}">Load a track to begin</p><span id="bpm-${i}" class="mono">— BPM</span></div></div>
    <div class="wave-wrap"><canvas class="waveform" id="wave-${i}" aria-hidden="true"></canvas><input class="seek" type="range" min="0" max="1000" value="0" aria-label="Seek deck ${letter}" id="seek-${i}" disabled></div>
    <div class="time-row mono"><span id="time-${i}">0:00</span><span id="duration-${i}">0:00</span></div>
    <div class="transport"><button class="icon-button" id="cue-${i}" aria-label="Return deck ${letter} to start" title="Return to start" disabled>${icon('reset')}</button><button class="play-button" id="play-${i}" aria-label="Play deck ${letter}" disabled>${icon('play',22)}<span>PLAY</span></button><button class="icon-button" id="loop-${i}" aria-label="Loop deck ${letter}" aria-pressed="false" title="Loop track" disabled>${icon('loop')}</button></div>
    <div class="deck-controls">${[['volume','Volume',0,100,80,1],['tempo','Speed',65,135,100,1],['pitch','Pitch',-12,12,0,1],['effect','Filter / echo',0,100,0,1]].map(([key,label,min,max,value,step])=>`<label class="control"><span>${label}<output id="value-${key}-${i}">${key==='tempo'?'1.00×':key==='pitch'?'0 st':`${value}%`}</output></span><input type="range" id="${key}-${i}" data-param="${key}" data-deck="${i}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label} deck ${letter}"></label>`).join('')}</div>
    <button class="load-button" data-open="${i}">${icon('search',15)} Load track <span>↗</span></button>
    <div class="drop-hint">Drop an audio file here</div>
  </section>`;
}
$('#app').innerHTML = `<header class="header"><a class="brand" href="/" aria-label="Airdeck home"><span class="brand-symbol">Λ</span>airdeck<span class="brand-edition">/ 01</span></a><div class="header-center"><span class="status-dot"></span>A LITTLE MOVEMENT. A LOT OF MUSIC.</div><button class="quiet-button" id="guide-open">How to play <span class="keycap">?</span></button></header>
<main><div class="session-heading"><div><div class="eyebrow">THE GESTURE-CONTROLLED MIXER</div><h1>Motion in the mix<span>.</span></h1></div><div class="session-actions"><button class="quiet-button" id="demo-load">Load demo pair ${icon('arrow',16)}</button><button class="record-button" id="record"><span class="record-dot"></span><span id="record-label">Record mix</span></button></div></div>
<div class="workspace">${deckHTML(0)}<section class="motion-panel" aria-label="Gesture camera and transition controls"><div class="camera-stage" id="camera-stage"><video id="camera" autoplay playsinline muted></video><canvas id="hands"></canvas><div class="camera-grid"></div><div class="stage-top"><span class="stage-label"><span class="status-dot" id="camera-dot"></span><span id="stage-label">MOTION STUDIO</span></span><button id="camera-stop" class="stage-stop" hidden>Stop camera</button></div><span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span><div class="camera-empty" id="camera-empty"><div class="hand-symbol">${icon('hand',38)}</div><h2>Find your flow.</h2><p>Two tracks. Your hands.<br>A whole new way to mix.</p><button class="primary" id="camera-start">${icon('camera')} Enable camera</button><span class="camera-note">On-device tracking · video stays with you</span></div><div class="stage-bottom"><span>A <span class="zone-line"></span></span><span id="gesture-status" role="status">Pinch. Move. Release.</span><span><span class="zone-line"></span> B</span></div></div>
<div class="gesture-toolbar"><div class="toolbar-label">HAND CONTROL <span>Pinch to engage</span></div><div class="modes">${modes.map(([id,label,num],i)=>`<button class="mode ${i?'':'selected'}" data-mode="${id}" aria-pressed="${!i}"><span>${num}</span>${label}</button>`).join('')}</div></div>
<div class="crossfader"><div class="crossfader-label"><span>TRANSITION</span><output id="blend-value">50 / 50</output><button class="text-button" id="center-mix">Center</button></div><div class="crossfader-track"><b>A</b><input type="range" id="crossfade" min="0" max="1000" value="500" aria-label="Crossfader"><b>B</b></div><div class="crossfader-ticks"><span>DECK A</span><span>BLEND</span><span>DECK B</span></div></div></section>${deckHTML(1)}</div>
<section class="library" aria-label="Music library"><div class="library-header"><div><span class="eyebrow">BUILD YOUR SET</span><h2>The crate<span id="library-count">02</span></h2></div><div class="library-tools"><div class="library-tabs" role="group" aria-label="Music source"><button class="tab active" data-source="demos">Starter tracks</button><button class="tab" data-source="audius">Audius catalog ↗</button><button class="tab" data-source="files">Your files</button></div><button class="quiet-button import-button" id="import">${icon('upload',16)} Import audio</button></div></div><div class="search-row" id="search-row" hidden><form id="search-form">${icon('search')}<input type="search" id="search-query" placeholder="Search tracks or artists on Audius" aria-label="Search Audius"><button class="small-button" type="submit">Search</button></form><span>Full tracks · availability varies by artist</span></div><div class="crate-head"><span>TRACK / ARTIST</span><span>GENRE</span><span>LENGTH</span><span>LOAD TO</span></div><div id="tracks"></div><div class="library-message" id="library-message" role="status"></div></section>
<footer><span>AIRDECK © ${new Date().getFullYear()}<span class="footer-divider">/</span>MADE FOR THE MOMENT.</span><div class="master-control">${icon('volume',16)}<label for="master">MASTER</label><input id="master" type="range" min="0" max="100" value="75" aria-label="Master volume"><output id="master-value">75%</output><canvas id="meter" width="84" height="20" aria-label="Output audio meter"></canvas></div><span class="footer-keys"><kbd>SPACE</kbd> Play / pause <kbd>1—5</kbd> Hand mode</span></footer></main>
<input id="file-input" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac" multiple hidden>
<div class="toast" id="toast" role="status" hidden></div>
<dialog id="guide"><div class="dialog-top"><span class="eyebrow">A QUICK SOUND CHECK</span><button class="icon-button" id="guide-close" aria-label="Close guide">✕</button></div><h2>Less clicking.<br>More feeling.</h2><p>Load a song into each deck, press play, then enable your camera. Stand back so your hands are in view.</p><ol><li><strong>Pinch to engage.</strong> Bring your thumb and index finger together. Release to leave the mix where it is.</li><li><strong>Transition.</strong> Pinch and move left or right to blend deck A into deck B.</li><li><strong>Shape each track.</strong> Choose Volume, Pitch, Speed, or Effects. Pinch on the left for A or right for B, then move up/down. Your deck stays selected until you release.</li><li><strong>Make it a set.</strong> Import your own audio or search Audius. Hit Record mix to save your performance.</li></ol><p class="guide-note">Good light and an uncluttered background help. All controls also work with mouse, touch, and keyboard. Space plays/pauses loaded decks; 1–5 select a gesture mode; Esc stops the camera. Speed and pitch are independent. Effects blend a low-pass filter with echo.</p><button class="primary" id="guide-done">Got it. Let’s mix. ${icon('arrow')}</button></dialog>`;

const mixer = new Mixer();
let initPromise, source = 'demos', libraryTracks = [...demos], files = [], catalog = [], searchController;
const loads = [null,null];
const camera = new GestureCamera($('#camera'), $('#hands'), (mode, deck, value) => {
  if (mode === 'crossfade') setCrossfade(value);
  else setParam(deck, mode, value);
}, (state, message) => {
  $('#gesture-status').textContent = message;
  $('#camera-dot').classList.toggle('live',state==='active');
  $('#stage-label').textContent = state === 'active' ? 'MOTION LIVE' : 'MOTION STUDIO';
  $('#camera-stage').classList.toggle('is-live',state==='active');
  $('#camera-empty').hidden = state==='active';
  $('#camera-stop').hidden = state!=='active' && state!=='loading';
  $('#camera-start').disabled = state==='loading';
  $('#camera-start').innerHTML = `${icon('camera')} ${state==='loading'?'Starting…':'Enable camera'}`;
  if(state==='error') toast(message, true);
});
async function ready() {
  initPromise ||= mixer.init().catch(e=>{initPromise=null;throw e;});
  await initPromise; mixer.setMaster(Number($('#master').value)/100); return mixer;
}
let toastTimer;
function toast(message, error=false) {
  $('#toast').textContent=message; $('#toast').hidden=false; $('#toast').classList.toggle('error',error);
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,error?9000:4000);
}
function setCrossfade(value) {
  mixer.setCrossfade(value); $('#crossfade').value=Math.round(value*1000);
  $('#blend-value').textContent=`${Math.round((1-value)*100)} / ${Math.round(value*100)}`;
}
function setParam(index, param, value) {
  const input=$(`#${param}-${index}`), output=$(`#value-${param}-${index}`);
  const normalized=param==='volume'||param==='effect'?value*100:param==='tempo'?value*100:value;
  input.value=normalized;
  output.textContent=param==='tempo'?`${value.toFixed(2)}×`:param==='pitch'?`${value>0?'+':''}${Math.round(value)} st`:`${Math.round(value*100)}%`;
  mixer.decks[index]?.set(param,value);
  if (param==='tempo') updateBpm(index);
}
function updateBpm(i) {
  const deck=mixer.decks[i];
  $(`#bpm-${i}`).textContent=deck?.track?.bpm?`${(deck.track.bpm*deck.tempo).toFixed(1)} BPM`:'BPM —';
}
function refreshDeck(i) {
  const deck=mixer.decks[i]; if (!deck?.buffer) return;
  $(`#title-${i}`).textContent=deck.track.title; $(`#artist-${i}`).textContent=deck.track.artist;
  $(`#state-${i}`).textContent=loads[i]?'LOADING':deck.playing?'PLAYING':'READY';
  $(`#state-${i}`).classList.toggle('playing',deck.playing);
  $(`#play-${i}`).innerHTML=`${icon(deck.playing?'pause':'play',22)}<span>${deck.playing?'PAUSE':'PLAY'}</span>`;
  $(`#play-${i}`).setAttribute('aria-label',`${deck.playing?'Pause':'Play'} deck ${i?'B':'A'}`);
  $(`#deck-${i}`).classList.toggle('is-playing',deck.playing);
  for (const id of ['play','cue','loop','seek']) $(`#${id}-${i}`).disabled=false;
  $(`#duration-${i}`).textContent=timeLabel(deck.buffer.duration); updateBpm(i);
}
async function loadTrack(index, track) {
  loads[index]?.abort(); const controller = loads[index] = new AbortController();
  $(`#state-${index}`).textContent='LOADING'; $(`#deck-${index}`).classList.add('is-loading');
  try {
    await ready();
    const data = track.demo !== undefined ? createDemo(mixer.context, track.demo) : track.file ? await track.file.arrayBuffer() : await fetchAudio(track,controller.signal);
    if(controller.signal.aborted) return;
    const deck=mixer.decks[index];
    // Decode first; keep the old deck playing if the replacement is unavailable.
    const buffer=data instanceof AudioBuffer?data:await mixer.context.decodeAudioData(data);
    if(controller.signal.aborted) return;
    if(buffer.duration>1200) throw new Error('Choose a track shorter than 20 minutes.');
    await deck.load(track,buffer);
    for(const param of ['volume','tempo','pitch','effect']) { const input=$(`#${param}-${index}`); deck.set(param,Number(input.value)/(param==='pitch'?1:100)); }
    deck.onChange=()=>refreshDeck(index);
    deck.onError=message=>toast(`Deck ${index?'B':'A'}: ${message}`,true);
    toast(`${track.title} loaded to deck ${index?'B':'A'}.`);
  } catch(error) { if(!controller.signal.aborted) toast(error.message || 'Could not decode this audio. Try MP3 or WAV.',true); }
  finally {
    if(loads[index]===controller) {
      loads[index]=null; $(`#deck-${index}`).classList.remove('is-loading');
      if(mixer.decks[index]?.buffer) refreshDeck(index); else $(`#state-${index}`).textContent='EMPTY';
    }
  }
}
async function toggleDeck(i) {
  const deck=mixer.decks[i]; if(!deck?.buffer) return;
  if(deck.playing) deck.pause(); else await deck.play(); refreshDeck(i);
}
function renderTracks() {
  libraryTracks=source==='demos'?demos:source==='files'?files:catalog;
  $('#library-count').textContent=String(libraryTracks.length).padStart(2,'0');
  $('#tracks').innerHTML=libraryTracks.map((track,i)=>`<article class="track-row"><div class="track-main"><span class="track-number mono">${String(i+1).padStart(2,'0')}</span><div class="mini-art art-${i%4}">${track.demo!==undefined?'↗':'♪'}</div><div><h3>${esc(track.title)}${track.permalink?` <a href="${esc(track.permalink)}" target="_blank" rel="noopener noreferrer" aria-label="View ${esc(track.title)} on Audius">↗</a>`:''}</h3><p>${esc(track.artist)}</p></div></div><span class="genre">${esc(track.genre)}</span><span class="mono track-length">${track.duration?timeLabel(track.duration):'—'}</span><div class="load-actions"><button data-track="${i}" data-to="0" aria-label="Load ${esc(track.title)} to deck A">A <span>+</span></button><button data-track="${i}" data-to="1" aria-label="Load ${esc(track.title)} to deck B">B <span>+</span></button></div></article>`).join('');
  $('#library-message').textContent=source==='demos'?'Original instrumentals. Ready to mix, even offline.':source==='files'?(files.length?'Your files stay in this browser session.':'Your next set starts here. Import audio from your device.'):(catalog.length?'Music via Audius. Artist availability and streaming access may vary.':'Search for an artist or track, or explore this week’s trending music.');
}
async function search() {
  searchController?.abort(); const controller=searchController=new AbortController();
  $('#library-message').textContent='Digging through the crate…';
  $('#search-form button').disabled=true;
  try { const result=await searchTracks($('#search-query').value,controller.signal); if(controller.signal.aborted)return; catalog=result; if(source==='audius') { renderTracks(); if(!catalog.length)$('#library-message').textContent='No streamable tracks found. Try another artist or title.'; } }
  catch(error) { if(!controller.signal.aborted && source==='audius') $('#library-message').textContent='The catalog is unavailable right now. Try again, use the starter tracks, or import your own audio.'; }
  finally { if(searchController===controller)$('#search-form button').disabled=false; }
}
function selectSource(value) {
  source=value; document.querySelectorAll('[data-source]').forEach(el=>el.classList.toggle('active',el.dataset.source===value));
  $('#search-row').hidden=value!=='audius'; renderTracks();
  if(value==='audius'&&!catalog.length)search();
}
function importFiles(selected, deckIndex) {
  const valid=[...selected].filter(file=>file.type.startsWith('audio/')||/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(file.name));
  if(!valid.length) { toast('Choose an audio file, such as MP3, WAV, FLAC, or M4A.',true); return; }
  const added=[];
  for(const file of valid) {
    if(file.size>90*1024*1024) { toast(`${file.name} is too large. Choose files under 90 MB.`,true); continue; }
    const track={id:crypto.randomUUID(),title:file.name.replace(/\.[^.]+$/,''),artist:'Local file',genre:'Your collection',file}; files.push(track); added.push(track);
  }
  selectSource('files'); if(deckIndex!==undefined&&added.length)loadTrack(deckIndex,added[0]);
}
function setMode(mode) {
  camera.mode=mode; camera.hands.clear(); camera.crossfadeOwner=null;
  document.querySelectorAll('[data-mode]').forEach(el=>{const selected=el.dataset.mode===mode;el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',selected);});
}
$('#crossfade').oninput=e=>setCrossfade(Number(e.target.value)/1000);
$('#center-mix').onclick=()=>setCrossfade(.5);
$('#master').oninput=e=>{const value=Number(e.target.value);mixer.setMaster(value/100);$('#master-value').textContent=`${value}%`;};
document.querySelectorAll('[data-param]').forEach(el=>el.oninput=async()=>{await ready();setParam(Number(el.dataset.deck),el.dataset.param,Number(el.value)/(el.dataset.param==='pitch'?1:100));});
document.querySelectorAll('[data-mode]').forEach(el=>el.onclick=()=>setMode(el.dataset.mode));
document.querySelectorAll('[data-source]').forEach(el=>el.onclick=()=>selectSource(el.dataset.source));
document.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>{ $('.library').scrollIntoView({behavior:'smooth',block:'start'});toast(`Choose A or B beside a track to load a deck.`); });
$('#tracks').onclick=e=>{const b=e.target.closest('[data-track]');if(b)loadTrack(Number(b.dataset.to),libraryTracks[Number(b.dataset.track)]);};
$('#search-form').onsubmit=e=>{e.preventDefault();search();};
$('#import').onclick=()=>$('#file-input').click();
$('#file-input').onchange=e=>{importFiles(e.target.files);e.target.value='';};
for(let i=0;i<2;i++) {
  $(`#play-${i}`).onclick=()=>toggleDeck(i);
  $(`#cue-${i}`).onclick=()=>{mixer.decks[i]?.seek(0);};
  $(`#seek-${i}`).oninput=e=>mixer.decks[i]?.seek(Number(e.target.value)/1000);
  $(`#loop-${i}`).onclick=()=>{const deck=mixer.decks[i];deck.loop=!deck.loop;$(`#loop-${i}`).setAttribute('aria-pressed',deck.loop);};
  const element=$(`#deck-${i}`);
  element.ondragover=e=>{e.preventDefault();element.classList.add('dragover');};
  element.ondragleave=()=>element.classList.remove('dragover');
  element.ondrop=e=>{e.preventDefault();element.classList.remove('dragover');importFiles(e.dataTransfer.files,i);};
}
$('#demo-load').onclick=async()=>{
  $('#demo-load').disabled=true;
  try { await loadTrack(0,demos[0]); await loadTrack(1,demos[1]); for(let i=0;i<2;i++){mixer.decks[i].loop=true;$(`#loop-${i}`).setAttribute('aria-pressed','true');} }
  finally { $('#demo-load').disabled=false; }
};
$('#camera-start').onclick=()=>camera.start();
function stopCamera() { camera.stop();$('#camera-empty').hidden=false;$('#camera-stop').hidden=true;$('#camera-stage').classList.remove('is-live');$('#camera-dot').classList.remove('live');$('#stage-label').textContent='MOTION STUDIO';$('#gesture-status').textContent='Camera off · manual controls ready';$('#camera-start').disabled=false;$('#camera-start').innerHTML=`${icon('camera')} Enable camera`; }
$('#camera-stop').onclick=stopCamera;
$('#guide-open').onclick=()=>$('#guide').showModal();
$('#guide-close').onclick=$('#guide-done').onclick=()=>$('#guide').close();
$('#guide').onclick=e=>{if(e.target===$('#guide')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
$('#record').onclick=async()=>{
  try {
    if(mixer.recording) { mixer.stopRecording();$('#record').classList.remove('recording');$('#record-label').textContent='Record mix';return; }
    if(!window.MediaRecorder)throw new Error('Recording is unavailable in this browser. Try Chrome or Edge.');
    await ready();
    if(!mixer.decks.some(d=>d.buffer))throw new Error('Load a track before recording your mix.');
    mixer.startRecording(blob=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`airdeck-mix-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.${blob.type.includes('mp4')?'m4a':'webm'}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('Your mix is ready. Download started.');});
    $('#record').classList.add('recording');$('#record-label').textContent='Stop & save';toast('Recording the master output. Stop & save when you’re done.');
  } catch(error){toast(error.message,true);}
};
document.addEventListener('keydown',async e=>{
  if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;
  if(e.key==='Escape'){stopCamera();return;}
  if($('#guide').open)return;
  if(e.key==='?')$('#guide').showModal();
  if(e.code==='Space') { e.preventDefault(); const loaded=mixer.decks.filter(d=>d.buffer);if(!loaded.length){toast('Load a demo pair or choose tracks from the crate.');return;}const pause=loaded.some(d=>d.playing);for(const deck of loaded){if(pause)deck.pause();else await deck.play();refreshDeck(deck.index);} }
  if(/^[1-5]$/.test(e.key))setMode(modes[Number(e.key)-1][0]);
});
window.addEventListener('pagehide',()=>{camera.stop();mixer.stopRecording();});
function drawWave(i) {
  const canvas=$(`#wave-${i}`),rect=canvas.getBoundingClientRect(),ratio=devicePixelRatio||1;
  if(canvas.width!==Math.round(rect.width*ratio)||canvas.height!==Math.round(rect.height*ratio)){canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);}
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,deck=mixer.decks[i];ctx.clearRect(0,0,w,h);
  const peaks=deck?.peaks||Array(100).fill(.025),progress=deck?.buffer?deck.position/deck.buffer.duration:0;
  peaks.forEach((peak,j)=>{ctx.fillStyle=j/peaks.length<progress?(i?'#eda681':'#c5eb90'):(i?'#714f3e':'#52653c');const bh=Math.max(2,peak*h*.95);ctx.fillRect(j/peaks.length*w,h/2-bh/2,Math.max(1,w/peaks.length-1.4*ratio),bh);});
  if(deck?.buffer){ctx.fillStyle='#e9ece3';ctx.fillRect(progress*w,0,ratio,h);$(`#time-${i}`).textContent=timeLabel(deck.position);if(document.activeElement!==$(`#seek-${i}`))$(`#seek-${i}`).value=Math.round(progress*1000);}
}
let lastDraw=0;
function frame(now) {
  if(now-lastDraw>45) {
    lastDraw=now; drawWave(0);drawWave(1);
    const canvas=$('#meter'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,84,20);
    let level=0;
    if(mixer.analyser){const data=new Uint8Array(mixer.analyser.frequencyBinCount);mixer.analyser.getByteFrequencyData(data);level=data.reduce((a,b)=>a+b,0)/data.length/140;}
    for(let j=0;j<14;j++){ctx.fillStyle=j/14<level?(j>11?'#eda681':'#c5eb90'):'#30372e';ctx.fillRect(j*6,4,3,12);}
  }
  requestAnimationFrame(frame);
}
renderTracks();requestAnimationFrame(frame);
