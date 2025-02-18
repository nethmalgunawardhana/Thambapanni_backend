const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
module.exports = genAI, GEMINI_API_KEY;
