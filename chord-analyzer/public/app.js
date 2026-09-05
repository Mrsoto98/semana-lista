// ── State ──────────────────────────────────────────────────────────────────────
const state = {
  chords: [],          // [{time, chord, endTime}]
  currentChordIdx: -1,
  semitones: 0,
  speed: 1.0,
  duration: 0,
  isPlaying: false,
  bpm: 0,
  key: '',
  lrcLines: [],        // [{time, text, chords}]
  uniqueChords: [],    // ordered list of unique chords in song
  tonePlayer: null,
  pitchShift: null,
  audioCtx: null,
  playStartTime: 0,
  playOffset: 0,
  pausedAt: 0,
  animFrame: null,
  waveformData: null,
};

// ── DOM refs ───────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const searchSection = $('search-section');
const playerSection = $('player-section');
const searchInput   = $('search-input');
const searchBtn     = $('search-btn');
const searchResults = $('search-results');
const loadingState  = $('loading-state');
const loadingText   = $('loading-text');
const analysisFill  = $('analysis-fill');
const playerView    = $('player-view');
const songTitle     = $('song-title');
const songArtist    = $('song-artist');
const songThumb     = $('song-thumbnail');
const backBtn       = $('back-btn');
const currentChordName = $('current-chord-name');
const currentChordType = $('current-chord-type');
const bpmDisplay    = $('bpm-display');
const keyDisplay    = $('key-display');
const diagramsScroll = $('diagrams-scroll');
const lyricsContainer = $('lyrics-container');
const semiDisplay   = $('semi-display');
const speedDisplay  = $('speed-display');
const timeCurrent   = $('time-current');
const timeTotal     = $('time-total');
const progressFill  = $('progress-fill');
const progressThumb = $('progress-thumb');
const progressTrack = $('progress-track');
const playPauseBtn  = $('play-pause');
const canvas        = $('timeline-canvas');
const ctx           = canvas.getContext('2d');

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function getTransposedChord(chord) {
  return transposeChord(chord, state.semitones);
}

// ── Search ─────────────────────────────────────────────────────────────────────
async function doSearch() {
  const q = searchInput.value.trim();
  if (!q) return;
  searchBtn.textContent = '...';
  searchBtn.disabled = true;
  searchResults.classList.remove('hidden');
  searchResults.innerHTML = '<div style="padding:16px;color:#94a3b8;text-align:center">Buscando...</div>';
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const videos = await res.json();
    if (!videos.length) {
      searchResults.innerHTML = '<div style="padding:16px;color:#94a3b8;text-align:center">Sin resultados</div>';
      return;
    }
    searchResults.innerHTML = videos.map(v => `
      <div class="result-item"
        data-id="${v.id}"
        data-thumb="${encodeURIComponent(v.thumbnail || '')}"
        data-title="${encodeURIComponent(v.title)}"
        data-author="${encodeURIComponent(v.author||'')}">
        <img class="result-thumb" src="${v.thumbnail || ''}" loading="lazy" onerror="this.style.display='none'">
        <div class="result-info">
          <div class="result-title">${v.title}</div>
          <div class="result-meta">${v.author || ''}</div>
        </div>
        <span class="result-duration">${v.duration || ''}</span>
      </div>
    `).join('');
    searchResults.querySelectorAll('.result-item').forEach(el => {
      el.addEventListener('click', () => loadVideo(
        el.dataset.id,
        decodeURIComponent(el.dataset.title),
        decodeURIComponent(el.dataset.author),
        decodeURIComponent(el.dataset.thumb)
      ));
    });
  } catch (e) {
    searchResults.innerHTML = `<div style="padding:16px;color:#f87171">Error: ${e.message}</div>`;
  } finally {
    searchBtn.textContent = 'Buscar';
    searchBtn.disabled = false;
  }
}

searchBtn.addEventListener('click', doSearch);
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

