const genAI = require('../config/geminiConfig');

const generateTripPlan = async (req, res) => {
  try {
    const { destinations, categoryType, days, members, budgetRange } = req.body;

    const prompt = `
      Generate a detailed ${days}-day travel itinerary for ${members} people, visiting ${destinations.join(", ")}.
      The trip falls under the "${categoryType}" category with a budget range of "${budgetRange}".
      Provide a structured JSON response in the following format:
      
      {
        "tripTitle": "Trip to ${destinations[0]} and more",
        "days": [
          {
            "day": 1,
            "date": "YYYY-MM-DD",
            "activities": [
              {
                "time": "08:00 AM",
                "destination": "Place 1",
                "description": "Visit this attraction",
                "image": "Image URL"
              },
              {
                "time": "02:00 PM",
                "destination": "Place 2",
                "description": "Enjoy the beach",
                "image": "Image URL"
              }
            ],
            "transportation": "Suggested transport method",
            "accommodation": "Recommended hotel",
            "estimatedCost": "$XXX"
          }
        ]
      }

      Ensure that:
      - The trip spans ${days} days.
      - Each day has at least 2-3 activities.
      - Include transportation and accommodation details.
      - Provide estimated costs for the day.
      - Use proper date formatting.
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;

    // Parse AI-generated JSON response
    const tripPlan = JSON.parse(response.text());

    res.json({ success: true, tripPlan });
  } catch (error) {
    console.error('Error generating trip plan:', error);
    res.status(500).json({ success: false, error: 'Failed to generate trip plan' });
  }
};

module.exports = { generateTripPlan };

