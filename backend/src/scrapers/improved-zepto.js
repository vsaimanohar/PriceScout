const puppeteer = require('puppeteer');

class ImprovedZeptoScraper {
  constructor() {
    this.baseUrl = 'https://www.zeptonow.com';
  }

  async searchProducts(query, maxResults = 5) {
    let browser;
    
    try {
      console.log(`🟣 Zepto: Starting search for "${query}"`);
      
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--disable-extensions',
          '--disable-images'
        ],
        timeout: 15000
      });
      
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Go directly to search URL
      const searchUrl = `https://www.zeptonow.com/search?query=${encodeURIComponent(query)}`;
      console.log(`🟣 Zepto: Navigating to ${searchUrl}`);
      
      await page.goto(searchUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      
      await page.waitForTimeout(3000);
      
      const products = await page.evaluate((maxResults, query) => {
        const results = [];
        
        // Zepto-specific selectors
        const selectors = [
          '[data-testid="product-card"]',
          '.ProductCard',
          '[class*="ProductCard"]',
          '[class*="product-card"]',
          '.product-tile',
          '[class*="product"]'
        ];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          console.log(`Zepto trying selector ${selector}, found ${elements.length} elements`);
          
          if (elements.length > 0) {
            for (let i = 0; i < Math.min(elements.length, maxResults); i++) {
              const element = elements[i];
              
              try {
                // Product name selectors
                const nameSelectors = [
                  '[data-testid="product-name"]',
                  '.ProductCard__name',
                  'h3', 'h4', 'h5',
                  '[class*="name"]',
                  '[class*="title"]',
                  '[class*="Name"]'
                ];
                
                let name = null;
                for (const nameSelector of nameSelectors) {
                  const nameEl = element.querySelector(nameSelector);
                  if (nameEl && nameEl.textContent.trim()) {
                    name = nameEl.textContent.trim();
                    break;
                  }
                }
                
                // Price selectors
                const priceSelectors = [
                  '[data-testid="product-price"]',
                  '.ProductCard__price',
                  '[class*="price"]',
                  '[class*="Price"]'
                ];
                
                let priceText = null;
                for (const priceSelector of priceSelectors) {
                  const priceEl = element.querySelector(priceSelector);
                  if (priceEl && priceEl.textContent.includes('₹')) {
                    priceText = priceEl.textContent.trim();
                    break;
                  }
                }
                
                const img = element.querySelector('img');
                const imageUrl = img ? img.src : null;
                
                if (name && priceText) {
                  const priceMatch = priceText.match(/₹\s*(\d+(?:\.\d+)?)/);
                  if (priceMatch) {
                    const price = parseFloat(priceMatch[1]);
                    
                    results.push({
                      name: name,
                      price: price,
                      originalPrice: null,
                      url: window.location.href,
                      image: imageUrl,
                      inStock: true,
                      deliveryFee: 'Free',
                      deliveryTime: '10-15 mins',
                      category: 'General'
                    });
                  }
                }
              } catch (error) {
                console.log('Zepto error processing element:', error);
              }
            }
            
            if (results.length > 0) {
              console.log(`Zepto found ${results.length} products with selector: ${selector}`);
              break;
            }
          }
        }
        
        return results;
      }, maxResults, query);
      
      console.log(`🟣 Zepto: Found ${products.length} products`);
      return products;
      
    } catch (error) {
      console.error(`🟣 Zepto scraping error: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

module.exports = new ImprovedZeptoScraper();