const Stripe = require('stripe');
require('dotenv').config();

// Export configurations
module.exports = {
  stripe: new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  }),
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
};
