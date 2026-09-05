// Guitar chord fingering database
// frets: [string6, string5, string4, string3, string2, string1] (low E to high E)
// -1 = muted, 0 = open, N = fret number
const CHORD_SHAPES = {
  'C':   { frets: [-1,3,2,0,1,0], fingers: [0,3,2,0,1,0] },
  'C#':  { frets: [-1,4,3,1,2,1], fingers: [0,4,3,1,2,1], barre:{fret:4,str:1}, startFret:1 },
  'Db':  { frets: [-1,4,3,1,2,1], fingers: [0,4,3,1,2,1], barre:{fret:4,str:1}, startFret:1 },
  'D':   { frets: [-1,-1,0,2,3,2], fingers: [0,0,0,1,3,2] },
  'D#':  { frets: [-1,-1,1,3,4,3], fingers: [0,0,1,2,4,3] },
  'Eb':  { frets: [-1,-1,1,3,4,3], fingers: [0,0,1,2,4,3] },
  'E':   { frets: [0,2,2,1,0,0], fingers: [0,2,3,1,0,0] },
  'F':   { frets: [1,3,3,2,1,1], fingers: [1,3,4,2,1,1], barre:{fret:1,str:0}, startFret:1 },
  'F#':  { frets: [2,4,4,3,2,2], fingers: [1,3,4,2,1,1], barre:{fret:2,str:0}, startFret:2 },
  'Gb':  { frets: [2,4,4,3,2,2], fingers: [1,3,4,2,1,1], barre:{fret:2,str:0}, startFret:2 },
  'G':   { frets: [3,2,0,0,0,3], fingers: [2,1,0,0,0,3] },
  'G#':  { frets: [4,3,1,1,1,4], fingers: [4,3,1,1,1,4], barre:{fret:1,str:0}, startFret:1 },
  'Ab':  { frets: [4,3,1,1,1,4], fingers: [4,3,1,1,1,4], barre:{fret:1,str:0}, startFret:1 },
  'A':   { frets: [-1,0,2,2,2,0], fingers: [0,0,1,2,3,0] },
  'A#':  { frets: [-1,1,3,3,3,1], fingers: [0,1,2,3,4,1], barre:{fret:1,str:1}, startFret:1 },
  'Bb':  { frets: [-1,1,3,3,3,1], fingers: [0,1,2,3,4,1], barre:{fret:1,str:1}, startFret:1 },
  'B':   { frets: [-1,2,4,4,4,2], fingers: [0,1,2,3,4,1], barre:{fret:2,str:1}, startFret:2 },
  'Cm':  { frets: [-1,3,5,5,4,3], fingers: [0,1,3,4,2,1], barre:{fret:3,str:1}, startFret:3 },
  'C#m': { frets: [-1,4,6,6,5,4], fingers: [0,1,3,4,2,1], barre:{fret:4,str:1}, startFret:4 },
  'Dbm': { frets: [-1,4,6,6,5,4], fingers: [0,1,3,4,2,1], barre:{fret:4,str:1}, startFret:4 },
  'Dm':  { frets: [-1,-1,0,2,3,1], fingers: [0,0,0,2,3,1] },
  'D#m': { frets: [-1,-1,1,3,4,2], fingers: [0,0,1,3,4,2] },
  'Ebm': { frets: [-1,-1,1,3,4,2], fingers: [0,0,1,3,4,2] },
  'Em':  { frets: [0,2,2,0,0,0], fingers: [0,2,3,0,0,0] },
  'Fm':  { frets: [1,3,3,1,1,1], fingers: [1,3,4,1,1,1], barre:{fret:1,str:0}, startFret:1 },
  'F#m': { frets: [2,4,4,2,2,2], fingers: [1,3,4,1,1,1], barre:{fret:2,str:0}, startFret:2 },
  'Gbm': { frets: [2,4,4,2,2,2], fingers: [1,3,4,1,1,1], barre:{fret:2,str:0}, startFret:2 },
  'Gm':  { frets: [3,5,5,3,3,3], fingers: [1,3,4,1,1,1], barre:{fret:3,str:0}, startFret:3 },
  'G#m': { frets: [4,6,6,4,4,4], fingers: [1,3,4,1,1,1], barre:{fret:4,str:0}, startFret:4 },
  'Abm': { frets: [4,6,6,4,4,4], fingers: [1,3,4,1,1,1], barre:{fret:4,str:0}, startFret:4 },
  'Am':  { frets: [-1,0,2,2,1,0], fingers: [0,0,2,3,1,0] },
  'A#m': { frets: [-1,1,3,3,2,1], fingers: [0,1,3,4,2,1], barre:{fret:1,str:1}, startFret:1 },
  'Bbm': { frets: [-1,1,3,3,2,1], fingers: [0,1,3,4,2,1], barre:{fret:1,str:1}, startFret:1 },
  'Bm':  { frets: [-1,2,4,4,3,2], fingers: [0,1,3,4,2,1], barre:{fret:2,str:1}, startFret:2 },
  'A7':  { frets: [-1,0,2,0,2,0], fingers: [0,0,2,0,3,0] },
  'B7':  { frets: [-1,2,1,2,0,2], fingers: [0,2,1,3,0,4] },
  'C7':  { frets: [-1,3,2,3,1,0], fingers: [0,3,2,4,1,0] },
  'D7':  { frets: [-1,-1,0,2,1,2], fingers: [0,0,0,2,1,3] },
  'E7':  { frets: [0,2,0,1,0,0], fingers: [0,2,0,1,0,0] },
  'F7':  { frets: [1,3,1,2,1,1], fingers: [1,3,1,2,1,1], barre:{fret:1,str:0}, startFret:1 },
  'G7':  { frets: [3,2,0,0,0,1], fingers: [3,2,0,0,0,1] },
  'Maj7':{ frets: [-1,3,2,4,4,3], fingers: [0,2,1,4,3,2] },
};

