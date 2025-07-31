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
          '--disable-features=VizDisplayCompositor',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=VizDisplayCompositor',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ],
        timeout: 10000
      });
      
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });
      
      // More realistic user agent rotation
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
      ];
      const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
      await page.setUserAgent(randomUA);
      
      // Hide automation indicators
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        delete navigator.__proto__.webdriver;
        
        // Override plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5]
        });
        
        // Override languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en']
        });
        
        // Override geolocation
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
      
      // Set realistic headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
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
      
      // Simple direct search URL approach like Blinkit
      const searchUrl = `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(query)}`;
      console.log(`🟠 Swiggy: Navigating directly to search: ${searchUrl}`);
      
      await page.goto(searchUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await page.waitForTimeout(5000);
      
      console.log(`🟠 Swiggy: Page loaded, extracting products...`);
      
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
        
        console.log('🟠 Swiggy: Starting focused product extraction for visible items');
        
        // Look for specific Swiggy search result pattern from the debug image
        // The page shows products like "Cadbury 5 Star" with "₹57" below
        const productElements = [];
        
        // Try to find all elements that contain text matching product patterns
        const allElements = Array.from(document.querySelectorAll('*'));
        
        // First, find all price elements (₹ symbols)
        const priceElements = [];
        allElements.forEach(el => {
          const text = el.textContent?.trim() || '';
          if (text.match(/^₹\d+/) && text.length < 20) { // Exact price format like "₹57"
            priceElements.push({
              element: el,
              price: parseFloat(text.replace('₹', '')),
              text: text
            });
          }
        });
        
        console.log(`🟠 Swiggy: Found ${priceElements.length} price elements`);
        
        // For each price element, look for nearby product name
        priceElements.forEach(priceInfo => {
          if (results.length >= 2) return; // Only want top 2
          
          const priceEl = priceInfo.element;
          const price = priceInfo.price;
          
          if (price < 5 || price > 2000) return;
          
          // Look for product name in siblings or nearby elements
          let productName = null;
          let currentEl = priceEl;
          
          // Traverse up parent hierarchy to find product container
          for (let i = 0; i < 5 && currentEl && !productName; i++) {
            const parent = currentEl.parentElement;
            if (!parent) break;
            
            // Check all children of this parent for product names
            const siblings = Array.from(parent.children);
            
            for (const sibling of siblings) {
              if (sibling === priceEl) continue; // Skip the price element itself
              
              const siblingText = sibling.textContent?.trim();
              if (siblingText && 
                  !siblingText.includes('₹') && 
                  !siblingText.includes('ADD') &&
                  !siblingText.includes('MINS') &&
                  !siblingText.includes('options') &&
                  siblingText.length > 3 && 
                  siblingText.length < 50 &&
                  !siblingText.match(/^\d+\s*(g|ml|kg|l)$/i) && // Not just weight/volume
                  !siblingText.toLowerCase().includes('filter') &&
                  !siblingText.toLowerCase().includes('sort') &&
                  !siblingText.toLowerCase().includes('brand') &&
                  !siblingText.toLowerCase().includes('size') &&
                  !siblingText.toLowerCase().includes('type') &&
                  !siblingText.toLowerCase().includes('handpicked') &&
                  !siblingText.toLowerCase().includes('quick') &&
                  !siblingText.toLowerCase().includes('imported') &&
                  !siblingText.toLowerCase().includes('refine') &&
                  !siblingText.toLowerCase().includes('results') &&
                  !siblingText.toLowerCase().includes('showing') &&
                  // Reject if it contains too many filter-like words concatenated
                  !(siblingText.match(/[A-Z][a-z]+[A-Z][a-z]+[A-Z]/))) {
                
                // Prioritize text that looks like product names
                if (siblingText.match(/^[A-Z][a-zA-Z\s]+/) || // Starts with capital letter
                    siblingText.toLowerCase().includes('cadbury') ||
                    siblingText.toLowerCase().includes('nestle') ||
                    siblingText.toLowerCase().includes('chocolate') ||
                    siblingText.toLowerCase().includes('star') ||
                    siblingText.toLowerCase().includes('bar') ||
                    siblingText.toLowerCase().includes('wodel')) {
                  
                  productName = siblingText;
                  console.log(`🟠 Swiggy: Found product name "${productName}" near price ₹${price}`);
                  break;
                }
              }
            }
            
            currentEl = parent;
          }
          
          // If we found a valid product name and price
          if (productName && !results.some(r => r.name === productName)) {
            console.log(`🟠 Swiggy: Adding product: "${productName}" - ₹${price}`);
            
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
          }
        });
        
        // If structured approach didn't work, try text extraction from body
        if (results.length === 0) {
          console.log('🟠 Swiggy: Trying text-based extraction from page content');
          
          const bodyText = document.body.textContent || '';
          
          // Look for patterns like "Cadbury 5 Star...₹57" or "Wodel White Chocolate Bar...₹245"
          const productPattern = /([A-Z][a-zA-Z\s&]+(?:Star|Bar|Chocolate|Biscuit|Cookie|Cake|Candy)[^₹]{0,50})₹(\d+)/gi;
          let match;
          
          const textResults = [];
          while ((match = productPattern.exec(bodyText)) !== null && textResults.length < 2) {
            const name = match[1].trim().replace(/\s+/g, ' ');
            const price = parseFloat(match[2]);
            
            if (price > 5 && price < 2000 && name.length > 5 && name.length < 60) {
              textResults.push({
                name: name,
                price: price,
                originalPrice: null,
                url: window.location.href,
                image: null,
                inStock: true,
                deliveryFee: '₹25',
                deliveryTime: '20-30 mins',
                category: 'General'
              });
              
              console.log(`🟠 Swiggy: Text extraction found: "${name}" - ₹${price}`);
            }
          }
          
          results.push(...textResults);
        }
        
        console.log(`🟠 Swiggy: Final extraction result: ${results.length} products`);
        return results.slice(0, 2); // Return only top 2
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
      
      // Return empty results when scraping fails - no mock data
      console.log(`🟠 Swiggy: Returning empty results due to scraping failure`);
      return [];
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