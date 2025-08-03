const puppeteer = require('puppeteer');

class BrowserPool {
  constructor() {
    this.browsers = new Map();
    this.maxAge = 10 * 60 * 1000; // 10 minutes max age
    this.cleanupInterval = 5 * 60 * 1000; // Clean up every 5 minutes
    
    // Start cleanup timer
    this.startCleanupTimer();
  }

  async getBrowser(poolName = 'default') {
    const existing = this.browsers.get(poolName);
    
    // Check if existing browser is still valid
    if (existing && existing.browser && !existing.browser.process()?.killed) {
      try {
        // Test if browser is responsive
        const pages = await existing.browser.pages();
        existing.lastUsed = Date.now();
        console.log(`♻️  Reusing warm browser for ${poolName}`);
        return existing.browser;
      } catch (error) {
        console.log(`🔥 Browser ${poolName} not responsive, creating new one`);
        await this.destroyBrowser(poolName);
      }
    }

    // Create new browser
    console.log(`🚀 Creating new warm browser for ${poolName}`);
    const browser = await puppeteer.launch({
      headless: process.env.SCRAPER_DEBUG !== 'true',
      executablePath: process.env.NODE_ENV === 'production' ? process.env.PUPPETEER_EXECUTABLE_PATH : puppeteer.executablePath(),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor'
      ],
      timeout: 15000
    });

    this.browsers.set(poolName, {
      browser,
      created: Date.now(),
      lastUsed: Date.now()
    });

    return browser;
  }

  async getPage(poolName = 'default') {
    const browser = await this.getBrowser(poolName);
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1024, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    return page;
  }

  async destroyBrowser(poolName) {
    const existing = this.browsers.get(poolName);
    if (existing && existing.browser) {
      try {
        await existing.browser.close();
        console.log(`🗑️  Destroyed browser ${poolName}`);
      } catch (error) {
        console.log(`Error destroying browser ${poolName}:`, error.message);
      }
      this.browsers.delete(poolName);
    }
  }

  async cleanup() {
    const now = Date.now();
    const toDestroy = [];

    for (const [poolName, browserData] of this.browsers.entries()) {
      const age = now - browserData.created;
      const idle = now - browserData.lastUsed;
      
      // Destroy if too old or idle for too long
      if (age > this.maxAge || idle > this.maxAge) {
        toDestroy.push(poolName);
      }
    }

    for (const poolName of toDestroy) {
      console.log(`🧹 Cleaning up old browser: ${poolName}`);
      await this.destroyBrowser(poolName);
    }
  }

  startCleanupTimer() {
    setInterval(() => {
      this.cleanup().catch(console.error);
    }, this.cleanupInterval);
  }

  async destroyAll() {
    const promises = Array.from(this.browsers.keys()).map(poolName => 
      this.destroyBrowser(poolName)
    );
    await Promise.all(promises);
    console.log('🧹 All browsers destroyed');
  }

  getStats() {
    const stats = {};
    for (const [poolName, browserData] of this.browsers.entries()) {
      const now = Date.now();
      stats[poolName] = {
        age: Math.round((now - browserData.created) / 1000),
        idle: Math.round((now - browserData.lastUsed) / 1000),
        active: !browserData.browser.process()?.killed
      };
    }
    return stats;
  }
}

// Singleton instance
const browserPool = new BrowserPool();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down browser pool...');
  await browserPool.destroyAll();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down browser pool...');
  await browserPool.destroyAll();
  process.exit(0);
});

module.exports = browserPool;