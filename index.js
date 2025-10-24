const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// MCP endpoint
app.post('/mcp', async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Handle the MCP request
    const { method, params } = req.body;
    
    let result = {};
    
    if (method === 'navigate') {
      await page.goto(params.url);
      result = { success: true, url: params.url };
    } else if (method === 'screenshot') {
      const screenshot = await page.screenshot({ encoding: 'base64' });
      result = { success: true, screenshot };
    } else if (method === 'content') {
      const content = await page.content();
      result = { success: true, content };
    }
    
    await browser.close();
    res.json(result);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/', (req, res) => {
  res.send('MCP Browser Server is running!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
