const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { UNSPLASH_ACCESS_KEY } = require('../config/unsplash');
const { CACHE_DIR } = require('../middleware/cache');

async function getDestinationImage(destination) {
  const cacheFile = path.join(CACHE_DIR, `${destination}.jpg`);

  try {
    // Check if image exists in cache
    await fs.access(cacheFile);
    return cacheFile;
  } catch {
    // Fetch from Unsplash if not cached
    try {
      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params: { query: destination, orientation: 'landscape', per_page: 1 },
        headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }
      });

      if (response.data.results.length > 0) {
        const imageUrl = response.data.results[0].urls.regular;
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        await fs.writeFile(cacheFile, imageResponse.data);
        return cacheFile;
      }
    } catch (error) {
      console.error('Error fetching image:', error);
    }

    // Return default image if fetch fails
    return path.join(__dirname, '..', 'assets', 'default-destination.jpg');
  }
}

async function serveDestinationImage(req, res) {
  try {
    const destination = req.params.destination;
    const imagePath = await getDestinationImage(destination);
    res.sendFile(imagePath);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).send('Error serving image');
  }
}

module.exports = { serveDestinationImage };
