const puppeteer = require('puppeteer');

class ImprovedBlinkitScraper {
  constructor() {
    this.baseUrl = 'https://blinkit.com';
  }

  async searchProducts(query, maxResults = 5) {
    let browser;
    
    try {
      console.log(`🟡 Blinkit: Starting search for "${query}"`);
      
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
          '--disable-images', // Faster loading
          '--disable-javascript', // Try without JS first
        ],
        timeout: 15000
      });
      
      const page = await browser.newPage();
      
      // Set viewport and user agent
      await page.setViewport({ width: 1280, height: 720 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Navigate to search page directly
      const searchUrl = `https://blinkit.com/s/?q=${encodeURIComponent(query)}`;
      console.log(`🟡 Blinkit: Navigating to ${searchUrl}`);
      
      await page.goto(searchUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      
      // Wait a bit for content to load
      await page.waitForTimeout(2000);
      
      // Try to find products with specific selectors for Blinkit
      const products = await page.evaluate((maxResults, query) => {
        const results = [];
        
        // Try multiple selector strategies for Blinkit
        const selectors = [
          'div[data-testid="plp-product"]',
          '[data-testid*="product"]',
          '.Product__UpdatedC',
          '.ProductPack__Container',
          'div[class*="ProductPack"]',
          'div[class*="Product"]'
        ];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          console.log(`Trying selector ${selector}, found ${elements.length} elements`);
          
          if (elements.length > 0) {
            for (let i = 0; i < Math.min(elements.length, maxResults); i++) {
              const element = elements[i];
              
              try {
                // Look for product name
                const nameSelectors = [
                  '[data-testid="plp-product-name"]',
                  '.Product__UpdatedTitle',
                  'h3', 'h4', 'h5',
                  '[class*="title"]',
                  '[class*="name"]',
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
                
                // Look for price
                const priceSelectors = [
                  '[data-testid="plp-product-price"]',
                  '.Product__UpdatedPrice',
                  '[class*="price"]',
                  '[class*="Price"]',
                  '.price'
                ];
                
                let priceText = null;
                for (const priceSelector of priceSelectors) {
                  const priceEl = element.querySelector(priceSelector);
                  if (priceEl && priceEl.textContent.includes('₹')) {
                    priceText = priceEl.textContent.trim();
                    break;
                  }
                }
                
                // Look for image
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
                      deliveryFee: '₹20',
                      deliveryTime: '15-20 mins',
                      category: 'General'
                    });
                  }
                }
              } catch (error) {
                console.log('Error processing element:', error);
              }
            }
            
            if (results.length > 0) {
              console.log(`Found ${results.length} products with selector: ${selector}`);
              break;
            }
          }
        }
        
        return results;
      }, maxResults, query);
      
      console.log(`🟡 Blinkit: Found ${products.length} products`);
      return products;
      
    } catch (error) {
      console.error(`🟡 Blinkit scraping error: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

module.exports = new ImprovedBlinkitScraper();