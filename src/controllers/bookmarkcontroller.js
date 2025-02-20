const { db } = require('../config/firebase');

const bookmarkController = {
  // Get bookmarked IDs
  getBookmarkedIds: async (req, res) => {
    try {
      const bookmarksRef = db.collection('bookmarks');
      const snapshot = await bookmarksRef
        .where('userId', '==', req.userId)
        .get();

      const bookmarkedIds = [];
      snapshot.forEach(doc => {
        bookmarkedIds.push(doc.data().tripId);
      });

      return res.json({
        success: true,
        bookmarkedIds
      });
    } catch (error) {
      console.error('Error fetching bookmarked IDs:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch bookmarked trips' 
      });
    }
  },

  // Add bookmark
  addBookmark: async (req, res) => {
    try {
      const { tripId } = req.body;
      
      if (!tripId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Trip ID is required' 
        });
      }

      const bookmarksRef = db.collection('bookmarks');
      
      // Check if bookmark exists
      const existingBookmark = await bookmarksRef
        .where('userId', '==', req.userId)
        .where('tripId', '==', tripId)
        .get();

      if (!existingBookmark.empty) {
        return res.status(400).json({ 
          success: false, 
          error: 'Trip is already bookmarked' 
        });
      }

      // Add new bookmark
      await bookmarksRef.add({
        userId: req.userId,
        tripId: tripId,
        createdAt: new Date().toISOString()
      });

      return res.json({
        success: true,
        message: 'Trip bookmarked successfully'
      });
    } catch (error) {
      console.error('Error adding bookmark:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to bookmark trip' 
      });
    }
  },

  // Remove bookmark
  removeBookmark: async (req, res) => {
    try {
      const { tripId } = req.body;
      
      if (!tripId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Trip ID is required' 
        });
      }

      const bookmarksRef = db.collection('bookmarks');
      
      const bookmark = await bookmarksRef
        .where('userId', '==', req.userId)
        .where('tripId', '==', tripId)
        .get();

      if (bookmark.empty) {
        return res.status(404).json({ 
          success: false, 
          error: 'Bookmark not found' 
        });
      }

      const deletePromises = [];
      bookmark.forEach(doc => {
        deletePromises.push(bookmarksRef.doc(doc.id).delete());
      });
      
      await Promise.all(deletePromises);

      return res.json({
        success: true,
        message: 'Bookmark removed successfully'
      });
    } catch (error) {
      console.error('Error removing bookmark:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to remove bookmark' 
      });
    }
  },

  // Get all bookmarked trips
  getBookmarkedTrips: async (req, res) => {
    try {
      const bookmarksRef = db.collection('bookmarks');
      const tripsRef = db.collection('trips');
      
      const bookmarksSnapshot = await bookmarksRef
        .where('userId', '==', req.userId)
        .get();

      const bookmarkedTrips = [];
      const tripPromises = [];

      bookmarksSnapshot.forEach(doc => {
        const tripId = doc.data().tripId;
        tripPromises.push(
          tripsRef.doc(tripId).get()
            .then(tripDoc => {
              if (tripDoc.exists) {
                bookmarkedTrips.push({
                  id: tripDoc.id,
                  ...tripDoc.data()
                });
              }
            })
        );
      });

      await Promise.all(tripPromises);

      return res.json({
        success: true,
        trips: bookmarkedTrips
      });
    } catch (error) {
      console.error('Error fetching bookmarked trips:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch bookmarked trips' 
      });
    }
  }
};

module.exports = bookmarkController;
