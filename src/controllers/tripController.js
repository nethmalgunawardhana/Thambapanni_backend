const genAI = require('../config/geminiConfig');

const generateTripPlan = async (req, res) => {
  try {
    const { destinations, categoryType, days, members, budgetRange } = req.body;

    // Validate input
    if (!destinations || !destinations.length) {
      return res.status(400).json({ 
        success: false, 
        error: 'Destinations are required' 
      });
    }

    const prompt = `
Please generate a structured ${days}-day travel itinerary for ${members} people visiting ${destinations.join(", ")}.
Trip Category: ${categoryType}
Budget Range: ${budgetRange}

Guidelines for the itinerary:
- Create a detailed day-by-day plan
- Include specific activities, times, and locations
- Suggest transportation and accommodation
- Estimate daily costs
- Focus on ${categoryType} experiences

Response Requirements:
- Return ONLY a valid JSON object
- Use realistic, specific destination details
- Ensure activities match the destination and category type
- Format dates as YYYY-MM-DD
- Include an image URL for each activity (can be placeholder)

Output Format:
{
  "tripTitle": "Descriptive trip title",
  "days": [
    {
      "day": 1,
      "date": "2024-02-15",
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
}`;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-pro",
      generationConfig: {
        // Increase maximum output tokens to prevent truncation
        maxOutputTokens: 4096,
        // Add some randomness to prevent repetitive responses
        temperature: 0.7
      }
    });

    // Set a longer timeout for the API call
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Generation timeout')), 25000)
      )
    ]);

    const responseText = await result.response.text();

    // More robust JSON extraction
    const cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```/g, '')
      .trim();

    let tripPlan;
    try {
      tripPlan = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('JSON Parsing Error:', parseError);
      console.error('Response Text:', cleanedResponse);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to parse AI response',
        rawResponse: cleanedResponse
      });
    }

    // Validate the generated trip plan
    if (!tripPlan.days || !Array.isArray(tripPlan.days)) {
      return res.status(500).json({ 
        success: false, 
        error: 'Invalid trip plan structure',
        rawResponse: cleanedResponse
      });
    }

    res.json({ 
      success: true, 
      tripPlan 
    });

  } catch (error) {
    console.error('Error generating trip plan:', error);
    
    // More detailed error response
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate trip plan',
      details: error.message
    });
  }
};

module.exports = { generateTripPlan };