// ── Load Video ─────────────────────────────────────────────────────────────────
async function loadVideo(videoId, title, author, thumbUrl) {
  // Reset state
  cleanup();
  state.semitones = 0;
  state.speed = 1.0;
  semiDisplay.textContent = '0';
  speedDisplay.textContent = '×1.00';

  searchSection.classList.add('hidden');
  playerSection.classList.remove('hidden');
  loadingState.classList.remove('hidden');
  playerView.classList.add('hidden');

  songTitle.textContent = title;
  songArtist.textContent = author;

  songThumb.src = thumbUrl && thumbUrl !== 'undefined' ? thumbUrl
    : `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  // Fetch lyrics in parallel (non-blocking)
  fetchLyrics(title, author);

  try {
    // Download audio with progress
    loadingText.textContent = 'Descargando audio...';
    analysisFill.style.width = '0%';

    const response = await fetch(`/api/audio/${videoId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const reader = response.body.getReader();
    const contentLength = +response.headers.get('Content-Length') || 0;
    let received = 0;
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (contentLength) {
        const pct = Math.min(received / contentLength * 50, 50); // 0–50% for download
        analysisFill.style.width = pct + '%';
      }
    }

    loadingText.textContent = 'Decodificando audio...';
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const buffer = new Uint8Array(totalLen);
    let pos = 0;
    for (const chunk of chunks) { buffer.set(chunk, pos); pos += chunk.length; }
    const arrayBuffer = buffer.buffer;

    // Decode for analysis
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    state.audioCtx = audioCtx;
    const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice());

    // Analyze chords
    loadingText.textContent = 'Analizando acordes...';
    const result = await analyzeAudio(decoded, (progress) => {
      analysisFill.style.width = (50 + progress * 50) + '%';
    });
    analysisFill.style.width = '100%';

    state.chords = result.chords;
    state.duration = result.duration;
    state.bpm = result.bpm;
    state.key = result.key;
    state.uniqueChords = [...new Set(result.chords.map(c => c.chord))];

    // Build waveform data from decoded audio
    buildWaveformData(decoded);
    drawTimeline(0);

    // Setup Tone.js player with pitch shift
    const blob = new Blob([arrayBuffer], { type: 'audio/mp4' });
    const blobUrl = URL.createObjectURL(blob);

    state.pitchShift = new Tone.PitchShift({ pitch: 0 }).toDestination();
    state.tonePlayer = new Tone.Player({ url: blobUrl, onload: () => {} }).connect(state.pitchShift);
    await Tone.loaded();

    // Update UI
    bpmDisplay.textContent = result.bpm;
    keyDisplay.textContent = result.key;
    timeTotal.textContent = formatTime(result.duration);
    renderDiagrams();

    loadingState.classList.add('hidden');
    playerView.classList.remove('hidden');
    startAnimLoop();

  } catch (err) {
    loadingText.textContent = 'Error: ' + err.message;
    console.error(err);
  }
}

// ── Waveform ───────────────────────────────────────────────────────────────────
function buildWaveformData(audioBuffer) {
  const samples = audioBuffer.getChannelData(0);
  const numBuckets = 600;
  const bucketSize = Math.floor(samples.length / numBuckets);
  const data = new Float32Array(numBuckets);
  for (let i = 0; i < numBuckets; i++) {
    let max = 0;
    for (let j = 0; j < bucketSize; j++) {
      max = Math.max(max, Math.abs(samples[i * bucketSize + j]));
    }
    data[i] = max;
  }
  state.waveformData = data;
}

