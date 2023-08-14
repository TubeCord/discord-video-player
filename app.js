const express = require('express');
const ejs = require('ejs');
const fetch = require('node-fetch');
const config = require('./config.json');

const app = express();
// set the view engine to ejs
app.set('view engine', 'ejs');
// static assets
app.use('/assets', express.static('assets'));

// routes
app.get('/', (req, res) => {
  getRandomLineFromGithub().then(link => {
    res.render('index', {
      name: config.NAME,
      link: link,
      pageContent: config.PAGE_CONTENT
    });
  });
});


app.get('/api/link', (req, res) => {
  getRandomLineFromGithub().then(link => {
    res.send(link);
  });
});

async function getRandomLineFromGithub() {
  const url = 'https://raw.githubusercontent.com/TomerGamerTV/discord-cdnlink-scraper/selfbot/links/discord_cdn_links.txt';

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
