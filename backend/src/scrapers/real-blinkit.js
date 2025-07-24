const puppeteer = require('puppeteer');

class RealBlinkitScraper {
  constructor() {
    this.baseUrl = 'https://blinkit.com';
  }

  async searchProducts(query, maxResults = 5) {
    let browser;
    
    try {
      console.log(`🟡 Blinkit: Real scraping for "${query}"`);
      
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-images',
          '--disable-plugins',
          '--disable-extensions',
          '--no-first-run'
        ],
        timeout: 10000
      });
      
      const page = await browser.newPage();
      await page.setViewport({ width: 1024, height: 768 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Block images and CSS for speed
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font') {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      // Try direct search URL
      const searchUrl = `https://blinkit.com/s/?q=${encodeURIComponent(query)}`;
      console.log(`🟡 Blinkit: Loading ${searchUrl}`);
      
      await page.goto(searchUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      
      await page.waitForTimeout(3000);
      
      const products = await page.evaluate((maxResults) => {
        const results = [];
        
        // Blinkit-specific selectors
        const selectorStrategies = [
          {
            container: 'div[data-testid="plp-product"]',
            name: '[data-testid="plp-product-name"]',
            price: '[data-testid="plp-product-price"]',
            image: 'img'
          },
          {
            container: '.Product__UpdatedC',
            name: '.Product__UpdatedTitle',
            price: '.Product__UpdatedPrice',
            image: 'img'
          },
          {
            container: '[class*="ProductPack"]',
            name: 'h3, h4, [class*="name"], [class*="title"]',
            price: '[class*="price"], [class*="cost"]',
            image: 'img'
          },
          {
            container: '[class*="product"]',
            name: 'h3, h4, h5, [class*="name"], [class*="title"]',
            price: '[class*="price"], [class*="cost"]',
            image: 'img'
          }
        ];
        
        for (const strategy of selectorStrategies) {
          const containers = document.querySelectorAll(strategy.container);
          console.log(`Blinkit: Trying strategy with ${containers.length} containers`);
          
          if (containers.length > 0) {
            for (let i = 0; i < Math.min(containers.length, maxResults); i++) {
              const container = containers[i];
              
              try {
                const nameEl = container.querySelector(strategy.name);
                const priceEl = container.querySelector(strategy.price);
                const imgEl = container.querySelector(strategy.image);
                
                const name = nameEl ? nameEl.textContent.trim() : null;
                const priceText = priceEl ? priceEl.textContent.trim() : null;
                const imageUrl = imgEl ? imgEl.src || imgEl.getAttribute('data-src') : null;
                
                if (name && priceText && name.length > 3) {
                  const priceMatch = priceText.match(/₹?\s*(\d+(?:\.\d+)?)/);
                  if (priceMatch) {
                    const price = parseFloat(priceMatch[1]);
                    
                    if (price > 0 && price < 10000) {
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
                }
              } catch (error) {
                console.log('Blinkit: Error processing container:', error);
              }
            }
            
            if (results.length > 0) {
              console.log(`Blinkit: Found ${results.length} products with strategy`);
              break;
            }
          }
        }
        
        // Fallback: scan page text for product-like content
        if (results.length === 0) {
          console.log('Blinkit: Trying text scanning approach');
          
          const textNodes = [];
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          
          let node;
          while (node = walker.nextNode()) {
            const text = node.textContent.trim();
            if (text.includes('₹') && text.length > 10 && text.length < 80) {
              textNodes.push(text);
            }
          }
          
          for (const text of textNodes.slice(0, maxResults * 2)) {
            const priceMatch = text.match(/₹\s*(\d+(?:\.\d+)?)/);
            if (priceMatch) {
              const price = parseFloat(priceMatch[1]);
              const beforePrice = text.split('₹')[0].trim();
              
              if (beforePrice.length > 5 && price > 10 && price < 1000) {
                results.push({
                  name: beforePrice,
                  price: price,
                  originalPrice: null,
                  url: window.location.href,
                  image: null,
                  inStock: true,
                  deliveryFee: '₹20',
                  deliveryTime: '15-20 mins',
                  category: 'General'
                });
                
                if (results.length >= maxResults) break;
              }
            }
          }
        }
        
        return results;
      }, maxResults);
      
      console.log(`🟡 Blinkit: Extracted ${products.length} real products`);
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

module.exports = new RealBlinkitScraper();