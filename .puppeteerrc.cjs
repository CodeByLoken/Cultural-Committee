const { join } = require('path');

module.exports = {
    // Tells Puppeteer to store Chrome inside the project folder so Render keeps it
    cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};