const { stripe } = require('../config/stripe');
const { db, admin } = require('../config/firebase');
const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY;

// Create a payment intent
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
      console.error('Token verification error:', error);
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    const { amount, tripId } = req.body;

    // Validate inputs
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    if (!tripId) {
      return res.status(400).json({ success: false, error: 'Trip ID is required' });
    }

    // Verify the trip exists and belongs to the user
    const tripDoc = await db.collection('tripPlans').doc(tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    const tripData = tripDoc.data();
    if (tripData.userId !== userId) {
      return res.status(403).json({ success: false, error: 'You do not have permission to pay for this trip' });
    }

    // Generate a unique idempotency key to prevent duplicate payment intents
    const idempotencyKey = `trip_payment_${tripId}_${userId}_${Date.now()}`;

    // Create a new Stripe customer (for storing payment details)
    const customer = await stripe.customers.create({
      idempotencyKey: `customer_${idempotencyKey}`
    });

    // Create an ephemeral key for the customer
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { 
        apiVersion: '2023-10-16',
        idempotencyKey: `ephemeral_${idempotencyKey}`
      }
    );
    
    // Debug log - converted to number to ensure it's not a string
    console.log('Creating payment intent with amount:', amount, typeof amount);
    
    // Ensure amount is a number
    const amountValue = Number(amount);
    
    if (isNaN(amountValue)) {
      return res.status(400).json({ success: false, error: 'Amount must be a valid number' });
    }
    
    // Create a payment intent with idempotency key
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountValue, // Fixed: proper spacing and ensuring it's a number
      currency: 'usd',
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
      metadata: { 
        tripId, 
        userId,
        appReference: idempotencyKey
      },
      idempotencyKey: idempotencyKey
    });

    // Also update trip with pending payment status
    await db.collection('tripPlans').doc(tripId).update({
      paymentStatus: 'pending',
      paymentIntentId: paymentIntent.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      paymentIntent: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
      success: true
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create payment intent',
      message: error.message || 'Unknown error occurred'
    });
  }
};
// Handle successful payments and store in Firestore
exports.handlePaymentSuccess = async (req, res) => {
  let transactionAttempt = 0;
  const maxTransactionAttempts = 5;
  
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
      console.error('Token verification error:', error);
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    const { paymentIntentId, tripId, amount } = req.body;
    
    if (!paymentIntentId) {
      return res.status(400).json({ success: false, error: 'Payment intent ID is required' });
    }
    
    if (!tripId) {
      return res.status(400).json({ success: false, error: 'Trip ID is required' });
    }
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }
    
    // Verify the payment with Stripe to ensure it was successful
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    // Check if payment is successful
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ 
        success: false, 
        message: `Payment not successful. Status: ${paymentIntent.status}` 
      });
    }
    
    // Using a while loop for transaction retries
    let result;
    let lastError;
    
    while (transactionAttempt < maxTransactionAttempts) {
      try {
        // Attempt the transaction
        result = await executePaymentTransaction(paymentIntentId, tripId, userId, amount, paymentIntent);
        
        // If we get here, transaction succeeded
        break;
      } catch (error) {
        lastError = error;
        console.error(`Transaction attempt ${transactionAttempt + 1} failed:`, error);
        
        // Check if it's a transaction specific error that merits retry
        if (error.code === 'ALREADY_EXISTS') {
          // This is a success case - payment was already recorded
          return res.json({
            success: true,
            message: 'Payment was already recorded',
            paymentId: error.paymentId
          });
        }
        
        // Increment attempt counter
        transactionAttempt++;
        
        // If we haven't reached max attempts, wait and try again
        if (transactionAttempt < maxTransactionAttempts) {
          // Exponential backoff with jitter
          const backoffTime = Math.floor(Math.random() * 1000) + (1000 * Math.pow(2, transactionAttempt));
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }
    
    // If we exited the loop without a result, throw the last error
    if (!result) {
      throw lastError || new Error(`Transaction failed after ${maxTransactionAttempts} attempts`);
    }
    
    // Log successful payment recording
    console.log(`Payment recorded successfully: ${result.paymentId} for trip ${tripId}`);
    
    res.json({
      success: true,
      message: 'Payment recorded successfully',
      paymentId: result.paymentId
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to record payment information',
      message: error.message || 'An unknown error occurred',
      shouldRetry: transactionAttempt < maxTransactionAttempts - 1
    });
  }
};

