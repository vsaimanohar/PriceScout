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
      
      // First check what we have on page before extraction
      const debugInfo = await page.evaluate(() => {
        const selectorCounts = {
          '[data-testid="product-card"]': document.querySelectorAll('[data-testid="product-card"]').length,
          '.ProductCard': document.querySelectorAll('.ProductCard').length,
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
      
      console.log(`🟣 Zepto: Page analysis:`, debugInfo);
      
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
          // This log won't show in Node console, but we'll check outside
          
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
        
        // Always try aggressive extraction to get more products
        console.log('🟣 Zepto: Starting aggressive product extraction');
        
        // Look for any elements that contain price symbols
        const priceElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent || '';
          return text.includes('₹') && text.length > 5 && text.length < 200;
        });
        
        console.log(`🟣 Zepto: Found ${priceElements.length} elements with ₹ symbol`);
          
        for (const element of priceElements.slice(0, 200)) { // Increased to capture more products
          try {
            const text = element.textContent.trim();
            const priceMatch = text.match(/₹\s*(\d+(?:\.\d+)?)/);
            
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
                  
                  if (results.length >= 25) break; // Extract more products before relevancy filtering
                }
              }
            }
          } catch (error) {
            console.log('🟣 Zepto: Error in aggressive extraction:', error);
          }
        }
        
        return results;
      }, maxResults);
      
      console.log(`🟣 Zepto: Extracted ${products.length} products before relevancy filtering`);
      
      // Apply relevancy algorithm - prioritize products that match search terms
      const relevantProducts = this.filterByRelevancy(products, query);
      
      // Log each relevant product found
      relevantProducts.forEach((product, index) => {
        console.log(`🟣 Zepto: Product ${index + 1}: "${product.name}" - ₹${product.price} (Relevancy: ${product.relevancyScore})`);
      });
      
      return relevantProducts;
      
    } catch (error) {
      console.error(`🟣 Zepto scraping error: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  filterByRelevancy(products, query) {
    const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    console.log(`🟣 Zepto: Query terms for relevancy: [${queryTerms.join(', ')}]`);
    
    // Identify the primary term (usually brand/most important)
    const primaryTerm = queryTerms[0]; // First term is usually the brand
    const secondaryTerms = queryTerms.slice(1); // Rest are category/descriptive terms
    
    console.log(`🟣 Zepto: Primary term (must match): "${primaryTerm}"`);
    console.log(`🟣 Zepto: Secondary terms: [${secondaryTerms.join(', ')}]`);
    
    // Calculate relevancy score for each product
    const scoredProducts = products.map(product => {
      const productName = product.name.toLowerCase();
      let score = 0;
      let matchesPrimary = false;
      
      // Check primary term match (REQUIRED)
      if (productName.includes(primaryTerm)) {
        score += 10; // High score for primary term
        matchesPrimary = true;
        console.log(`🟣 Zepto: "${product.name}" matches primary "${primaryTerm}" (+10 points)`);
      }
      
      // Only continue scoring if primary term matches
      if (!matchesPrimary) {
        console.log(`🟣 Zepto: "${product.name}" REJECTED - doesn't match primary term "${primaryTerm}"`);
        return {
          ...product,
          relevancyScore: 0
        };
      }
      
      // Secondary term matching (bonus points)
      secondaryTerms.forEach(term => {
        if (productName.includes(term)) {
          score += 3;
          console.log(`🟣 Zepto: "${product.name}" matches secondary "${term}" (+3 points)`);
        }
      });
      
      // Exact phrase matching (bonus)
      if (productName.includes(query.toLowerCase())) {
        score += 5;
        console.log(`🟣 Zepto: "${product.name}" matches full phrase (+5 points)`);
      }
      
      return {
        ...product,
        relevancyScore: score
      };
    });
    
    // Filter products that match primary term and sort by score
    const relevantProducts = scoredProducts
      .filter(product => product.relevancyScore > 0)
      .sort((a, b) => b.relevancyScore - a.relevancyScore)
      .slice(0, 5);
    
    console.log(`🟣 Zepto: Filtered to ${relevantProducts.length} relevant products from ${products.length} total`);
    
    // If no products match primary term, return empty array
    if (relevantProducts.length === 0) {
      console.log(`🟣 Zepto: No products match primary term "${primaryTerm}" - returning empty results`);
    }
    
    return relevantProducts;
  }
}

module.exports = new RealZeptoScraper();