const express = require('express');
const { execFile } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { extractPhotos } = require('./scraper');
const { downloadAll } = require('./downloader');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// POST /browse-folder
// Opens native Windows FolderBrowserDialog via PowerShell.
// Returns { path: "C:\\chosen\\folder" } or { path: null } if cancelled.
app.post('/browse-folder', (req, res) => {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description = 'Seleccionar carpeta de destino'
$d.ShowNewFolderButton = $true
if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $d.SelectedPath
}
`.trim();

  const tmpScript = path.join(os.tmpdir(), 'folder_picker.ps1');
  fs.writeFileSync(tmpScript, script, 'utf8');

  execFile('powershell', ['-NoProfile', '-NonInteractive', '-File', tmpScript], (err, stdout) => {
    fs.unlink(tmpScript, () => {});
    const chosen = stdout.trim();
    res.json({ path: chosen || null });
  });
});

// POST /extract
// Body: { url: string }
// Returns: { images: string[], videos: string[] } or { error: string }
app.post('/extract', async (req, res) => {
  const { url } = req.body;

  if (!url || !url.includes('google')) {
    return res.status(400).json({ error: 'Pegá un link de Google Maps válido.' });
  }

  try {
    const result = await extractPhotos(url);
    if (result.images.length === 0 && result.videos.length === 0) {
      return res.status(404).json({ error: 'No se encontraron fotos en este lugar.' });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /download
// Body: { files: Array<{ url, type }>, folder: string }
// Response: SSE stream of progress events
app.post('/download', async (req, res) => {
  const { files, folder } = req.body;

  if (!folder) {
    return res.status(400).json({ error: 'Seleccioná una carpeta primero.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    await downloadAll(files, folder, send);
  } catch (err) {
    send({ error: err.message });
  }

  res.end();
});

app.listen(3333, () => {
  console.log('Media Extractor running \u2192 http://localhost:3333');
});
