const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GENAI_API_KEY } = require('../config/geminiConfig.js');

const genAI = new GoogleGenerativeAI(GENAI_API_KEY);

function generatePlaceSummary(place, description) {
  return new Promise(async (resolve, reject) => {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      const prompt = `Write a short, engaging summary for ${place}: ${description}`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      resolve(response.text());
    } catch (error) {
      //console.error(`Error generating summary for ${place}:`, error);
      resolve(description); // Fallback to original description on error
    }
  });
}

module.exports = {
  generatePlaceSummary
};