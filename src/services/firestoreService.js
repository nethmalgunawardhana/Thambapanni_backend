const { db } = require('../config/firebase.js');

function getTrendingPlaces() {
  return new Promise(async (resolve, reject) => {
    try {
      const tripsRef = db.collection('tripPlans');
      const tripsSnapshot = await tripsRef.get();
      
      const destinationCounts = {};
      
      tripsSnapshot.forEach(doc => {
        const tripData = doc.data();
        
        if (tripData.days && Array.isArray(tripData.days)) {
          tripData.days.forEach(day => {
            if (day.activities && Array.isArray(day.activities)) {
              day.activities.forEach(activity => {
                const destination = activity.destination || '';
                const description = activity.description || '';
                
                if (destination) {
                  if (destinationCounts[destination]) {
                    destinationCounts[destination].count += 1;
                  } else {
                    destinationCounts[destination] = {
                      description,
                      count: 1
                    };
                  }
                }
              });
            }
          });
        }
      });
      
      const result = Object.entries(destinationCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);
      
      resolve(result);
    } catch (error) {
      console.error('Error getting trending places:', error);
      reject(error);
    }
  });
}

module.exports = {
  getTrendingPlaces
};