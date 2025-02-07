const genAI = require('../config/geminiConfig');

const generateTripPlan = async (req, res) => {
  try {
    const { destinations, categoryType, days, members, budgetRange } = req.body;

    if (!destinations || !destinations.length) {
      return res.status(400).json({ success: false, error: 'Destinations are required' });
    }

    const prompt = `
Generate a structured ${days}-day travel itinerary in JSON format only. Do not include explanations, text, or markdown formatting.

{
  "tripTitle": "Descriptive trip title",
  "days": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "activities": [
        {
          "time": "08:00 AM",
          "destination": "Specific location name",
          "description": "Detailed activity description",
          "image": "https://example.com/image.jpg"
        }
      ],
      "transportation": "Recommended transport method",
      "accommodation": "Hotel or lodging name",
      "estimatedCost": "$XXX"
    }
  ]
}

Details:
- Destinations: ${destinations.join(", ")}
- Category Type: ${categoryType}
- Budget Range: ${budgetRange}
- Members: ${members} people

Respond **ONLY** with a valid JSON object. No explanations, markdown, or extra text.
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-pro",
      generationConfig: {
        maxOutputTokens: 1024, // Reduce token count to avoid long responses
        temperature: 0.5, // Lower randomness for structured output
      }
    });

    // Function to fetch AI response with optimized timeout handling
    const fetchAIResponse = async () => {
      try {
        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Generation timeout')), 15000)) // Reduced timeout
        ]);
        return result.response.text();
      } catch (error) {
        console.error("AI call failed:", error);
        throw error;
      }
    };

    let responseText = await fetchAIResponse();

    // **Fix: Remove markdown formatting (if present)**
    responseText = responseText.replace(/```json|```/g, "").trim();

    // **Validate and Parse JSON**
    let tripPlan;
    try {
      tripPlan = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON Parsing Error:', parseError);
      return res.status(500).json({ success: false, error: 'Failed to parse AI response', rawResponse: responseText });
    }

    if (!tripPlan.days || !Array.isArray(tripPlan.days)) {
      return res.status(500).json({ success: false, error: 'Invalid trip plan structure', rawResponse: responseText });
    }

    res.json({ success: true, tripPlan });

  } catch (error) {
    console.error('Error generating trip plan:', error);
    res.status(500).json({ success: false, error: 'Failed to generate trip plan', details: error.message });
  }
};

module.exports = { generateTripPlan };
