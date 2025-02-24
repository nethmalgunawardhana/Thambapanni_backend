const { stripe } = require('../config/stripe');
const { db } = require('../config/firebase');
const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY;
exports.createPaymentIntent = async (req, res) => {
  try {
    // Extract user ID from JWT token
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

    const { amount, tripId } = req.body;

    // Create a new Stripe customer (for storing payment details)
    const customer = await stripe.customers.create();

    // Create an ephemeral key for the customer
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2023-10-16' }
    );

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
      metadata: { tripId, userId }, // Store userId in metadata
    });

    res.json({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
};

// Handle successful payments and store in Firestore
exports.handlePaymentSuccess = async (req, res) => {
  try {
    // Extract user ID from JWT token
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

    const { paymentIntentId, tripId, amount } = req.body;
    
    // Verify the payment with Stripe to ensure it was successful
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ 
        success: false, 
        message: `Payment not successful. Status: ${paymentIntent.status}` 
      });
    }
    
    // Verify that the userId in the token matches the userId in the payment metadata
    // This is an additional security check
    if (paymentIntent.metadata.userId && paymentIntent.metadata.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'User ID mismatch. Unauthorized to record this payment.'
      });
    }
    
    // Create payment record in Firestore
    const paymentRecord = {
      paymentIntentId,
      tripId,
      userId,
      amount: amount / 100, // Convert cents to dollars for display
      amountInCents: amount,
      status: 'completed',
      paymentMethod: paymentIntent.payment_method_types[0],
      currency: paymentIntent.currency,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: paymentIntent.metadata
    };
    
    // Add to payments collection
    const paymentRef = await db.collection('payments').add(paymentRecord);
    
    // Also update the trip document to mark it as paid
    await db.collection('tripPlans').doc(tripId).update({
      paymentStatus: 'paid',
      paymentId: paymentRef.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({
      success: true,
      message: 'Payment recorded successfully',
      paymentId: paymentRef.id
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to record payment information' 
    });
  }
};

// Function to get payment history for a user
exports.getPaymentHistory = async (req, res) => {
  try {
    // Extract user ID from JWT token
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
    
    // Query Firestore for user's payment history
    const paymentsSnapshot = await db.collection('payments')
      .where('userId', '==', userId)
      .get();
      
    const payments = [];
    paymentsSnapshot.forEach(doc => {
      payments.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // If needed, you can also fetch trip information for each payment
    const enhancedPayments = await Promise.all(payments.map(async (payment) => {
      if (payment.tripId) {
        try {
          const tripDoc = await db.collection('tripPlans').doc(payment.tripId).get();
          if (tripDoc.exists) {
            return {
              ...payment,
              tripDetails: {
                id: tripDoc.id,
                ...tripDoc.data() // Get all trip data instead of just specific fields
              }
            };
          }
        } catch (error) {
          console.error(`Error fetching trip ${payment.tripId}:`, error);
        }
      }
      return payment;
    }));
    
    res.json({
      success: true,
      payments: enhancedPayments
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch payment history' 
    });
  }
};