import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('\n❌ Missing ANTHROPIC_API_KEY environment variable!');
  console.error('Run with: set ANTHROPIC_API_KEY=your-key-here && node server.js\n');
  process.exit(1);
}

app.post('/api/messages', async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n✅ Proxy server running on http://localhost:${PORT}`);
  console.log('   Frontend can now make API calls!\n');
});
