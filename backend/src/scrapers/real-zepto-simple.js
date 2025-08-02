const puppeteer = require('puppeteer');

class RealZeptoScraper {
  constructor() {
    this.baseUrl = 'https://www.zeptonow.com';
    this.searchUrl = 'https://www.zeptonow.com/search';
  }

  async searchProducts(query, maxResults = 2) {
    let browser;
    
    try {
      console.log(`🟣 Zepto: Real scraping for "${query}"`);
      
      browser = await puppeteer.launch({
        headless: "new",
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-images'
        ],
        timeout: 15000
      });
      
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      const searchUrl = `https://www.zeptonow.com/search?query=${encodeURIComponent(query)}`;
      console.log(`🟣 Zepto: Loading search URL: ${searchUrl}`);
      
      await page.goto(searchUrl, { 
        waitUntil: ['domcontentloaded'],
        timeout: 15000 
      });
      
      // Wait for content to load
      await page.waitForTimeout(8000);
      
      console.log(`🟣 Zepto: Extracting products...`);
      
      // Super simple extraction - just look for text patterns
      const products = await page.evaluate(() => {
        const results = [];
        const bodyText = document.body.textContent || '';
        
        console.log(`🟣 Zepto: Body text length: ${bodyText.length}`);
        
        // Find patterns like "Product Name ₹price"
        const patterns = [
          /([A-Z][a-zA-Z\s&\+\-\.0-9()]{8,60})\s*₹(\d{2,4})/g,
          /([a-zA-Z][^₹\n]{10,50})\s*₹(\d{2,4})/g
        ];
        
        patterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(bodyText)) !== null && results.length < 3) {
            let productName = match[1].trim()
              .replace(/\s+/g, ' ')
              .replace(/^(ADD|SAVE|OFF|\d+%|\d+\s*mins?|delivered|grocery|zepto|welcome|please|detect)\s*/gi, '')
              .replace(/\s*(ADD|SAVE|OFF|\d+%)$/gi, '')
              .replace(/(sign up|you earn|location|detect|allow|enable)/gi, '')
              .trim();
            
            const price = parseInt(match[2]);
            
            if (price >= 10 && price <= 1000 && 
                productName.length >= 8 && productName.length <= 80 &&
                !productName.toLowerCase().includes('object.assign') &&
                !productName.toLowerCase().includes('experiment') &&
                !productName.toLowerCase().includes('deviceid') &&
                !results.some(r => r.name === productName || Math.abs(r.price - price) < 3)) {
              
              console.log(`🟣 Zepto: Found product: "${productName}" - ₹${price}`);
              
              results.push({
                name: productName,
                price: price,
                originalPrice: null,
                url: window.location.href,
                image: null,
                inStock: true,
                deliveryFee: 'Free',
                deliveryTime: '10-15 mins',
                category: 'General'
              });
            }
          }
        });
        
        console.log(`🟣 Zepto: Found ${results.length} products total`);
        return results.slice(0, 2);
      });
      
      console.log(`🟣 Zepto: Extracted ${products.length} products`);
      products.forEach((product, index) => {
        console.log(`🟣 Zepto: Product ${index + 1}: "${product.name}" - ₹${product.price}`);
      });
      
      return products;
      
    } catch (error) {
      console.error(`🟣 Zepto scraping error: ${error.message}`);
      return [];
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

module.exports = new RealZeptoScraper();