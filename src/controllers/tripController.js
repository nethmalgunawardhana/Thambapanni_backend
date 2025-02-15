const genAI = require('../config/geminiConfig');
const { db } = require('../config/firebase');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY;

// Helper function to generate a unique trip ID
const generateTripId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `TRIP-${timestamp}-${randomStr}`.toUpperCase();
};

const generateTripPlan = async (req, res) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];
    let userId;

    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      userId = decoded.userId; // Extract userId from the token
    } catch (error) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

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
        maxOutputTokens: 2048,
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
    responseText = responseText.replace(/```json|```/g, "").trim();

    if (!responseText.endsWith("}")) {
      console.warn("Truncated JSON detected, attempting to fix...");
      responseText += "}";
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

    // Generate a unique trip ID
    const tripId = generateTripId();

    // Add tripId to the response
    const tripPlanWithId = {
      ...tripPlan,
      tripId
    };

    res.json({ success: true, tripPlan: tripPlanWithId });

    // Store in Firestore with tripId
    try {
      const tripData = {
        ...tripPlanWithId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        userId,
        searchParams: {
          destinations,
          categoryType,
          days,
          members,
          budgetRange
        }
      };

      // Use tripId as the document ID in Firestore
      await db.collection('tripPlans').doc(tripId).set(tripData);
      console.log('Trip plan stored successfully in Firestore with ID:', tripId);
    } catch (error) {
      console.error('Error storing trip plan in Firestore:', error);
    }

  } catch (error) {
    console.error('Error generating trip plan:', error);
    res.status(500).json({ success: false, error: 'Failed to generate trip plan', details: error.message });
  }
};

const getTripPlansByUserId = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];
    let userId;

    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      userId = decoded.userId;
    } catch (error) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    const tripsSnapshot = await db.collection('tripPlans')
      .where('userId', '==', userId)
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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];
    let userId;

    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      userId = decoded.userId;
    } catch (error) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    const tripsSnapshot = await db.collection('tripPlans')
      .where('userId', '!=', userId)
      .get();
    
    const trips = [];
    tripsSnapshot.forEach(doc => {
      const tripData = doc.data();
      trips.push({
        id: doc.id,
        ...tripData
      });
    });

    res.json({ success: true, trips });
  } catch (error) {
    console.error('Error fetching public trip plans:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch public trip plans'
    });
  }
};

module.exports = {
  generateTripPlan,
  getTripPlansByUserId,
  getAllTripPlans
};