const puppeteer = require('puppeteer');

class RealSwiggyScraper {
  constructor() {
    this.baseUrl = 'https://www.swiggy.com';
    this.instamartUrl = 'https://www.swiggy.com/instamart';
  }

  async searchProducts(query, maxResults = 2) {
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
          '--no-first-run',
          '--disable-geolocation',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ],
        timeout: 10000
      });
      
      const page = await browser.newPage();
      await page.setViewport({ width: 1024, height: 768 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Override geolocation to prevent location errors
      await page.setGeolocation({ latitude: 12.9716, longitude: 77.5946 }); // Bangalore coordinates
      
      // Set a fake location context
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'geolocation', {
          value: {
            getCurrentPosition: (success) => {
              success({
                coords: { latitude: 12.9716, longitude: 77.5946 }
              });
            },
            watchPosition: () => {}
          }
        });
      });
      
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
      
      // Try different Swiggy URLs to avoid location issues
      const searchUrls = [
        `https://www.swiggy.com/instamart/search?custom_back=true&query=${encodeURIComponent(query)}`,
        `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(query)}`,
        `https://www.swiggy.com/instamart/category/dairy-bread-eggs-1/${encodeURIComponent(query)}`
      ];
      
      let successfulUrl = null;
      for (const searchUrl of searchUrls) {
        try {
          console.log(`🟠 Swiggy: Trying ${searchUrl}`);
          
          await page.goto(searchUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 8000 
          });
          
          // Check if page loaded successfully (not error page)
          const title = await page.title();
          const bodyText = await page.evaluate(() => document.body.textContent?.substring(0, 100));
          
          if (!bodyText?.toLowerCase().includes('something went wrong') && 
              !bodyText?.toLowerCase().includes('error')) {
            successfulUrl = searchUrl;
            console.log(`🟠 Swiggy: Successfully loaded ${searchUrl}`);
            break;
          } else {
            console.log(`🟠 Swiggy: Error page detected for ${searchUrl}, trying next...`);
          }
        } catch (error) {
          console.log(`🟠 Swiggy: Failed to load ${searchUrl}: ${error.message}`);
          continue;
        }
      }
      
      if (!successfulUrl) {
        console.log(`🟠 Swiggy: All URLs failed, proceeding with last attempt...`);
        const searchUrl = searchUrls[0];
        console.log(`🟠 Swiggy: Loading ${searchUrl}`);
        
        await page.goto(searchUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 10000 
        });
      }
      
      console.log(`🟠 Swiggy: Page loaded, waiting for content...`);
      
      // Wait briefly for content
      await page.waitForTimeout(2000);
      
      // Debug: Take screenshot for debugging
      await page.screenshot({ path: 'swiggy_debug.png', fullPage: false });
      console.log(`🟠 Swiggy: Debug screenshot saved as swiggy_debug.png`);
      
      // Debug: Check page title and basic content
      const title = await page.title();
      const bodyText = await page.evaluate(() => document.body.textContent?.substring(0, 200));
      console.log(`🟠 Swiggy: Page title: "${title}"`);
      console.log(`🟠 Swiggy: Body text sample: "${bodyText}"`);
      
      // Debug: Count potential product containers
      const containerCounts = await page.evaluate(() => {
        const selectors = [
          '[data-testid*="item"]',
          '.ItemCard',
          '[class*="ItemCard"]',
          '[class*="item-card"]',
          '[class*="product"]'
        ];
        
        const counts = {};
        selectors.forEach(selector => {
          counts[selector] = document.querySelectorAll(selector).length;
        });
        
        return counts;
      });
      
      console.log(`🟠 Swiggy: Container counts:`, containerCounts);
      
      // First check what we have on page before extraction
      const debugInfo = await page.evaluate(() => {
        const selectorCounts = {
          '[data-testid*="item"]': document.querySelectorAll('[data-testid*="item"]').length,
          '.ItemCard': document.querySelectorAll('.ItemCard').length,
          '[class*="product"]': document.querySelectorAll('[class*="product"]').length,
          'elements_with_rupee': document.querySelectorAll('*').length
        };
        
        const priceElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent || '';
          return text.includes('₹') && text.length > 5 && text.length < 200;
        });
        
        return {
          selectorCounts,
          priceElementsCount: priceElements.length,
          bodyLength: document.body.textContent?.length || 0
        };
      });
      
      console.log(`🟠 Swiggy: Page analysis:`, debugInfo);
      
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
            for (let i = 0; i < Math.min(containers.length, 25); i++) { // Extract more from structured selectors
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
                    
                    if (price > 5 && price < 2000) { // Broader price range
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
        
        // Always try aggressive extraction to get more products
        console.log('🟠 Swiggy: Starting aggressive product extraction');
        
        // Look for any elements that contain price symbols or number patterns
        const priceElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent || '';
          // Look for ₹ symbol OR number patterns that look like prices (with ADD, g, ml context)
          return (text.includes('₹') || 
                  (/\d{2,4}.*ADD/i.test(text)) ||
                  (/\d{2,4}\s*g.*\d{2,4}/i.test(text)) ||
                  (/\d{2,4}−ADD/i.test(text))) && 
                 text.length > 3 && text.length < 200;
        });
        
        console.log(`🟠 Swiggy: Found ${priceElements.length} elements with ₹ symbol`);
        
        for (const element of priceElements.slice(0, 200)) { // Increased to capture more products
          try {
            const text = element.textContent.trim();
            // Try multiple price patterns
            let priceMatch = text.match(/₹\s*(\d+(?:\.\d+)?)/); // Standard ₹ format
            
            if (!priceMatch) {
              // Try pattern like "400 g50−ADD" where 50 is the price
              priceMatch = text.match(/\d+\s*g(\d{2,4})(?:−|-)ADD/i);
            }
            
            if (!priceMatch) {
              // Try pattern like "50 ADD" or "50−ADD"
              priceMatch = text.match(/(\d{2,4})(?:−|-|\s+)ADD/i);
            }
            
            if (priceMatch) {
              const price = parseFloat(priceMatch[1]);
              
              if (price > 5 && price < 2000) { // Broader price range
                // Try to find product name by looking at parent elements
                let productName = null;
                let currentEl = element;
                
                // Traverse up to find a good product name with improved matching
                for (let i = 0; i < 6 && currentEl; i++) {
                  const parent = currentEl.parentElement;
                  if (!parent) break;
                  
                  const siblings = Array.from(parent.children);
                  
                  for (const sibling of siblings) {
                    const siblingText = sibling.textContent?.trim();
                    if (siblingText && 
                        !siblingText.includes('₹') && 
                        siblingText.length > 4 && 
                        siblingText.length < 100 &&
                        !siblingText.match(/^\d+$/) && // Not just numbers
                        !siblingText.toLowerCase().includes('add') &&
                        !siblingText.toLowerCase().includes('buy') &&
                        !siblingText.toLowerCase().includes('cart') &&
                        !siblingText.toLowerCase().includes('delivery') &&
                        !siblingText.toLowerCase().includes('free')) {
                      
                      // Prioritize text that contains brand names or key terms
                      const lowerText = siblingText.toLowerCase();
                      if (lowerText.includes('hatsun') || lowerText.includes('heritage') || 
                          lowerText.includes('godrej') || lowerText.includes('amul') ||
                          lowerText.includes('curd') || lowerText.includes('milk') || 
                          lowerText.includes('dairy') || lowerText.includes('organic') ||
                          lowerText.includes('fresh') || lowerText.includes('farm')) {
                        productName = siblingText;
                        break;
                      } else if (!productName && siblingText.length > 8) {
                        // Keep as fallback if no better name found
                        productName = siblingText;
                      }
                    }
                  }
                  
                  if (productName && (productName.toLowerCase().includes('hatsun') || 
                                     productName.toLowerCase().includes('heritage'))) break;
                  currentEl = parent;
                }
                
                // If still no name, try extracting from the price element's text
                if (!productName) {
                  const beforePrice = text.split('₹')[0].trim();
                  if (beforePrice.length > 5 && beforePrice.length < 60) {
                    productName = beforePrice;
                  }
                }
                
                // Filter out only obvious generic/unwanted text
                const isValidProduct = productName && 
                  productName.length > 3 && 
                  productName.length < 100 &&
                  !productName.toLowerCase().includes('showing results') &&
                  !productName.toLowerCase().includes('search results') &&
                  !results.some(r => r.name === productName); // No duplicates
                
                if (isValidProduct) {
                  console.log(`🟠 Swiggy: Found product: "${productName}" at ₹${price}`);
                  
                  results.push({
                    name: productName,
                    price: price,
                    originalPrice: null,
                    url: window.location.href,
                    image: null,
                    inStock: true,
                    deliveryFee: '₹25',
                    deliveryTime: '20-30 mins',
                    category: 'General'
                  });
                  
                  if (results.length >= 25) break; // Extract more products before relevancy filtering
                }
              }
            }
          } catch (error) {
            console.log('🟠 Swiggy: Error in aggressive extraction:', error);
          }
        }
        
        return results;
      }, maxResults);
      
      console.log(`🟠 Swiggy: Extracted ${products.length} products before relevancy filtering`);
      
      // Apply relevancy algorithm - prioritize products that match search terms
      const relevantProducts = this.filterByRelevancy(products, query);
      
      // Log each relevant product found
      relevantProducts.forEach((product, index) => {
        console.log(`🟠 Swiggy: Product ${index + 1}: "${product.name}" - ₹${product.price} (Relevancy: ${product.relevancyScore})`);
      });
      
      return relevantProducts;
      
    } catch (error) {
      console.error(`🟠 Swiggy scraping error: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  filterByRelevancy(products, query) {
    const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    console.log(`🟠 Swiggy: Query terms for relevancy: [${queryTerms.join(', ')}]`);
    
    // If no specific query terms, return all products (less strict filtering)
    if (queryTerms.length === 0) {
      console.log(`🟠 Swiggy: No specific query terms, returning all ${products.length} products`);
      return products.slice(0, 5);
    }
    
    // Calculate relevancy score for each product
    const scoredProducts = products.map(product => {
      const productName = product.name.toLowerCase();
      let score = 0;
      
      // Check if any query term matches
      let hasAnyMatch = false;
      queryTerms.forEach(term => {
        if (productName.includes(term)) {
          score += 5; // Give points for any term match
          hasAnyMatch = true;
          console.log(`🟠 Swiggy: "${product.name}" matches term "${term}" (+5 points)`);
        }
      });
      
      // Exact phrase matching (bonus)
      if (productName.includes(query.toLowerCase())) {
        score += 10;
        hasAnyMatch = true;
        console.log(`🟠 Swiggy: "${product.name}" matches full phrase (+10 points)`);
      }
      
      // If no matches found, still give a base score to prevent complete filtering
      if (!hasAnyMatch) {
        score = 1; // Minimum score to keep product
        console.log(`🟠 Swiggy: "${product.name}" - no direct match, keeping with base score`);
      }
      
      return {
        ...product,
        relevancyScore: score
      };
    });
    
    // Sort by score and return top products (don't filter out completely)
    const relevantProducts = scoredProducts
      .sort((a, b) => b.relevancyScore - a.relevancyScore)
      .slice(0, 2);
    
    console.log(`🟠 Swiggy: Returning ${relevantProducts.length} products from ${products.length} total`);
    
    return relevantProducts;
  }
}

module.exports = new RealSwiggyScraper();