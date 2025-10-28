/**
 * HTTP Wrapper for PlayMCP Playwright Browser Automation
 *
 * This provides an HTTP API for browser automation testing.
 * Designed for Railway deployment with optimized build times.
 */

import express from 'express';
import { chromium, Browser, Page } from 'playwright';

const app = express();
app.use(express.json());

let browser: Browser | null = null;
let page: Page | null = null;

// Initialize browser on startup
async function initBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  if (!page) {
    page = await browser.newPage();
  }
  return { browser, page };
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'playwright-mcp', timestamp: new Date().toISOString() });
});

// Navigate endpoint
app.post('/mcp', async (req, res) => {
  try {
    const { method, params } = req.body;
    await initBrowser();

    switch (method) {
      case 'navigate': {
        await page!.goto(params.url, { waitUntil: params.waitUntil || 'domcontentloaded' });
        const title = await page!.title();
        const url = page!.url();

        res.json({
          success: true,
          title,
          url,
          consoleLogs: [],
          timestamp: new Date().toISOString()
        });
        break;
      }

      case 'multi_step_test': {
        await page!.goto(params.url, { waitUntil: 'networkidle' });

        const results = [];
        let failedSteps = 0;

        for (let i = 0; i < params.steps.length; i++) {
          const step = params.steps[i];
          const startTime = Date.now();

          try {
            switch (step.action) {
              case 'wait':
                await page!.waitForTimeout(step.duration || 1000);
                results.push({
                  step: i + 1,
                  action: step.action,
                  duration: Date.now() - startTime,
                  success: true
                });
                break;

              case 'click':
                await page!.click(step.selector, { timeout: step.timeout || 5000 });
                results.push({
                  step: i + 1,
                  action: step.action,
                  success: true
                });
                break;

              case 'type':
                await page!.fill(step.selector, step.text);
                results.push({
                  step: i + 1,
                  action: step.action,
                  success: true
                });
                break;

              case 'is_visible':
                const isVisible = await page!.isVisible(step.selector);
                results.push({
                  step: i + 1,
                  action: step.action,
                  duration: Date.now() - startTime,
                  success: isVisible
                });
                if (!isVisible) failedSteps++;
                break;

              case 'dom_state':
                const title = await page!.title();
                results.push({
                  step: i + 1,
                  action: step.action,
                  duration: Date.now() - startTime,
                  success: true,
                  data: { title }
                });
                break;

              case 'evaluate':
                const result = await page!.evaluate(step.script);
                results.push({
                  step: i + 1,
                  action: step.action,
                  result: String(result),
                  duration: Date.now() - startTime,
                  success: true
                });
                break;

              default:
                results.push({
                  step: i + 1,
                  action: step.action,
                  success: false,
                  error: `Unknown action: ${step.action}`
                });
                failedSteps++;
            }
          } catch (error: any) {
            results.push({
              step: i + 1,
              action: step.action,
              success: false,
              error: error.message
            });
            failedSteps++;
          }
        }

        res.json({
          success: failedSteps === 0,
          totalSteps: params.steps.length,
          completedSteps: params.steps.length - failedSteps,
          failedSteps,
          steps: results,
          finalUrl: page!.url(),
          finalTitle: await page!.title(),
          consoleLogs: [],
          postMessages: [],
          timestamp: new Date().toISOString()
        });
        break;
      }

      default:
        res.status(400).json({
          success: false,
          error: `Unknown method: ${method}`
        });
    }
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Close browser on shutdown
process.on('SIGTERM', async () => {
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Playwright MCP HTTP server running on port ${PORT}`);
});
