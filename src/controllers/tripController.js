const genAI = require('../config/geminiConfig');

const generateTripPlan = async (req, res) => {
  try {
    const { destinations, categoryType, days, members, budgetRange } = req.body;

    const prompt = `
      Generate a structured ${days}-day travel itinerary for ${members} people visiting ${destinations.join(", ")}.
      The trip is categorized as "${categoryType}" and has a budget range of "${budgetRange}".
      Return the response **strictly in JSON format only**, without Markdown, explanations, or extra text.

      JSON format:
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
                "description": "Activity details",
                "image": "Image URL"
              }
            ],
            "transportation": "Suggested transport method",
            "accommodation": "Recommended hotel",
            "estimatedCost": "$XXX"
          }
        ]
      }
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const responseText = await result.response.text();

    // 🔹 Extract JSON safely
    const jsonMatch = responseText.match(/\{[\s\S]*\}/); // Find first JSON object
    if (!jsonMatch) {
      throw new Error("AI response is not valid JSON");
    }

    const tripPlan = JSON.parse(jsonMatch[0]); // Parse extracted JSON

    res.json({ success: true, tripPlan });
  } catch (error) {
    console.error('Error generating trip plan:', error);
    res.status(500).json({ success: false, error: 'Failed to generate trip plan' });
  }
};

module.exports = { generateTripPlan };
