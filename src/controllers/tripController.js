const genAI = require('../config/geminiConfig');
const { db } = require('../config/firebase');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const NodeCache = require('node-cache');
const SECRET_KEY = process.env.SECRET_KEY;


// Setup cache with TTL of 7 days
const distanceCache = new NodeCache({ stdTTL: 604800 });

// Helper function to generate a unique trip ID
const generateTripId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `TRIP-${timestamp}-${randomStr}`.toUpperCase();
};

// Helper function to geocode place name to coordinates using Nominatim (OSM)
async function geocode(placeName) {
  const cacheKey = `geocode:${placeName}`;
  
  // Check cache first
  const cached = distanceCache.get(cacheKey);
  if (cached) return cached;
  
  try {
    // Add 1-second delay to respect Nominatim usage policy
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: `${placeName}, Sri Lanka`,
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'TripPlannerApp/1.0' // Required by Nominatim usage policy
      }
    });
    
    if (response.data && response.data.length > 0) {
      const result = {
        lat: parseFloat(response.data[0].lat),
        lon: parseFloat(response.data[0].lon),
        displayName: response.data[0].display_name
      };
      
      // Store in cache
      distanceCache.set(cacheKey, result);
      
      return result;
    }
    
    console.warn(`Could not geocode location: ${placeName}`);
    return null;
  } catch (error) {
    console.error(`Error geocoding ${placeName}:`, error.message);
    return null;
  }
}

// Helper function to get driving distance between two points using OSRM
async function getOSRMDistance(originCoords, destCoords) {
  const cacheKey = `route:${originCoords.lat},${originCoords.lon}|${destCoords.lat},${destCoords.lon}`;
  
  // Check cache first
  const cached = distanceCache.get(cacheKey);
  if (cached) return cached;
  
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${destCoords.lon},${destCoords.lat}?overview=false`;
    
    const response = await axios.get(url);
    
    if (response.data && 
        response.data.routes && 
        response.data.routes.length > 0) {
      
      const route = response.data.routes[0];
      const distanceMeters = route.distance;
      const durationSeconds = route.duration;
      
      const result = {
        distanceValue: distanceMeters,
        distanceText: `${Math.round(distanceMeters/100)/10} km`,
        durationValue: durationSeconds,
        durationText: `${Math.round(durationSeconds/60)} mins`
      };
      
      // Store in cache
      distanceCache.set(cacheKey, result);
      
      return result;
    }
    
    console.warn(`Could not calculate route between coordinates`);
    return null;
  } catch (error) {
    console.error(`Error calculating OSRM route:`, error.message);
    return null;
  }
}

// Helper function to calculate distances for the entire trip
async function calculateTripDistance(tripPlan) {
  try {
    let totalDistanceMeters = 0;
    const dailyDistances = [];
    
    // Process each day in the trip plan
    for (let i = 0; i < tripPlan.days.length; i++) {
      const day = tripPlan.days[i];
      const activities = Array.isArray(day.activities) ? day.activities : [];
      
      // Extract all locations for this day
      const locations = [];
      
      // Start from previous day's accommodation if available
      if (i > 0 && tripPlan.days[i-1].accommodation) {
        locations.push(tripPlan.days[i-1].accommodation);
      }
      
      // Add all activity destinations
      activities.forEach(activity => {
        if (activity.destination) locations.push(activity.destination);
      });
      
      // End with current day's accommodation
      if (day.accommodation) locations.push(day.accommodation);
      
      // Calculate distances for this day
      let dayDistanceMeters = 0;
      const segments = [];
      
      // Must have at least 2 locations to calculate distance
      if (locations.length >= 2) {
        for (let j = 0; j < locations.length - 1; j++) {
          // Geocode origin and destination
          const originGeo = await geocode(locations[j]);
          const destGeo = await geocode(locations[j+1]);
          
          if (originGeo && destGeo) {
            const distanceData = await getOSRMDistance(originGeo, destGeo);
            
            if (distanceData) {
              dayDistanceMeters += distanceData.distanceValue;
              
              segments.push({
                from: locations[j],
                to: locations[j+1],
                distance: distanceData.distanceText,
                duration: distanceData.durationText,
                mode: 'driving' // OSRM provides driving directions
              });
            } else {
              segments.push({
                from: locations[j],
                to: locations[j+1],
                error: 'Could not calculate distance'
              });
            }
          } else {
            segments.push({
              from: locations[j],
              to: locations[j+1],
              error: 'Could not geocode one or both locations'
            });
          }
        }
      }
      
      // Add to total distance
      totalDistanceMeters += dayDistanceMeters;
      
      // Add daily summary
      dailyDistances.push({
        day: day.day,
        date: day.date,
        distanceKm: Math.round((dayDistanceMeters / 1000) * 10) / 10,
        distanceMeters: dayDistanceMeters,
        segments: segments
      });
    }
    
    // Calculate total distance in kilometers
    const totalDistanceKm = Math.round((totalDistanceMeters / 1000) * 10) / 10;
    
    return {
      success: true,
      totalDistanceKm,
      totalDistanceMeters,
      dailyBreakdown: dailyDistances
    };
    
  } catch (error) {
    console.error('Error calculating trip distance:', error);
    return {
      success: false,
      error: 'Failed to calculate trip distance',
      details: error.message
    };
  }
}


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

   // Calculate distance information using free OSRM
   const distanceInfo = await calculateTripDistance(tripPlanWithId);
    
   // Add distance info to the trip plan
   const tripPlanWithDistance = {
     ...tripPlanWithId,
     distanceInfo
   };

   // Send response with distance info
   res.json({ success: true, tripPlan: tripPlanWithDistance });

    // Store in Firestore with tripId
    try {
      const tripData = {
        ...tripPlanWithDistance,
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