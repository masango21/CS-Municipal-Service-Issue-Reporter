const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse incoming JSON payloads
app.use(express.json());

// Basic health check route
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running!' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
"scripts": {
  "start": "node index.js"
}