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
        maxOutputTokens: 2048, // Increase to ensure full response
        temperature: 0.7
      }
    });

    const fetchAIResponse = async (retryCount = 0) => {
      try {
        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Generation timeout')), 20000))
        ]);

        return await result.response.text();
      } catch (error) {
        if (retryCount < 2) {
          console.warn(`Retrying AI call (${retryCount + 1}/2)...`);
          await new Promise(res => setTimeout(res, 2000 * (retryCount + 1)));
          return fetchAIResponse(retryCount + 1);
        }
        throw error;
      }
    };

    let responseText = await fetchAIResponse();

    // **Fix: Remove markdown code block formatting**
    responseText = responseText.replace(/```json|```/g, "").trim();

    // **Fix: Ensure JSON is complete**
    if (!responseText.endsWith("}")) {
      console.warn("Truncated JSON detected, attempting to fix...");
      responseText += "}"; // Close the JSON if needed
    }

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