// Helper function for payment transaction
async function executePaymentTransaction(paymentIntentId, tripId, userId, amount, paymentIntent) {
  // First, check if payment was already recorded outside the transaction
  // This is a performance optimization to avoid starting a transaction if not needed
  const existingPaymentsQuery = await db.collection('payments')
    .where('paymentIntentId', '==', paymentIntentId)
    .limit(1)
    .get();
  
  if (!existingPaymentsQuery.empty) {
    // Payment already exists, return the ID but signal this was pre-existing
    const existingPayment = existingPaymentsQuery.docs[0];
    const error = new Error('Payment already recorded');
    error.code = 'ALREADY_EXISTS';
    error.paymentId = existingPayment.id;
    throw error;
  }

  // Verify the trip exists
  const tripRef = db.collection('tripPlans').doc(tripId);
  const tripDoc = await tripRef.get();
  
  if (!tripDoc.exists) {
    throw new Error(`Trip not found: ${tripId}`);
  }
  
  // Create payment record in Firestore using a transaction for atomic operations
  return db.runTransaction(async (t) => {
    // Double-check inside transaction if payment already exists
    const existingPaymentsRef = db.collection('payments')
      .where('paymentIntentId', '==', paymentIntentId)
      .limit(1);
    
    const existingPayments = await t.get(existingPaymentsRef);
    
    if (!existingPayments.empty) {
      // Payment already exists, return the ID
      const existingPayment = existingPayments.docs[0];
      return { paymentId: existingPayment.id, alreadyExists: true };
    }
    
    // Create payment record
    const paymentRecord = {
      paymentIntentId,
      tripId,
      userId,
      amount: amount / 100, // Convert cents to dollars for display
      amountInCents: amount,
      status: 'completed',
      paymentMethod: paymentIntent.payment_method_types[0] || 'card',
      currency: paymentIntent.currency,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: paymentIntent.metadata || {},
      stripeResponse: {
        status: paymentIntent.status,
        created: paymentIntent.created,
        id: paymentIntent.id
      },
      recordedBy: 'api_endpoint'
    };
    
    // Create a reference for the new payment document
    const paymentRef = db.collection('payments').doc();
    
    // Set the payment document in the transaction
    t.set(paymentRef, paymentRecord);
    
    // Also update the trip document to mark it as paid
    t.update(tripRef, {
      paymentStatus: 'paid',
      paymentId: paymentRef.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { paymentId: paymentRef.id };
  });
}

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
      console.error('Token verification error:', error);
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
        ...doc.data(),
        createdAt: doc.data().createdAt ? doc.data().createdAt.toDate() : null,
        updatedAt: doc.data().updatedAt ? doc.data().updatedAt.toDate() : null
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
                ...tripDoc.data(),
                createdAt: tripDoc.data().createdAt ? tripDoc.data().createdAt.toDate() : null,
                updatedAt: tripDoc.data().updatedAt ? tripDoc.data().updatedAt.toDate() : null
              }
            };
          }
        } catch (error) {
          console.error(`Error fetching trip ${payment.tripId}:`, error);
          // Return the payment without trip details if there's an error
          return {
            ...payment,
            tripDetails: { error: 'Unable to load trip details' }
          };
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
      error: 'Failed to fetch payment history',
      message: error.message || 'An unknown error occurred'
    });
  }
};

// Webhook handler for Stripe events
exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  
  try {
    // Verify the event came from Stripe
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle the event
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error(`Error handling webhook event ${event.type}:`, error);
    // Return 200 to acknowledge receipt even if processing failed
    // This prevents Stripe from retrying repeatedly
    res.json({ received: true, processingError: error.message });
  }
};

