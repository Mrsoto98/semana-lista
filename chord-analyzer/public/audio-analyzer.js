// ── FFT (in-place Cooley-Tukey, power-of-2 size) ──────────────────────────────
function fft(re, im) {
  const n = re.length;
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  // Butterfly
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let uRe = 1, uIm = 0;
      for (let k = 0; k < len >> 1; k++) {
        const idx = i + k + (len >> 1);
        const tRe = uRe * re[idx] - uIm * im[idx];
        const tIm = uRe * im[idx] + uIm * re[idx];
        re[idx] = re[i+k] - tRe;
        im[idx] = im[i+k] - tIm;
        re[i+k] += tRe;
        im[i+k] += tIm;
        [uRe, uIm] = [uRe*wRe - uIm*wIm, uRe*wIm + uIm*wRe];
      }
    }
  }
}

// ── Hanning window ─────────────────────────────────────────────────────────────
function hanningWindow(n) {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
  return w;
}

// ── Precompute note-bin mapping: FFT bin → pitch class (0-11) ──────────────────
function buildNoteBins(sampleRate, frameSize) {
  const bins = new Int8Array(frameSize >> 1).fill(-1);
  const C2 = 65.41; // C2 frequency
  const maxFreq = Math.min(sampleRate / 2, 4200); // up to C8
  for (let k = 1; k < (frameSize >> 1); k++) {
    const freq = k * sampleRate / frameSize;
    if (freq < C2 || freq > maxFreq) continue;
    const note = Math.round(12 * Math.log2(freq / C2));
    bins[k] = ((note % 12) + 12) % 12;
  }
  return bins;
}

// ── Chord templates ────────────────────────────────────────────────────────────
function buildChordTemplates() {
  const templates = {};
  for (let root = 0; root < 12; root++) {
    const name = CHROMATIC[root];
    const maj = new Float32Array(12);
    maj[root] = 1; maj[(root+4)%12] = 0.8; maj[(root+7)%12] = 0.8;
    templates[name] = maj;

    const min = new Float32Array(12);
    min[root] = 1; min[(root+3)%12] = 0.8; min[(root+7)%12] = 0.8;
    templates[name + 'm'] = min;

    const dom7 = new Float32Array(12);
    dom7[root] = 1; dom7[(root+4)%12] = 0.7; dom7[(root+7)%12] = 0.7; dom7[(root+10)%12] = 0.5;
    templates[name + '7'] = dom7;
  }
  return templates;
}

function cosineSim(a, b) {
  let dot = 0, mA = 0, mB = 0;
  for (let i = 0; i < 12; i++) { dot += a[i]*b[i]; mA += a[i]*a[i]; mB += b[i]*b[i]; }
  return dot / (Math.sqrt(mA * mB) + 1e-9);
}

function matchChord(chroma, templates) {
  let best = 'N', score = 0.28;
  for (const [name, tmpl] of Object.entries(templates)) {
    const s = cosineSim(chroma, tmpl);
    if (s > score) { score = s; best = name; }
  }
  return best;
}

// ── Key detection (Krumhansl-Schmuckler) ──────────────────────────────────────
const KS_MAJOR = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const KS_MINOR = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

function detectKey(allChroma) {
  const avg = new Float32Array(12);
  for (const c of allChroma) for (let i = 0; i < 12; i++) avg[i] += c[i];
  const n = allChroma.length;
  for (let i = 0; i < 12; i++) avg[i] /= n;

  let bestKey = 'C', bestScore = -Infinity, major = true;
  for (let root = 0; root < 12; root++) {
    const mj = new Float32Array(12).map((_, i) => KS_MAJOR[(i - root + 12) % 12]);
    const mn = new Float32Array(12).map((_, i) => KS_MINOR[(i - root + 12) % 12]);
    const sm = cosineSim(avg, mj), sn = cosineSim(avg, mn);
    if (sm > bestScore) { bestScore = sm; bestKey = CHROMATIC[root]; major = true; }
    if (sn > bestScore) { bestScore = sn; bestKey = CHROMATIC[root]; major = false; }
  }
  return `${bestKey} ${major ? 'Mayor' : 'menor'}`;
}

