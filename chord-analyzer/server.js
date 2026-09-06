const express = require('express');
const play = require('play-dl');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── yt-dlp binary (cross-platform) ────────────────────────────────────────────
const isWindows = process.platform === 'win32';
const YTDLP = path.join(__dirname, isWindows ? 'yt-dlp.exe' : 'yt-dlp');
const YTDLP_URL = isWindows
  ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
  : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

async function ensureYtDlp() {
  if (fs.existsSync(YTDLP)) {
    if (!isWindows) {
      try { fs.chmodSync(YTDLP, '755'); } catch (_) {}
    }
    console.log(`✓ yt-dlp found at ${YTDLP}`);
    return;
  }
  console.log(`⏳ Downloading yt-dlp (~15MB) from GitHub...`);
  const resp = await axios.get(YTDLP_URL, {
    responseType: 'stream',
    maxRedirects: 5,
    timeout: 120000,
  });
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(YTDLP);
    resp.data.pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
  });
  if (!isWindows) {
    try { fs.chmodSync(YTDLP, '755'); } catch (_) {}
  }
  console.log('✓ yt-dlp downloaded');
}

// ── Search ─────────────────────────────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });
    const results = await play.search(q, { limit: 12, source: { youtube: 'video' } });
    res.json(results.map(v => ({
      id: v.id,
      title: v.title,
      thumbnail: v.thumbnails?.[0]?.url || '',
      duration: v.durationRaw || '',
      author: v.channel?.name || 'Unknown',
    })));
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Audio stream via yt-dlp ────────────────────────────────────────────────────
app.get('/api/audio/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  console.log('Streaming:', url);

  const args = [
    '--format', 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',
    '--output', '-',
    '--quiet',
    '--no-warnings',
    '--no-playlist',
    '--no-part',
    url,
  ];

  const proc = spawn(YTDLP, args);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');

  proc.stdout.pipe(res);

  proc.stderr.on('data', d => {
    const msg = d.toString().trim();
    if (msg) console.warn('yt-dlp:', msg);
  });

  proc.on('error', err => {
    console.error('yt-dlp spawn error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  });

  req.on('close', () => proc.kill());
});

// ── Lyrics proxy ───────────────────────────────────────────────────────────────
app.get('/api/lyrics', async (req, res) => {
  try {
    const { title, artist } = req.query;
    const q = [artist, title].filter(Boolean).join(' ');
    const resp = await axios.get('https://lrclib.net/api/search', {
      params: { q },
      timeout: 6000,
    });
    const results = resp.data || [];
    const synced = results.find(r => r.syncedLyrics);
    res.json(synced || results[0] || null);
  } catch (err) {
    console.error('Lyrics error:', err.message);
    res.json(null);
  }
});

const PORT = process.env.PORT || 3721;

ensureYtDlp().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🎸 Chord Analyzer → http://localhost:${PORT}\n`);
  });
}).catch(err => {
  console.error('Failed to initialize yt-dlp:', err.message);
  process.exit(1);
});
