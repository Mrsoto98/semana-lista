const puppeteer = require('puppeteer');

/**
 * Navigates to a Google Maps place URL, opens the photo gallery,
 * scrolls until all photos are loaded, and returns deduplicated
 * high-resolution image URLs and video URLs.
 *
 * @param {string} url - Google Maps place URL
 * @returns {Promise<{ images: string[], videos: string[] }>}
 */
async function extractPhotos(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=es-419,es'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 900 });

    // Navigate to Maps URL
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Click the "Photos" tab/button — selector works for both English and Spanish Maps
    const photoSelectors = [
      'button[aria-label*="Photo"]',
      'button[aria-label*="Foto"]',
      'button[data-tab-index="0"][aria-label*="oto"]',
      '[data-item-id="photos"] button',
    ];

    let clickedPhotos = false;
    for (const sel of photoSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 5000 });
        await page.click(sel);
        clickedPhotos = true;
        break;
      } catch (_) {}
    }

    // If no photos button found, try clicking first gallery image visible
    if (!clickedPhotos) {
      const imgSel = 'div[data-photo-index] img, img[src*="googleusercontent"]';
      try {
        await page.waitForSelector(imgSel, { timeout: 8000 });
        await page.click(imgSel);
      } catch (_) {
        throw new Error('No se encontró la galería de fotos en esta página.');
      }
    }

    // Wait for photo panel to appear
    await page.waitForSelector('div[role="main"] img[src*="googleusercontent"]', {
      timeout: 15000,
    });
    await new Promise(r => setTimeout(r, 2000));

    // Scroll the photo panel until no new images load
    const images = await scrollAndCollect(page);
    const videos = await collectVideos(page);

    return { images, videos };
  } finally {
    await browser.close();
  }
}

/**
 * Scrolls the active photo panel, collecting image URLs after each scroll
 * until the count stops growing. Returns deduplicated high-res URLs.
 */
async function scrollAndCollect(page) {
  let previousCount = 0;
  let stableRounds = 0;
  const maxStable = 3; // stop after 3 scrolls with no new images

  while (stableRounds < maxStable) {
    // Scroll down inside the photo panel
    await page.evaluate(() => {
      const panel =
        document.querySelector('div[role="main"]') ||
        document.querySelector('.m6QErb') ||
        document.body;
      panel.scrollBy(0, 3000);
    });
    await new Promise(r => setTimeout(r, 1500));

    const current = await countImages(page);
    if (current > previousCount) {
      previousCount = current;
      stableRounds = 0;
    } else {
      stableRounds++;
    }
  }

  // Collect all image URLs and upgrade to max resolution
  const urls = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img[src*="googleusercontent"]');
    return [...imgs].map(img => img.src);
  });

  return deduplicateAndUpscale(urls);
}

async function countImages(page) {
  return page.evaluate(() =>
    document.querySelectorAll('img[src*="googleusercontent"]').length
  );
}

/** Remove duplicates and rewrite URLs to request max resolution */
function deduplicateAndUpscale(urls) {
  const seen = new Set();
  return urls
    .filter(url => {
      // Skip tiny icons / avatars (profile pictures, etc.)
      if (url.includes('=s') && !url.includes('photo')) return false;
      const base = url.split('=')[0];
      if (seen.has(base)) return false;
      seen.add(base);
      return true;
    })
    .map(url => {
      // Replace any existing size params with max resolution
      const base = url.split('=')[0];
      return `${base}=w1920-h1080-k-no`;
    });
}

/** Collect video URLs from the page */
async function collectVideos(page) {
  return page.evaluate(() => {
    const sources = document.querySelectorAll('video source[src], video[src]');
    return [...sources]
      .map(el => el.src)
      .filter(src => src && src.startsWith('http'));
  });
}

module.exports = { extractPhotos };
