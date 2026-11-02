export const demos = [
  { id: 'demo-0', title: 'After Hours', artist: 'Airdeck Originals', genre: 'Deep house', bpm: 120, duration: 32, demo: 0 },
  { id: 'demo-1', title: 'Side Street', artist: 'Airdeck Originals', genre: 'Electronic', bpm: 124, duration: 64 * 60 / 124, demo: 1 },
];
const hosts = ['https://api.audius.co', 'https://discoveryprovider.audius.co'];
export async function searchTracks(query, signal) {
  let lastError;
  for (const host of hosts) {
    try {
      const path = query.trim() ? `/tracks/search?query=${encodeURIComponent(query.trim())}` : '/tracks/trending?time=week';
      const response = await fetch(`${host}/v1${path}&limit=24&app_name=AIRDECK`, { signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]) });
      if (!response.ok) throw new Error(`Catalog returned ${response.status}`);
      const { data } = await response.json();
      return data.filter(t => t.is_streamable !== false && !t.is_delete && !t.is_stream_gated && t.is_available !== false).map(t => ({
        id: t.id, title: t.title, artist: t.user?.name || 'Unknown artist', genre: t.genre || 'Music', duration: t.duration,
        artwork: t.artwork?.['150x150'], permalink: t.permalink ? `https://audius.co${t.permalink}` : null,
        url: `${host}/v1/tracks/${t.id}/stream?app_name=AIRDECK`,
      }));
    } catch (error) { if (signal.aborted) throw error; lastError = error; }
  }
  throw lastError;
}
export async function fetchAudio(track, signal) {
  const response = await fetch(track.url, { signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]) });
  if (!response.ok) throw new Error(`Track unavailable (${response.status}). Try another track or import a file.`);
  const max = 90 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > max) throw new Error('This track is too large. Choose audio under 90 MB.');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > max) throw new Error('This track is too large. Choose audio under 90 MB.');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const result = new Uint8Array(size); let offset = 0;
  chunks.forEach(chunk => { result.set(chunk, offset); offset += chunk.length; });
  return result.buffer;
}