function drawTimeline(currentTime) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, W, H);

  // Chord color blocks (top 28px)
  const chordH = 28;
  for (const { time, endTime, chord } of state.chords) {
    const x1 = (time / state.duration) * W;
    const x2 = ((endTime || time + 0.5) / state.duration) * W;
    const transposed = transposeChord(chord, state.semitones);
    ctx.fillStyle = getChordColor(transposed);
    ctx.fillRect(x1, 2, Math.max(x2 - x1 - 1, 1), chordH - 4);
    if (x2 - x1 > 20) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(transposed.length > 4 ? transposed.substring(0,4) : transposed, (x1+x2)/2, 14);
    }
  }

  // Waveform (bottom)
  if (state.waveformData) {
    const waveTop = chordH + 4;
    const waveH = H - waveTop - 6;
    const midY = waveTop + waveH / 2;
    ctx.beginPath();
    for (let i = 0; i < state.waveformData.length; i++) {
      const x = (i / state.waveformData.length) * W;
      const amp = state.waveformData[i] * waveH * 0.8;
      ctx.fillStyle = currentTime && (i / state.waveformData.length) < (currentTime / state.duration)
        ? '#4ade80' : '#374151';
      ctx.fillRect(x, midY - amp / 2, Math.max((W / state.waveformData.length) - 0.5, 1), amp);
    }
  }

  // Playhead
  if (state.duration > 0) {
    const px = (currentTime / state.duration) * W;
    ctx.fillStyle = '#fff';
    ctx.fillRect(px - 1, 0, 2, H);
  }
}

// ── Diagrams ───────────────────────────────────────────────────────────────────
function renderDiagrams() {
  diagramsScroll.innerHTML = '';
  const transposedUnique = [...new Set(state.chords.map(c => transposeChord(c.chord, state.semitones)))];
  for (const chord of transposedUnique) {
    const card = document.createElement('div');
    card.className = 'chord-diagram-card';
    card.dataset.chord = chord;
    card.innerHTML = renderChordDiagram(chord, false);
    diagramsScroll.appendChild(card);
  }
}

function highlightDiagram(chordName) {
  const transposed = transposeChord(chordName, state.semitones);
  document.querySelectorAll('.chord-diagram-card').forEach(card => {
    const isActive = card.dataset.chord === transposed;
    card.classList.toggle('active', isActive);
    card.innerHTML = renderChordDiagram(card.dataset.chord, isActive);
    if (isActive) card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });
}

// ── Lyrics ─────────────────────────────────────────────────────────────────────
async function fetchLyrics(title, artist) {
  try {
    const res = await fetch(`/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`);
    const data = await res.json();
    if (!data) return;

    if (data.syncedLyrics) {
      parseLRC(data.syncedLyrics);
    } else if (data.plainLyrics) {
      renderPlainLyrics(data.plainLyrics);
    }
  } catch (e) {
    console.warn('Lyrics fetch failed:', e.message);
  }
}

function parseLRC(lrc) {
  const lines = lrc.split('\n');
  const parsed = [];
  for (const line of lines) {
    const m = line.match(/^\[(\d+):(\d+\.\d+)\](.*)/);
    if (m) {
      const time = parseFloat(m[1]) * 60 + parseFloat(m[2]);
      const text = m[3].trim();
      if (text) parsed.push({ time, text, chords: [] });
    }
  }

  // Assign chords to each lyric line based on timing
  for (const lyricLine of parsed) {
    const chordAtTime = getChordAt(lyricLine.time);
    lyricLine.chords = chordAtTime ? [transposeChord(chordAtTime, state.semitones)] : [];
  }

  state.lrcLines = parsed;
  renderSyncedLyrics(parsed);
}

function renderSyncedLyrics(lines) {
  lyricsContainer.innerHTML = lines.map((line, i) => `
    <div class="lyric-block" data-idx="${i}" data-time="${line.time}">
      ${line.chords.length ? `<div class="lyric-chords">${line.chords.map(c => `<span class="lyric-chord-marker">${c}</span>`).join('')}</div>` : ''}
      <div class="lyric-text">${line.text}</div>
    </div>
  `).join('');

  lyricsContainer.querySelectorAll('.lyric-block').forEach(el => {
    el.addEventListener('click', () => seekTo(parseFloat(el.dataset.time)));
  });
}

