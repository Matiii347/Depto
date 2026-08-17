const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Mount API routes
app.use('/api/propiedades', require('./routes/propiedades'));
app.use('/api/comentarios', require('./routes/comentarios'));
app.use('/api/admin', require('./routes/admin'));

// Fallback for SPA or simple routes if needed
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
