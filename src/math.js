export const clamp = (x, min = 0, max = 1) => Math.max(min, Math.min(max, x));
export const crossfadeGains = x => [Math.cos(clamp(x) * Math.PI / 2), Math.sin(clamp(x) * Math.PI / 2)];
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const timeLabel = seconds => `${Math.floor(Math.max(0, seconds || 0) / 60)}:${String(Math.floor(Math.max(0, seconds || 0) % 60)).padStart(2, '0')}`;
export function readGesture(points, wasPinching = false) {
  const scale = Math.max(distance(points[0], points[9]), .04);
  const ratio = distance(points[4], points[8]) / scale;
  return { pinching: ratio < (wasPinching ? .48 : .32), x: clamp(1 - points[8].x), y: clamp(1 - points[8].y), ratio };
}
export function gestureValue(mode, hand) {
  if (mode === 'pitch') return Math.round((hand.y - .5) * 24);
  if (mode === 'tempo') return .65 + hand.y * .7;
  return hand.y;
}
