const express = require('express');
const { execFile } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

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

app.listen(3333, () => {
  console.log('Media Extractor running \u2192 http://localhost:3333');
});
