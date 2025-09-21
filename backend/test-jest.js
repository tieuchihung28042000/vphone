import request from 'supertest';
import express from 'express';

const app = express();
app.use(express.json());

// Simple test route
app.get('/test', (req, res) => {
  res.json({ message: 'Test successful' });
});

app.post('/test', (req, res) => {
  res.json({ message: 'POST test successful', data: req.body });
});

export default app;
