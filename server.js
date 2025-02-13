require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const authRoutes = require('./src/routes/authRoutes');
const otpRoutes = require('./src/routes/otpRoutes');
const user =require('./src/routes/userRoutes');
const destinationRoutes = require('./src/routes/destinationRoutes');
const guideRoutes = require('./src/routes/guideRoutes');
const tripRoutes = require('./src/routes/tripRoutes');
const imageRoutes = require('./src/routes/imageRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const app = express();



// Middleware
app.use(cors());
app.use(bodyParser.json());


// Routes
app.use('/auth', authRoutes); // All auth routes will be prefixed with /auth
app.use('/otp', otpRoutes); // All OTP routes will be prefixed with /otp
app.use('/user',user);
app.use('/destinations',destinationRoutes);
app.use('/guides', guideRoutes);
app.use('/api', tripRoutes);
app.use('/images', imageRoutes);
app.use('/api/payments', paymentRoutes);
// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
