const express = require('express');
const ejs = require('ejs');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const config = require('./config.json');

const app = express();
app.set('view engine', 'ejs');
app.use('/assets', express.static('assets'));
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,HEAD');
  res.set('Access-Control-Allow-Headers', 'Range');
  next();
});

app.get('/', (req, res) => {
  getRandomLink().then(link => {
    if (!link) {
      return res.status(500).send("Failed to get a working video link. Please check the server logs and ensure DISCORD_TOKEN is set in .env");
    }
    const videoFormat = getVideo(link.split('.').pop().toLowerCase().split('?')[0]);
    const commitHash = (() => { try { return require('child_process').execSync('git rev-parse HEAD').toString().trim(); } catch (err) { return null; } })();

    res.render('index', {
      name: config.NAME,
      slogan: config.SLOGAN,
      version: commitHash?.substring(0, 7) || 'unknown',
      link: link,
      videoFormat: videoFormat,
      pageContent: config.PAGE_CONTENT,
      commitHash: commitHash
    });
  });
});

app.get('/dummy/*', (req, res) => {
  res.sendFile(`${__dirname}/assets/videos/dummyvideo.mp4`);
});

app.get('/api/link', (req, res) => {
  getRandomLink().then(link => {
    if (!link) return res.status(500).send("Failed to get link");
    res.send(link);
  });
});

app.get('/api/check-video', async (req, res) => {
  const videoUrl = decodeURIComponent(req.query.url);

  try {
    const absoluteUrl = videoUrl.startsWith('/') ? `${req.protocol}://${req.headers.host}${videoUrl}` : videoUrl;
    const response = await fetch(absoluteUrl, { method: 'HEAD' });
    const mimeType = response.headers.get('Content-Type');

    if ((mimeType !== 'video/mp4' && mimeType !== 'video/webm' && mimeType !== 'video/quicktime' && mimeType !== 'video/ogg' && !mimeType) || response.status !== 200) {
      return res.json({
        error: "Video unavailable",
        message: `Unfortunately, this video has either been deleted or is not supported on your device. Received mimeType: ${mimeType} (HTTP status code: ${response.status})`
      });
    }

    return res.json({ success: true });

  } catch (err) {
    console.error(err);

    return res.json({
      error: "API Error",
      message: `/api/check-video/${videoUrl} returned an error: ${err}`
    });
  }
});

app.head('/stream', async (req, res) => {
  const videoUrl = req.query.url ? decodeURIComponent(req.query.url) : null;
  if (!videoUrl) return res.status(400).end();

  if (!isAllowedDiscordUrl(videoUrl)) return res.status(400).end();

  try {
    const headers = baseUpstreamHeaders(req.headers.range);
    const upstream = await fetch(videoUrl, { method: 'HEAD', headers });
    copyUpstreamHeaders(upstream, res);
    return res.status(upstream.status).end();
  } catch (err) {
    console.error(err);
    return res.status(502).end();
  }
});

app.get('/stream', async (req, res) => {
  const videoUrl = req.query.url ? decodeURIComponent(req.query.url) : null;
  if (!videoUrl) return res.status(400).json({ error: 'Missing url' });

  if (!isAllowedDiscordUrl(videoUrl)) {
    return res.status(400).json({ error: 'Unsupported host', message: 'Only Discord CDN URLs are allowed' });
  }

  try {
    const headers = baseUpstreamHeaders(req.headers.range);
    const upstream = await fetch(videoUrl, { headers });

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).json({ error: 'Upstream error', message: `Discord returned ${upstream.status}` });
    }

    copyUpstreamHeaders(upstream, res);
    res.status(upstream.status);
    upstream.body.pipe(res);
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: 'Proxy error', message: String(err) });
  }
});

function getVideo(videoFormat) {
  switch (videoFormat) {
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'ogg':
      return 'video/ogg';
    case 'mov':
      return 'video/quicktime';
    default:
      return 'video/mp4';
  }
}

async function getRandomLineFromGithub() {
  const url = 'https://raw.githubusercontent.com/TubeCord/database/main/discord_cdn_links.txt';

  try {
    const response = await fetch(url);
    const data = await response.text();
    const lines = data.split('\n').filter(line => line.trim() !== '');
    const randomIndex = Math.floor(Math.random() * lines.length);
    return lines[randomIndex];
  } catch (error) {
    console.error('Failed to fetch the content:', error);
    return null;
  }
}

async function refreshLink(originalUrl) {
  if (!process.env.DISCORD_TOKEN) {
    console.warn("DISCORD_TOKEN not set. Skipping link refresh.");
    return originalUrl;
  }

  try {
    const response = await fetch('https://discord.com/api/v9/attachments/refresh-urls', {
      method: 'POST',
      headers: {
        'Authorization': process.env.DISCORD_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        attachment_urls: [originalUrl]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Failed to refresh link: ${response.status} ${text}`);
      return null;
    }

    const data = await response.json();
    if (data.refreshed_urls && data.refreshed_urls.length > 0) {
      return data.refreshed_urls[0].refreshed;
    }
    return null;
  } catch (err) {
    console.error("Error refreshing link:", err);
    return null;
  }
}

async function getRandomLink(retries = 5) {
  if (retries === 0) return null;

  const localListPath = path.resolve(__dirname, '..', 'database', 'discord_cdn_links.txt');
  let link = null;

  try {
    const data = await fs.promises.readFile(localListPath, 'utf-8');
    const lines = data.split(/\r?\n/).filter(line => line.trim() !== '');
    const randomIndex = Math.floor(Math.random() * lines.length);
    link = lines[randomIndex];
  } catch (error) {
    console.error('Failed to read local database. Falling back to GitHub.', error);
    link = await getRandomLineFromGithub();
  }

  if (link) {
    // Refresh the link if possible
    const refreshed = await refreshLink(link);
    const finalLink = refreshed || link;

    // Verify the link works before returning
    try {
      const response = await fetch(finalLink, { method: 'HEAD' });
      if (response.ok) {
        return finalLink;
      } else {
        console.warn(`Link ${finalLink} returned ${response.status}. Retrying...`);
        return getRandomLink(retries - 1);
      }
    } catch (err) {
      console.warn(`Error checking link ${finalLink}: ${err}. Retrying...`);
      return getRandomLink(retries - 1);
    }
  }
  return getRandomLink(retries - 1);
}

function isAllowedDiscordUrl(url) {
  try {
    const parsed = new URL(url);
    return ['cdn.discordapp.com', 'media.discordapp.net'].includes(parsed.hostname);
  } catch (_) {
    return false;
  }
}
function baseUpstreamHeaders(rangeHeader) {
  const headers = {
    'referer': 'https://discord.com/',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  };
  if (rangeHeader) headers['range'] = rangeHeader;
  return headers;
}
function copyUpstreamHeaders(upstream, res) {
  const ct = upstream.headers.get('content-type'); if (ct) res.set('Content-Type', ct);
  const cl = upstream.headers.get('content-length'); if (cl) res.set('Content-Length', cl);
  const cr = upstream.headers.get('content-range'); if (cr) res.set('Content-Range', cr);
  const ar = upstream.headers.get('accept-ranges'); if (ar) res.set('Accept-Ranges', ar);
  const cache = upstream.headers.get('cache-control'); if (cache) res.set('Cache-Control', cache);
}

const PORT = process.env.PORT || config.PORT;
app.listen(PORT, () => console.log(`\nApp is up @ http://localhost:${PORT}`));
