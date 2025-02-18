const axios = require('axios');
const { UNSPLASH_ACCESS_KEY } = require('../config/unsplash');

async function getDestinationImage(destination) {
  try {
    const response = await axios.get('https://api.unsplash.com/search/photos', {
      params: {
        query: destination,
        orientation: 'landscape',
        per_page: 1
      },
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`
      }
    });

    if (response.data.results.length > 0) {
      return response.data.results[0].urls.regular;
    }
    
    // Return a default image URL if no results found
    return 'https://via.placeholder.com/800x600?text=Destination+Not+Found';
  } catch (error) {
    console.error('Error fetching image:', error);
    return 'https://via.placeholder.com/800x600?text=Error+Loading+Image';
  }
}

async function serveDestinationImage(req, res) {
  try {
    const destination = req.params.destination;
    const imageUrl = await getDestinationImage(destination);
    
    // Redirect to the image URL instead of serving the file
    res.redirect(imageUrl);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).send('Error serving image');
  }
}

module.exports = { serveDestinationImage,getDestinationImage };