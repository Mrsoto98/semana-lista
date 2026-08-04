const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Downloads a single file from url to destPath.
 * Skips if file already exists.
 * @returns {Promise<'downloaded'|'skipped'>}
 */
async function downloadFile(url, destPath) {
  if (fs.existsSync(destPath)) return 'skipped';

  const response = await axios.get(url, {
    responseType: 'stream',
    timeout: 30000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Referer: 'https://www.google.com/',
    },
  });

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  return 'downloaded';
}

/**
 * Downloads all files in the list to folder, streaming progress via SSE.
 *
 * @param {Array<{ url: string, type: 'image'|'video' }>} files
 * @param {string} folder  - absolute path to destination folder
 * @param {(event: object) => void} onProgress  - called after each file
 */
async function downloadAll(files, folder, onProgress) {
  fs.mkdirSync(folder, { recursive: true });

  let imageCount = 0;
  let videoCount = 0;
  let downloaded = 0;
  let errors = 0;

  for (let i = 0; i < files.length; i++) {
    const { url, type } = files[i];

    let filename;
    if (type === 'video') {
      videoCount++;
      filename = `video_${String(videoCount).padStart(3, '0')}.mp4`;
    } else {
      imageCount++;
      filename = `foto_${String(imageCount).padStart(3, '0')}.jpg`;
    }

    const destPath = path.join(folder, filename);

    try {
      const status = await downloadFile(url, destPath);
      if (status === 'downloaded') downloaded++;
    } catch (err) {
      errors++;
      console.error(`Error descargando ${url}: ${err.message}`);
    }

    onProgress({ done: i + 1, total: files.length, filename, errors });
  }

  onProgress({ finished: true, downloaded, errors, total: files.length });
}

module.exports = { downloadAll };
