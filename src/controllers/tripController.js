const genAI = require('../config/geminiConfig');

const generateTripPlan = async (req, res) => {
  try {
    const { destinations, categoryType, days, members, budgetRange } = req.body;

    const prompt = `Generate a detailed ${days}-day trip plan for ${members} people with the following preferences:
    - Destinations: ${destinations.join(', ')}
    - Travel Category: ${categoryType}
    - Budget Range: ${budgetRange}
    
    Please include:
    1. Day-by-day itinerary
    2. Estimated time for each activity
    3. Recommended accommodations
    4. Transportation suggestions
    5. Estimated costs
    6. Local cuisine recommendations
    7. Best time to visit
    8. Important tips and precautions`;

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const tripPlan = response.text();

    res.json({ success: true, tripPlan });
  } catch (error) {
    console.error('Error generating trip plan:', error);
    res.status(500).json({ success: false, error: 'Failed to generate trip plan' });
  }
};

module.exports = { generateTripPlan };
