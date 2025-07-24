const puppeteer = require('puppeteer');

class RealZeptoScraper {
  constructor() {
    this.baseUrl = 'https://www.zeptonow.com';
    this.searchUrl = 'https://www.zeptonow.com/search';
  }

  async searchProducts(query, maxResults = 5) {
    let browser;
    
    try {
      console.log(`🟣 Zepto: Real scraping for "${query}"`);
      
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-images', // Skip images for speed
          '--disable-javascript', // Try without JS first
          '--disable-plugins',
          '--disable-extensions',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-default-apps'
        ],
        timeout: 10000
      });
      
      const page = await browser.newPage();
      
      // Speed optimizations
      await page.setViewport({ width: 1024, height: 768 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Block unnecessary resources for speed
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font') {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      // Navigate to search URL
      const searchUrl = `${this.searchUrl}?query=${encodeURIComponent(query)}`;
      console.log(`🟣 Zepto: Loading ${searchUrl}`);
      
      await page.goto(searchUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      
      console.log(`🟣 Zepto: Page loaded, waiting for content...`);
      
      // Wait briefly for content
      await page.waitForTimeout(2000);
      
      // Debug: Take screenshot for debugging
      await page.screenshot({ path: 'zepto_debug.png', fullPage: false });
      console.log(`🟣 Zepto: Debug screenshot saved as zepto_debug.png`);
      
      // Debug: Check page title and basic content
      const title = await page.title();
      const bodyText = await page.evaluate(() => document.body.textContent?.substring(0, 200));
      console.log(`🟣 Zepto: Page title: "${title}"`);
      console.log(`🟣 Zepto: Body text sample: "${bodyText}"`);
      
      // Debug: Count potential product containers
      const containerCounts = await page.evaluate(() => {
        const selectors = [
          '[data-testid="product-card"]',
          '.ProductCard', 
          '[class*="product"]',
          'div[class*="Product"]',
          'div[class*="item"]'
        ];
        
        const counts = {};
        selectors.forEach(selector => {
          counts[selector] = document.querySelectorAll(selector).length;
        });
        
        return counts;
      });
      
      console.log(`🟣 Zepto: Container counts:`, containerCounts);
      
      // Extract products using multiple selector strategies
      const products = await page.evaluate((maxResults) => {
        const results = [];
        
        // Zepto product selectors (try multiple approaches)
        const selectorStrategies = [
          {
            container: '[data-testid="product-card"]',
            name: '[data-testid="product-name"]',
            price: '[data-testid="product-price"]',
            image: 'img'
          },
          {
            container: '.ProductCard',
            name: '.ProductCard__name',
            price: '.ProductCard__price',
            image: 'img'
          },
          {
            container: '[class*="product"]',
            name: 'h3, h4, [class*="name"], [class*="title"]',
            price: '[class*="price"], [class*="cost"]',
            image: 'img'
          }
        ];
        
        for (const strategy of selectorStrategies) {
          const containers = document.querySelectorAll(strategy.container);
          console.log(`🟣 Zepto: Trying strategy "${strategy.container}" with ${containers.length} containers`);
          
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
                  // Extract price number
                  const priceMatch = priceText.match(/₹?\s*(\d+(?:\.\d+)?)/);
                  if (priceMatch) {
                    const price = parseFloat(priceMatch[1]);
                    
                    if (price > 0 && price < 10000) { // Reasonable price range
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
                }
              } catch (error) {
                console.log('Zepto: Error processing container:', error);
              }
            }
            
            if (results.length > 0) {
              console.log(`Zepto: Found ${results.length} products with strategy`);
              break;
            }
          }
        }
        
        // If no products found with structured selectors, try aggressive extraction
        if (results.length === 0) {
          console.log('🟣 Zepto: Trying aggressive product extraction');
          
          // Look for any elements that contain price symbols
          const priceElements = Array.from(document.querySelectorAll('*')).filter(el => {
            const text = el.textContent || '';
            return text.includes('₹') && text.length > 5 && text.length < 200;
          });
          
          console.log(`🟣 Zepto: Found ${priceElements.length} elements with ₹ symbol`);
          
          for (const element of priceElements.slice(0, maxResults * 3)) {
            try {
              const text = element.textContent.trim();
              const priceMatch = text.match(/₹\s*(\d+(?:\.\d+)?)/);
              
              if (priceMatch) {
                const price = parseFloat(priceMatch[1]);
                
                if (price > 10 && price < 1000) {
                  // Try to find product name by looking at parent elements
                  let productName = null;
                  let currentEl = element;
                  
                  // Traverse up to find a good product name
                  for (let i = 0; i < 5 && currentEl; i++) {
                    const siblings = Array.from(currentEl.parentElement?.children || []);
                    
                    for (const sibling of siblings) {
                      const siblingText = sibling.textContent?.trim();
                      if (siblingText && 
                          !siblingText.includes('₹') && 
                          siblingText.length > 5 && 
                          siblingText.length < 80 &&
                          !siblingText.match(/^\d+$/) && // Not just numbers
                          !siblingText.toLowerCase().includes('add') &&
                          !siblingText.toLowerCase().includes('buy')) {
                        productName = siblingText;
                        break;
                      }
                    }
                    
                    if (productName) break;
                    currentEl = currentEl.parentElement;
                  }
                  
                  // If still no name, try extracting from the price element's text
                  if (!productName) {
                    const beforePrice = text.split('₹')[0].trim();
                    if (beforePrice.length > 5 && beforePrice.length < 60) {
                      productName = beforePrice;
                    }
                  }
                  
                  if (productName && productName.length > 3) {
                    console.log(`🟣 Zepto: Found product: "${productName}" at ₹${price}`);
                    
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
                    
                    if (results.length >= maxResults) break;
                  }
                }
              }
            } catch (error) {
              console.log('🟣 Zepto: Error in aggressive extraction:', error);
            }
          }
        }
        
        return results;
      }, maxResults);
      
      console.log(`🟣 Zepto: Extracted ${products.length} real products`);
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

module.exports = new RealZeptoScraper();