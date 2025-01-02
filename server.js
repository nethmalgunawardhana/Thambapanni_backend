const express = require('express');
const app = express();
const port = 3000;
const cors = require('cors');
const authRoutes = require('./src/routes/user.routes');

app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.use('/api/users', authRoutes);

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
