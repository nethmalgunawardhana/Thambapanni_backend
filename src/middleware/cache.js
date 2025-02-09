const fs = require('fs').promises;
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', 'cache', 'destination-images');

// Ensure cache directory exists
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating cache directory:', error);
  }
}

ensureCacheDir();

module.exports = { CACHE_DIR };
