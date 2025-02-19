const { getTrendingPlaces } = require('../services/firestoreService.js');
const { generatePlaceSummary } = require('../services/geminiService.js');
const { getDestinationImage } = require('./imageController.js');

function getTrendingDestinations(req, res) {
  getTrendingPlaces()
    .then(async (places) => {
      try {
        // Process each destination with images and AI summaries
        const enhancedDestinations = await Promise.all(
          places.map(async (place) => {
            try {
              // Generate AI summary
              const aiSummary = await generatePlaceSummary(
                place[0], // name is first element of array
                place[1].description // description is in second element object
              );

              // Fetch image using the new image service
              const imageUrl = await getDestinationImage(place[0]);

              return {
                name: place[0],
                description: place[1].description,
                image_url: imageUrl,
                visit_count: place[1].count,
                ai_summary: aiSummary,
                created_at: new Date(),
                updated_at: new Date()
              };
            } catch (error) {
              console.error(`Error processing destination ${place[0]}:`, error);
              return {
                name: place[0],
                description: place[1].description,
                image_url: 'https://via.placeholder.com/800x600?text=Processing+Error',
                visit_count: place[1].count,
                ai_summary: place[1].description,
                created_at: new Date(),
                updated_at: new Date()
              };
            }
          })
        );

        res.status(200).json({
          success: true,
          data: enhancedDestinations
        });
      } catch (error) {
        console.error('Error processing destinations:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to process trending destinations'
        });
      }
    })
    .catch(error => {
      console.error('Error in getTrendingDestinations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trending destinations'
      });
    });
}

module.exports = {
  getTrendingDestinations
};