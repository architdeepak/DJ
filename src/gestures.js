import { readGesture, gestureValue } from './math.js';

const connections = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
export class GestureCamera {
  constructor(video, canvas, onControl, onStatus) {
    this.video = video; this.canvas = canvas; this.onControl = onControl; this.onStatus = onStatus;
    this.mode = 'crossfade'; this.hands = new Map(); this.running = false; this.generation = 0;
    this.crossfadeOwner=null;
  }
  async start() {
    if (this.running || this.starting) return;
    const generation = ++this.generation; this.starting = true;
    this.onStatus('loading', 'Starting camera & hand tracking…');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera requires localhost or HTTPS.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' } });
      if (generation !== this.generation) { stream.getTracks().forEach(t => t.stop()); return; }
      this.stream = stream; this.video.srcObject = stream; await this.video.play();
      const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks('/vision');
      const options = { baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: .6, minHandPresenceConfidence: .6, minTrackingConfidence: .6 };
      let model;
      try { model = await HandLandmarker.createFromOptions(files, options); }
      catch { options.baseOptions.delegate = 'CPU'; model = await HandLandmarker.createFromOptions(files, options); }
      if (generation !== this.generation) { model.close(); return; }
      this.model = model; this.running = true; this.starting = false; this.lastFrame = -1; this.lastInference = 0;
      this.onStatus('active', 'Camera live · pinch to take control'); this.frame();
    } catch (error) {
      if (generation !== this.generation) return;
      this.stop();
      const message = error.name === 'NotAllowedError' ? 'Camera permission denied. Allow camera access, then try again.' : error.name === 'NotFoundError' ? 'No camera found. Connect a webcam to use hand controls.' : `Hand tracking unavailable: ${error.message}`;
      this.onStatus('error', message);
    }
  }
  stop() {
    this.generation++; this.running = false; this.starting = false;
    cancelAnimationFrame(this.raf); this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null; this.video.srcObject = null; this.model?.close(); this.model = null; this.hands.clear();
    this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  frame = () => {
    if (!this.running) return;
    const now = performance.now();
    if (this.video.readyState >= 2 && this.lastFrame !== this.video.currentTime && now - this.lastInference > 50) {
      this.lastFrame = this.video.currentTime; this.lastInference = now;
      try { this.process(this.model.detectForVideo(this.video, now)); }
      catch (error) { this.stop(); this.onStatus('error', `Tracking stopped: ${error.message}`); return; }
    }
    this.raf = requestAnimationFrame(this.frame);
  };
  process(results) {
    const ctx = this.canvas.getContext('2d');
    this.canvas.width = this.video.videoWidth; this.canvas.height = this.video.videoHeight;
    const { width: w, height: h } = this.canvas;
    const seen = new Set(), controlled = new Set(); let engaged = 0;
    const visible=new Set(results.handedness.map(h=>h[0].categoryName));
    if(!visible.has(this.crossfadeOwner))this.crossfadeOwner=null;
    results.landmarks.forEach((points, i) => {
      const key = results.handedness[i][0].categoryName; seen.add(key);
      const previous = this.hands.get(key);
      const hand = readGesture(points, previous?.pinching);
      // Lock the deck when a pinch starts, so moving across center never switches decks.
      hand.deck = previous?.pinching ? previous.deck : (hand.x < .5 ? 0 : 1);
      hand.x = previous ? previous.x + (hand.x - previous.x) * .3 : hand.x;
      hand.y = previous ? previous.y + (hand.y - previous.y) * .3 : hand.y;
      this.hands.set(key, hand);
      if (hand.pinching) {
        // A single hand owns the shared crossfader; both can control separate decks.
        if(this.mode==='crossfade'&&!this.crossfadeOwner)this.crossfadeOwner=key;
        if (this.mode === 'crossfade' ? this.crossfadeOwner===key : !controlled.has(hand.deck)) this.onControl(this.mode, hand.deck, this.mode === 'crossfade' ? hand.x : gestureValue(this.mode, hand));
        controlled.add(hand.deck);
        engaged++;
      }
      else if(this.crossfadeOwner===key)this.crossfadeOwner=null;
      const color = hand.deck ? '#eda681' : '#c5eb90';
      ctx.lineWidth = Math.max(2, w / 450); ctx.strokeStyle = color; ctx.globalAlpha = hand.pinching ? .95 : .45;
      connections.forEach(([a,b]) => { ctx.beginPath(); ctx.moveTo((1-points[a].x)*w,points[a].y*h); ctx.lineTo((1-points[b].x)*w,points[b].y*h); ctx.stroke(); });
      points.forEach(p => { ctx.beginPath(); ctx.arc((1-p.x)*w,p.y*h,3,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); });
      ctx.globalAlpha = 1;
      const x=(1-points[8].x)*w,y=points[8].y*h;
      ctx.beginPath(); ctx.arc(x,y,hand.pinching?22:13,0,Math.PI*2); ctx.strokeStyle=color; ctx.stroke();
      ctx.font='14px monospace'; ctx.fillStyle=color; ctx.fillText(`${hand.deck?'B':'A'} · ${hand.pinching?this.mode.toUpperCase():'PINCH TO ENGAGE'}`,Math.max(8,Math.min(w-210,x+30)),Math.max(25,y-20));
    });
    for (const key of this.hands.keys()) if (!seen.has(key)) this.hands.delete(key);
    this.onStatus('active', engaged ? `${engaged} hand${engaged>1?'s':''} engaged · ${this.mode}` : seen.size ? `${seen.size} hand${seen.size>1?'s':''} detected · pinch to engage` : 'Camera live · bring your hands into view');
  }
}
