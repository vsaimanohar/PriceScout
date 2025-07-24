const puppeteer = require('puppeteer');

class RealSwiggyScraper {
  constructor() {
    this.baseUrl = 'https://www.swiggy.com';
    this.instamartUrl = 'https://www.swiggy.com/instamart';
  }

  async searchProducts(query, maxResults = 5) {
    let browser;
    
    try {
      console.log(`🟠 Swiggy: Real scraping for "${query}"`);
      
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
      
      // Speed optimizations
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font') {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      // Try Swiggy Instamart search
      const searchUrl = `https://www.swiggy.com/instamart/search?custom_back=true&query=${encodeURIComponent(query)}`;
      console.log(`🟠 Swiggy: Loading ${searchUrl}`);
      
      await page.goto(searchUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      
      await page.waitForTimeout(3000);
      
      const products = await page.evaluate((maxResults) => {
        const results = [];
        
        // Swiggy Instamart selectors
        const selectorStrategies = [
          {
            container: '[data-testid*="item"]',
            name: '[data-testid="item-name"]',
            price: '[data-testid="item-price"]',
            image: 'img'
          },
          {
            container: '.ItemCard',
            name: '.ItemCard__name',
            price: '.ItemCard__price',
            image: 'img'
          },
          {
            container: '[class*="ItemCard"]',
            name: 'h3, h4, [class*="name"], [class*="title"]',
            price: '[class*="price"], .rupee',
            image: 'img'
          },
          {
            container: '[class*="item-card"]',
            name: 'h3, h4, h5, [class*="name"], [class*="title"]',
            price: '[class*="price"], [class*="cost"], .rupee',
            image: 'img'
          }
        ];
        
        for (const strategy of selectorStrategies) {
          const containers = document.querySelectorAll(strategy.container);
          console.log(`Swiggy: Trying strategy with ${containers.length} containers`);
          
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
                        deliveryFee: '₹25',
                        deliveryTime: '20-30 mins',
                        category: 'General'
                      });
                    }
                  }
                }
              } catch (error) {
                console.log('Swiggy: Error processing container:', error);
              }
            }
            
            if (results.length > 0) {
              console.log(`Swiggy: Found ${results.length} products with strategy`);
              break;
            }
          }
        }
        
        // Text-based fallback for Swiggy
        if (results.length === 0) {
          console.log('Swiggy: Trying text extraction');
          
          // Get all visible text elements
          const allElements = Array.from(document.querySelectorAll('*')).filter(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
          });
          
          for (const element of allElements.slice(0, 100)) { // Limit search
            const text = element.textContent?.trim();
            if (text && text.includes('₹') && text.length > 10 && text.length < 100) {
              const priceMatch = text.match(/₹\s*(\d+(?:\.\d+)?)/);
              if (priceMatch) {
                const price = parseFloat(priceMatch[1]);
                const productText = text.split('₹')[0].trim();
                
                if (productText.length > 5 && price > 15 && price < 800) {
                  results.push({
                    name: productText,
                    price: price,
                    originalPrice: null,
                    url: window.location.href,
                    image: null,
                    inStock: true,
                    deliveryFee: '₹25',
                    deliveryTime: '20-30 mins',
                    category: 'General'
                  });
                  
                  if (results.length >= maxResults) break;
                }
              }
            }
          }
        }
        
        return results;
      }, maxResults);
      
      console.log(`🟠 Swiggy: Extracted ${products.length} real products`);
      return products;
      
    } catch (error) {
      console.error(`🟠 Swiggy scraping error: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

module.exports = new RealSwiggyScraper();