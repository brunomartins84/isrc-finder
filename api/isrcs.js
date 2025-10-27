// api/isrcs.js — Vercel Serverless Function (Node 18+, ESM)

export default async function handler(req, res) {
  // CORS básico (permite front em GitHub Pages)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
    const { albumUrl, format = 'json' } = req.body || {};
    if (!albumUrl) return res.status(400).json({ error: 'albumUrl obrigatório' });

    const albumId = extractAlbumId(albumUrl);
    if (!albumId) return res.status(400).json({ error: 'URL inválida' });

    const token = await getSpotifyToken();
    const tracks = await listAlbumTracks(token, albumId); // {id, track_number, name}
    const details = await fetchTracksInBatches(token, tracks.map(t => t.id));

    const map = new Map(details.map(t => [t.id, t]));
    const rows = tracks.map(t => ({
      track_number: t.track_number,
      track_name: t.name,
      isrc: map.get(t.id)?.external_ids?.isrc || '',
      spotify_url: map.get(t.id)?.external_urls?.spotify || ''
    })).sort((a,b)=>a.track_number-b.track_number);

    if (format === 'csv') {
      const header = 'track_number,track_name,isrc,spotify_url';
      const csv = [header, ...rows.map(r => [
        r.track_number ?? '',
        csvEscape(r.track_name),
        r.isrc,
        r.spotify_url
      ].join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      return res.status(200).send(csv);
    }

    return res.status(200).json({ rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
}

function extractAlbumId(url) {
  const m1 = url.match(/open\.spotify\.com\/album\/([A-Za-z0-9]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/spotify:album:([A-Za-z0-9]+)/);
  if (m2) return m2[1];
  return null;
}

async function getSpotifyToken() {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  if(!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET){
    throw new Error('Configure SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET nas envs da Vercel');
  }
  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  if (!r.ok) throw new Error('Falha ao obter token do Spotify');
  const j = await r.json();
  return j.access_token;
}

async function listAlbumTracks(token, albumId) {
  const headers = { Authorization: `Bearer ${token}` };
  let url = `https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`;
  const out = [];
  while (url) {
    const r = await fetch(url, { headers });
    if (r.status === 429) { await waitRetry(r); continue; }
    if (!r.ok) throw new Error('Falha ao listar faixas do álbum');
    const j = await r.json();
    for (const it of j.items || []) out.push({ id: it.id, track_number: it.track_number, name: it.name });
    url = j.next;
  }
  return out;
}

async function fetchTracksInBatches(token, ids) {
  const headers = { Authorization: `Bearer ${token}` };
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50).join(',');
    const r = await fetch(`https://api.spotify.com/v1/tracks?ids=${chunk}`, { headers });
    if (r.status === 429) { await waitRetry(r); continue; }
    if (!r.ok) throw new Error('Falha ao buscar tracks em lote');
    const j = await r.json();
    out.push(...(j.tracks || []));
  }
  return out;
}

function csvEscape(s){ if(s==null)return''; const x=String(s); return /[",\n]/.test(x)?`"${x.replace(/"/g,'""')}"`:x; }

async function waitRetry(resp) {
  const ra = Number(resp.headers.get('retry-after') || 1);
  await new Promise(r => setTimeout(r, (ra + 0.25) * 1000));
}
