const genAI = require('../config/geminiConfig');
const { db } = require('../config/firebase');


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
    // Then store in Firestore
    try {
      const tripData = {
        ...tripPlan,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        userId: req.user?.id || 'anonymous', // Assuming you have user authentication
        searchParams: {
          destinations,
          categoryType,
          days,
          members,
          budgetRange
        }
      };

      await db.collection('tripPlans').add(tripData);
      console.log('Trip plan stored successfully in Firestore');
    } catch (error) {
      console.error('Error storing trip plan in Firestore:', error);
      // Note: We don't send this error to the frontend since we already sent the response
    }

  } catch (error) {
    console.error('Error generating trip plan:', error);
    res.status(500).json({ success: false, error: 'Failed to generate trip plan', details: error.message });
  }
};

const getTripPlansByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const tripsSnapshot = await db.collection('tripPlans')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const trips = [];
    tripsSnapshot.forEach(doc => {
      trips.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({ 
      success: true, 
      trips,
      count: trips.length
    });
  } catch (error) {
    console.error('Error fetching user trip plans:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch user trip plans', 
      details: error.message 
    });
  }
};

const getAllTripPlans = async (req, res) => {
  try {
    // Add pagination support
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startAfter = req.query.startAfter; // For cursor-based pagination

    let query = db.collection('tripPlans')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    // If startAfter cursor is provided, use it for pagination
    if (startAfter) {
      const startAfterDoc = await db.collection('tripPlans').doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    } else {
      // Skip documents for page-based pagination
      query = query.offset((page - 1) * limit);
    }

    const tripsSnapshot = await query.get();

    const trips = [];
    let lastDocId = null;

    tripsSnapshot.forEach(doc => {
      // Remove sensitive information if needed
      const tripData = doc.data();
      trips.push({
        id: doc.id,
        tripTitle: tripData.tripTitle,
        days: tripData.days,
        searchParams: tripData.searchParams,
        createdAt: tripData.createdAt,
        userId: tripData.userId
        // Add other fields as needed
      });
      lastDocId = doc.id;
    });

    // Get total count (Note: This is not recommended for large collections)
    const totalSnapshot = await db.collection('tripPlans').count().get();

    res.json({
      success: true,
      trips,
      pagination: {
        page,
        limit,
        total: totalSnapshot.data().count,
        hasMore: trips.length === limit,
        lastDocId // For cursor-based pagination
      }
    });
  } catch (error) {
    console.error('Error fetching all trip plans:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch all trip plans', 
      details: error.message 
    });
  }
};

module.exports = {
  generateTripPlan,
  getTripPlansByUserId,
  getAllTripPlans
};

