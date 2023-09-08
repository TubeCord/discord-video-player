const express = require('express');
const ejs = require('ejs');
const fetch = require('node-fetch');
const config = require('./config.json');
const package = require('./package.json');
const {execSync} = require('child_process');

const app = express();
// set the view engine to ejs
app.set('view engine', 'ejs');
// static assets
app.use('/assets', express.static('assets'));

// routes
app.get('/', (req, res) => {
  getRandomLineFromGithub().then(link => {
    const videoFormat = getVideo(link.split('.').pop().toLowerCase());
    const commitHash = (() => {try {return require('child_process').execSync('git rev-parse HEAD').toString().trim();} catch (err) {return null;} })();

    res.render('index', {
      name: config.NAME,
      version: commitHash.substring(0, 7) || 'unknown',
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
  getRandomLineFromGithub().then(link => {
    res.send(link);
  });
});

app.get('/api/check-video', async (req, res) => {
  const videoUrl = decodeURIComponent(req.query.url);

  try {
    const response = await fetch(videoUrl, {method: 'HEAD'});
    const mimeType = response.headers.get('Content-Type');

    if (mimeType === 'video/quicktime') {
      return res.json({
        error: "Uh oh!",
        message: "This .mov file may not play depending on its encoding. If it doesn't play, try using Safari or downloading the video to your device."
      });
    } else if (mimeType !== 'video/mp4' && mimeType !== 'video/webm' && !mimeType && response.status !== 200) {
      return res.json({
        error: "Video unavailable",
        message: `Unfortunately, this video has either been deleted or is not supported on your device. Video format: ${ mimeType } (HTTP status code: ${ response.status }))`
      });
    }

    return res.json({success: true});

  } catch (err) {
    console.error(err);

    return res.json({
      error: "API Error",
      message: `/api/check-video/${ videoUrl } returned an error: ${ err }`
    });
  }
});

// functions
// return a proper "video/example" depending on the provided file extension -- this is a function so that we have more control over the video formats
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

    // Split data by newlines and filter out any empty lines
    const lines = data.split('\n').filter(line => line.trim() !== '');

    // Return a random line
    const randomIndex = Math.floor(Math.random() * lines.length);
    return lines[randomIndex];
  } catch (error) {
    console.error('Failed to fetch the content:', error);
    return null;
  }
}

// start the server
app.listen(config.PORT, () => console.log(`\nApp is up @ http://localhost:${ config.PORT }`));