// ── BPM detection (autocorrelation on energy envelope) ────────────────────────
function detectBPM(channelData, sampleRate) {
  const frameSize = 512, hopSize = 256;
  const energies = [];
  for (let i = 0; i + frameSize < channelData.length; i += hopSize) {
    let e = 0;
    for (let j = 0; j < frameSize; j++) e += channelData[i+j] ** 2;
    energies.push(e / frameSize);
  }
  const onset = energies.map((e, i) => i > 0 ? Math.max(0, e - energies[i-1]) : 0);
  const minLag = Math.floor(60 / 200 * sampleRate / hopSize);
  const maxLag = Math.ceil(60 / 50 * sampleRate / hopSize);
  let bestBPM = 120, bestCorr = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    const lim = Math.min(onset.length - lag, 1000);
    for (let i = 0; i < lim; i++) c += onset[i] * onset[i + lag];
    if (c > bestCorr) { bestCorr = c; bestBPM = Math.round(60 / (lag * hopSize / sampleRate)); }
  }
  return bestBPM;
}

// ── Chord smoothing ────────────────────────────────────────────────────────────
function smoothChords(raw, minDuration = 0.35) {
  if (!raw.length) return [];
  // Median filter: for each frame, use most common chord in ±3-frame window
  const filtered = raw.map((item, i) => {
    const window = raw.slice(Math.max(0, i-3), Math.min(raw.length, i+4));
    const counts = {};
    for (const {chord} of window) counts[chord] = (counts[chord] || 0) + 1;
    let best = item.chord, max = 0;
    for (const [c, n] of Object.entries(counts)) if (n > max) { max = n; best = c; }
    return { time: item.time, chord: best };
  });

  // Merge adjacent identical chords
  const merged = [];
  let cur = null;
  for (const {time, chord} of filtered) {
    if (!cur) { cur = { time, chord, endTime: time }; }
    else if (chord === cur.chord) { cur.endTime = time; }
    else { merged.push(cur); cur = { time, chord, endTime: time }; }
  }
  if (cur) merged.push(cur);

  return merged.filter(c => (c.endTime - c.time) >= minDuration * 0.4 && c.chord !== 'N');
}

// ── Main analysis function ─────────────────────────────────────────────────────
async function analyzeAudio(audioBuffer, onProgress) {
  const frameSize = 4096;
  const hopSize = 2048;
  const sr = audioBuffer.sampleRate;
  // Mix to mono
  let pcm;
  if (audioBuffer.numberOfChannels >= 2) {
    const L = audioBuffer.getChannelData(0);
    const R = audioBuffer.getChannelData(1);
    pcm = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) pcm[i] = (L[i] + R[i]) * 0.5;
  } else {
    pcm = audioBuffer.getChannelData(0);
  }

  const hann = hanningWindow(frameSize);
  const noteBins = buildNoteBins(sr, frameSize);
  const templates = buildChordTemplates();

  const numFrames = Math.floor((pcm.length - frameSize) / hopSize);
  const rawChords = [];
  const allChroma = [];
  const reArr = new Float64Array(frameSize);
  const imArr = new Float64Array(frameSize);

  for (let fi = 0; fi < numFrames; fi++) {
    const offset = fi * hopSize;
    for (let i = 0; i < frameSize; i++) {
      reArr[i] = pcm[offset + i] * hann[i];
      imArr[i] = 0;
    }
    fft(reArr, imArr);

    const chroma = new Float32Array(12);
    for (let k = 1; k < (frameSize >> 1); k++) {
      const nc = noteBins[k];
      if (nc >= 0) {
        const mag = reArr[k]*reArr[k] + imArr[k]*imArr[k];
        chroma[nc] += mag;
      }
    }
    const sum = chroma.reduce((a, b) => a + b, 0);
    if (sum > 0) for (let i = 0; i < 12; i++) chroma[i] /= sum;
    allChroma.push(chroma);

    const chord = matchChord(chroma, templates);
    rawChords.push({ time: offset / sr, chord });

    if (fi % 80 === 0) {
      onProgress && onProgress(fi / numFrames);
      await new Promise(r => setTimeout(r, 0)); // yield
    }
  }

  const chords = smoothChords(rawChords);
  const key = detectKey(allChroma);
  const bpm = detectBPM(pcm, sr);
  return { chords, key, bpm, duration: pcm.length / sr };
}