const CHORD_COLORS = {
  'C':'#ef4444','C#':'#f97316','Db':'#f97316',
  'D':'#f59e0b','D#':'#eab308','Eb':'#eab308',
  'E':'#84cc16','F':'#22c55e','F#':'#10b981','Gb':'#10b981',
  'G':'#14b8a6','G#':'#06b6d4','Ab':'#06b6d4',
  'A':'#3b82f6','A#':'#6366f1','Bb':'#6366f1',
  'B':'#8b5cf6','N':'#374151',
};

const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function getChordRoot(chordName) {
  const m = chordName.match(/^([A-G][#b]?)/);
  return m ? m[1] : null;
}

function transposeChord(chordName, semitones) {
  if (!chordName || chordName === 'N' || chordName === '-') return chordName;
  const m = chordName.match(/^([A-G][#b]?)(.*)/);
  if (!m) return chordName;
  const [, root, suffix] = m;
  const idx = CHROMATIC.findIndex(n => n === root ||
    (root.includes('b') && CHROMATIC[CHROMATIC.indexOf(n) > 0 ? CHROMATIC.indexOf(n)-1 : 11] === root.replace('b','#')));
  if (idx === -1) {
    // handle flats by converting
    const flatToSharp = {'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#'};
    const sharpRoot = flatToSharp[root] || root;
    const idx2 = CHROMATIC.indexOf(sharpRoot);
    if (idx2 === -1) return chordName;
    const newIdx = ((idx2 + semitones) % 12 + 12) % 12;
    return CHROMATIC[newIdx] + suffix;
  }
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  return CHROMATIC[newIdx] + suffix;
}

function getChordColor(chordName) {
  const root = getChordRoot(chordName);
  return root ? (CHORD_COLORS[root] || '#6b7280') : '#374151';
}

function renderChordDiagram(chordName, isActive = false) {
  const W = 110, H = 155;
  const ml = 18, mt = 32, mr = 8, mb = 28;
  const gW = W - ml - mr;
  const gH = H - mt - mb;
  const numStr = 6, numFrets = 4;
  const sSpacing = gW / (numStr - 1);
  const fSpacing = gH / numFrets;
  const shape = CHORD_SHAPES[chordName];
  const dotColor = isActive ? '#4ade80' : '#9ca3af';
  const lineColor = isActive ? '#4ade80' : '#6b7280';
  const textColor = isActive ? '#4ade80' : '#9ca3af';

  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="chord-svg${isActive?' active':''}">`;

  if (!shape) {
    s += `<text x="${W/2}" y="${H/2-5}" text-anchor="middle" fill="${textColor}" font-size="24" font-weight="bold">?</text>`;
    s += `<text x="${W/2}" y="${H-6}" text-anchor="middle" fill="${isActive?'#fff':'#d1d5db'}" font-size="13" font-weight="bold">${chordName}</text>`;
    s += `</svg>`;
    return s;
  }

  const { frets, fingers, barre, startFret = 0 } = shape;
  const sf = startFret || 0;

  // Nut or fret number indicator
  if (sf === 0) {
    s += `<line x1="${ml}" y1="${mt}" x2="${ml+gW}" y2="${mt}" stroke="${lineColor}" stroke-width="3"/>`;
  } else {
    s += `<text x="${ml-4}" y="${mt + fSpacing*0.65}" text-anchor="end" fill="${textColor}" font-size="9">${sf}fr</text>`;
  }

  // Fret lines
  for (let f = 0; f <= numFrets; f++) {
    const y = mt + f * fSpacing;
    s += `<line x1="${ml}" y1="${y}" x2="${ml+gW}" y2="${y}" stroke="${lineColor}" stroke-width="0.8" opacity="0.5"/>`;
  }

  // Strings
  for (let i = 0; i < numStr; i++) {
    const x = ml + i * sSpacing;
    s += `<line x1="${x}" y1="${mt}" x2="${x}" y2="${mt+gH}" stroke="${lineColor}" stroke-width="1" opacity="0.6"/>`;
  }

  // Barre
  if (barre) {
    const by = mt + (barre.fret - sf - 0.5) * fSpacing;
    const fromStr = barre.str || 0;
    const bx1 = ml + fromStr * sSpacing;
    const bx2 = ml + gW;
    s += `<rect x="${bx1-6}" y="${by-7}" width="${bx2-bx1+12}" height="14" rx="7" fill="${dotColor}" opacity="0.85"/>`;
  }

  // Mute/open markers and dots
  for (let i = 0; i < numStr; i++) {
    const x = ml + i * sSpacing;
    const fret = frets[i];
    const finger = fingers ? fingers[i] : 0;

    if (fret === -1) {
      // Muted
      s += `<text x="${x}" y="${mt-8}" text-anchor="middle" fill="${textColor}" font-size="11">×</text>`;
    } else if (fret === 0) {
      // Open
      s += `<circle cx="${x}" cy="${mt-10}" r="5" fill="none" stroke="${lineColor}" stroke-width="1.5"/>`;
    } else {
      const fy = mt + (fret - sf - 0.5) * fSpacing;
      const isBarred = barre && fret === barre.fret && i >= (barre.str || 0);
      if (!isBarred) {
        s += `<circle cx="${x}" cy="${fy}" r="8.5" fill="${dotColor}"/>`;
        if (finger && finger > 0) {
          s += `<text x="${x}" y="${fy+4}" text-anchor="middle" fill="#111" font-size="9" font-weight="bold">${finger}</text>`;
        }
      }
    }
  }

  // String note names at bottom
  const openNotes = ['E','A','D','G','B','E'];
  for (let i = 0; i < numStr; i++) {
    const x = ml + i * sSpacing;
    s += `<text x="${x}" y="${H-mb+14}" text-anchor="middle" fill="${textColor}" font-size="8">${openNotes[i]}</text>`;
  }

  // Chord name
  s += `<text x="${W/2}" y="${H-4}" text-anchor="middle" fill="${isActive?'#fff':'#e5e7eb'}" font-size="14" font-weight="bold">${chordName}</text>`;
  s += `</svg>`;
  return s;
}