function renderPlainLyrics(text) {
  lyricsContainer.innerHTML = text.split('\n')
    .map(line => `<div class="lyric-text" style="line-height:1.9">${line || '&nbsp;'}</div>`)
    .join('');
}

function updateLyricsHighlight(currentTime) {
  if (!state.lrcLines.length) return;
  let activeIdx = -1;
  for (let i = 0; i < state.lrcLines.length; i++) {
    if (state.lrcLines[i].time <= currentTime) activeIdx = i;
    else break;
  }
  lyricsContainer.querySelectorAll('.lyric-text').forEach((el, i) => {
    el.classList.toggle('active', i === activeIdx);
  });
  if (activeIdx >= 0) {
    const el = lyricsContainer.querySelectorAll('.lyric-block')[activeIdx];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ── Chord lookup by time ────────────────────────────────────────────────────────
function getChordAt(time) {
  for (let i = state.chords.length - 1; i >= 0; i--) {
    if (state.chords[i].time <= time) return state.chords[i].chord;
  }
  return null;
}

// ── Time tracking (no Transport — track manually for reliability) ───────────────
function getCurrentTime() {
  if (!state.tonePlayer || !state.isPlaying) return state.pausedAt;
  const elapsed = (Tone.now() - state.playStartTime) * state.speed;
  return Math.min(state.playOffset + elapsed, state.duration);
}

// ── Animation loop ─────────────────────────────────────────────────────────────
function startAnimLoop() {
  cancelAnimationFrame(state.animFrame);
  (function loop() {
    if (state.tonePlayer) {
      const t = getCurrentTime();
      updateUI(t);
    }
    state.animFrame = requestAnimationFrame(loop);
  })();
}

function updateUI(t) {
  const pct = state.duration > 0 ? (t / state.duration) * 100 : 0;
  progressFill.style.width = pct + '%';
  progressThumb.style.left = pct + '%';
  timeCurrent.textContent = formatTime(t);

  const chord = getChordAt(t);
  if (chord) {
    const transposed = transposeChord(chord, state.semitones);
    const m = transposed.match(/^([A-G][#b]?)(.*)/);
    currentChordName.textContent = m ? m[1] : transposed;
    currentChordType.textContent = m ? (m[2] || '') : '';

    const newIdx = state.chords.findLastIndex(c => c.time <= t);
    if (newIdx !== state.currentChordIdx) {
      state.currentChordIdx = newIdx;
      highlightDiagram(chord);
    }
  }

  drawTimeline(t);
  updateLyricsHighlight(t);

  if (state.isPlaying && t >= state.duration - 0.15) {
    state.isPlaying = false;
    state.pausedAt = 0;
    state.playOffset = 0;
    playPauseBtn.textContent = '▶';
    try { state.tonePlayer.stop(); } catch(e) {}
  }
}

// ── Playback ───────────────────────────────────────────────────────────────────
playPauseBtn.addEventListener('click', async () => {
  if (!state.tonePlayer) return;
  await Tone.start(); // resume AudioContext on user gesture
  if (state.isPlaying) {
    state.pausedAt = getCurrentTime();
    try { state.tonePlayer.stop(); } catch(e) {}
    state.isPlaying = false;
    playPauseBtn.textContent = '▶';
  } else {
    state.playOffset = state.pausedAt;
    state.playStartTime = Tone.now();
    state.tonePlayer.start(Tone.now(), state.pausedAt);
    state.isPlaying = true;
    playPauseBtn.textContent = '⏸';
  }
});

function seekTo(time) {
  if (!state.tonePlayer) return;
  const newTime = Math.max(0, Math.min(time, state.duration));
  const wasPlaying = state.isPlaying;
  try { state.tonePlayer.stop(); } catch(e) {}
  state.pausedAt = newTime;
  state.isPlaying = false;
  if (wasPlaying) {
    state.playOffset = newTime;
    state.playStartTime = Tone.now();
    state.tonePlayer.start(Tone.now(), newTime);
    state.isPlaying = true;
    playPauseBtn.textContent = '⏸';
  }
}

$('seek-back').addEventListener('click', () => seekTo(getCurrentTime() - 10));
$('seek-fwd').addEventListener('click', () => seekTo(getCurrentTime() + 10));

// Progress click/drag
progressTrack.addEventListener('click', e => {
  const rect = progressTrack.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  seekTo(pct * state.duration);
});

// Timeline click
canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  seekTo(pct * state.duration);
});

// ── Semitones ──────────────────────────────────────────────────────────────────
$('semi-down').addEventListener('click', () => changeSemitones(-1));
$('semi-up').addEventListener('click', () => changeSemitones(1));

function changeSemitones(delta) {
  state.semitones = Math.max(-12, Math.min(12, state.semitones + delta));
  semiDisplay.textContent = (state.semitones >= 0 ? '+' : '') + state.semitones;
  if (state.pitchShift) state.pitchShift.pitch = state.semitones;

  // Update key display
  if (state.key) {
    const parts = state.key.split(' ');
    const transposedKey = transposeChord(parts[0], state.semitones);
    keyDisplay.textContent = transposedKey + ' ' + (parts[1] || '');
  }

  // Re-render diagrams with transposed chords
  renderDiagrams();

  // Re-highlight current chord
  const chord = getChordAt(getCurrentTime());
  if (chord) highlightDiagram(chord);
}

// ── Speed ──────────────────────────────────────────────────────────────────────
$('speed-down').addEventListener('click', () => changeSpeed(-0.1));
$('speed-up').addEventListener('click', () => changeSpeed(0.1));

function changeSpeed(delta) {
  const wasPlaying = state.isPlaying;
  const curTime = getCurrentTime();
  state.speed = Math.max(0.25, Math.min(2.0, Math.round((state.speed + delta) * 100) / 100));
  speedDisplay.textContent = '×' + state.speed.toFixed(2);
  if (state.tonePlayer) {
    if (wasPlaying) {
      try { state.tonePlayer.stop(); } catch(e) {}
      state.isPlaying = false;
    }
    state.tonePlayer.playbackRate = state.speed;
    state.pausedAt = curTime;
    if (wasPlaying) {
      state.playOffset = curTime;
      state.playStartTime = Tone.now();
      state.tonePlayer.start(Tone.now(), curTime);
      state.isPlaying = true;
    }
  }
}

// ── Tabs ───────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ── Back button ────────────────────────────────────────────────────────────────
backBtn.addEventListener('click', () => {
  cleanup();
  playerSection.classList.add('hidden');
  searchSection.classList.remove('hidden');
  searchResults.classList.add('hidden');
  searchInput.value = '';
});

// ── Cleanup ────────────────────────────────────────────────────────────────────
function cleanup() {
  cancelAnimationFrame(state.animFrame);
  if (state.tonePlayer) {
    try { state.tonePlayer.stop(); state.tonePlayer.dispose(); } catch(e) {}
    state.tonePlayer = null;
  }
  if (state.pitchShift) {
    try { state.pitchShift.dispose(); } catch(e) {}
    state.pitchShift = null;
  }
  state.chords = [];
  state.currentChordIdx = -1;
  state.isPlaying = false;
  state.pausedAt = 0;
  state.lrcLines = [];
  state.waveformData = null;
  currentChordName.textContent = '—';
  currentChordType.textContent = '';
  diagramsScroll.innerHTML = '';
  lyricsContainer.innerHTML = '<p class="no-lyrics">Sin letra disponible</p>';
  playPauseBtn.textContent = '▶';
  progressFill.style.width = '0%';
  progressThumb.style.left = '0%';
  timeCurrent.textContent = '0:00';
  timeTotal.textContent = '0:00';
}

// ── Responsive canvas ──────────────────────────────────────────────────────────
const ro = new ResizeObserver(() => { if (state.duration) drawTimeline(getCurrentTime()); });
ro.observe(canvas);
