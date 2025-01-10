const { db } = require('../config/firebase');

const getDestinationsByType = async (req, res) => {
    try {
        const { type } = req.params;
        const destinationsRef = db.collection('destinations');
        const snapshot = await destinationsRef.where('type', '==', type).get();

        const destinations = [];
        snapshot.forEach(doc => {
            destinations.push({ id: doc.id, ...doc.data() });
        });

        res.json(destinations);
    } catch (error) {
        console.error('Error in getDestinationsByType:', error);
        res.status(500).json({ error: 'Failed to fetch destinations' });
    }
};

module.exports = {
    getDestinationsByType
};