// Helper function to handle successful payment intents from webhook
async function handlePaymentIntentSucceeded(paymentIntent) {
  let retryCount = 0;
  const maxRetries = 5;
  
  while (retryCount < maxRetries) {
    try {
      // Extract metadata
      const { tripId, userId } = paymentIntent.metadata;
      
      if (!tripId || !userId) {
        console.error('Missing required metadata in payment intent:', paymentIntent.id);
        return;
      }
      
      // Check if we've already processed this payment outside transaction
      const existingPaymentsQuery = await db.collection('payments')
        .where('paymentIntentId', '==', paymentIntent.id)
        .limit(1)
        .get();
      
      if (!existingPaymentsQuery.empty) {
        console.log(`Payment ${paymentIntent.id} already processed. Skipping.`);
        return;
      }
      
      // Verify the trip exists
      const tripRef = db.collection('tripPlans').doc(tripId);
      const tripDoc = await tripRef.get();
      
      if (!tripDoc.exists) {
        console.error(`Trip ${tripId} not found for payment ${paymentIntent.id}`);
        return;
      }
      
      // Use a transaction for atomic operations
      await db.runTransaction(async (t) => {
        // Re-check if payment exists inside transaction
        const existingPaymentsRef = db.collection('payments')
          .where('paymentIntentId', '==', paymentIntent.id)
          .limit(1);
        
        const existingPayments = await t.get(existingPaymentsRef);
        
        if (!existingPayments.empty) {
          console.log(`Payment ${paymentIntent.id} already processed (found in transaction). Skipping.`);
          return;
        }
        
        // Create payment record
        const paymentRecord = {
          paymentIntentId: paymentIntent.id,
          tripId,
          userId,
          amount: paymentIntent.amount / 100,
          amountInCents: paymentIntent.amount,
          status: 'completed',
          paymentMethod: paymentIntent.payment_method_types[0] || 'card',
          currency: paymentIntent.currency,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          metadata: paymentIntent.metadata || {},
          stripeResponse: {
            status: paymentIntent.status,
            created: paymentIntent.created,
            id: paymentIntent.id
          },
          recordedBy: 'webhook'
        };
        
        // Create a reference for the new payment document
        const paymentRef = db.collection('payments').doc();
        
        // Set the payment document in the transaction
        t.set(paymentRef, paymentRecord);
        
        // Update the trip document to mark it as paid
        t.update(tripRef, {
          paymentStatus: 'paid',
          paymentId: paymentRef.id,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`Payment ${paymentIntent.id} recorded successfully via webhook`);
      });
      
      // If transaction succeeded, break out of retry loop
      break;
    } catch (error) {
      console.error(`Error processing webhook payment (attempt ${retryCount + 1}):`, error);
      
      // Only retry certain types of errors
      if (error.code === 'aborted' || error.code === 'unavailable' || error.code === 'internal') {
        retryCount++;
        if (retryCount < maxRetries) {
          // Exponential backoff with jitter
          const backoffTime = Math.floor(Math.random() * 1000) + (1000 * Math.pow(2, retryCount));
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      } else {
        // Don't retry other errors
        throw error;
      }
    }
  }
}

// Helper function to handle failed payment intents from webhook
async function handlePaymentIntentFailed(paymentIntent) {
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    try {
      // Extract metadata
      const { tripId, userId } = paymentIntent.metadata;
      
      if (!tripId || !userId) {
        console.error('Missing required metadata in failed payment intent:', paymentIntent.id);
        return;
      }
      
      // Update trip payment status
      const tripRef = db.collection('tripPlans').doc(tripId);
      await tripRef.update({
        paymentStatus: 'failed',
        paymentError: paymentIntent.last_payment_error?.message || 'Payment failed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`Trip ${tripId} marked as payment failed due to webhook event`);
      
      // Success, break out of retry loop
      break;
    } catch (error) {
      console.error(`Error processing webhook payment failure (attempt ${retryCount + 1}):`, error);
      
      retryCount++;
      if (retryCount < maxRetries) {
        // Simple backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      } else {
        throw error;
      }
    }
  }
}