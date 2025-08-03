const puppeteer = require('puppeteer');
require("dotenv").config()

class RealBlinkitScraper {
  constructor() {
    this.baseUrl = 'https://blinkit.com';
  }

  async searchProducts(query, maxResults = 2) {
    let browser;
    
    try {
      console.log(`🟡 Blinkit: Real scraping for "${query}"`);
      
      browser = await puppeteer.launch({
        headless: process.env.SCRAPER_DEBUG !== 'true', // Only show browser if SCRAPER_DEBUG=true
        executablePath: process.env.NODE_ENV == 'production' ? process.env.PUPPETEER_EXECUTABLE_PATH : puppeteer.executablePath(),
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
      
      const page = await browser.newPage();
      await page.setViewport({ width: 1024, height: 768 });
      page.on('console', (msg) => {
        console.log(`🟡 [PAGE LOG]: ${msg.text()}`);
      });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Navigate directly to search URL without location - Blinkit allows this!
      const searchUrl = `https://blinkit.com/s/?q=${encodeURIComponent(query)}`;
      console.log(`🟡 Blinkit: Navigating directly to search: ${searchUrl}`);
      
      await page.goto(searchUrl, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });
      
      await page.waitForTimeout(5000);
      
      // Check if we successfully reached search results
      const finalUrl = page.url();
      const onSearchPage = finalUrl.includes('/s/?q=') || finalUrl.includes('/search');
      console.log(`🟡 Blinkit: Final URL: ${finalUrl}`);
      console.log(`🟡 Blinkit: Successfully on search page: ${onSearchPage}`);
      
      if (onSearchPage) {
        console.log(`🟡 Blinkit: ✅ Successfully reached search results for "${query}"!`);
      } else {
        console.log(`🟡 Blinkit: ⚠️ Not on search page, checking what we got...`);
      }
      
      // Take screenshot to see final state
      await page.screenshot({ path: 'blinkit_debug.png', fullPage: false });
      console.log(`🟡 Blinkit: Debug screenshot saved`);
      
      // Check final page state and look for products
      const finalState = await page.evaluate(() => {
        const bodyText = document.body.textContent || '';
        const productElements = document.querySelectorAll(
          '[data-testid*="product"], .product, [class*="product"], [class*="Product"], div[class*="item"]'
        );
        
        return {
          hasSearchResults: bodyText.includes('results') || bodyText.includes('found') || bodyText.includes('items'),
          hasProducts: productElements.length > 0,
          productCount: productElements.length,
          currentUrl: window.location.href,
          sampleText: bodyText.substring(0, 500)
        };
      });
      
      console.log(`🟡 Blinkit: Final state:`, finalState);
      
      // Extract products from search results
      const products = await page.evaluate((query) => {
        const results = [];
        
        console.log(`Extracting products for query: ${query}`);
        
        // First, try to find structured product elements
        const productSelectors = [
          '[data-testid*="product"]',
          '.product-card',
          '.product-item', 
          '.product',
          '[class*="Product"]',
          '[class*="product"]',
          'div[class*="item"]'
        ];
        
        let foundProducts = false;
        
        // Extract products from the sample text using better pattern
        const bodyText = document.body.textContent || '';
        
        // Direct text extraction based on the actual debug output format
        console.log('Extracting products from body text...');
        console.log('Sample text for debugging:', bodyText.substring(0, 1000));
        
        // Look for the specific patterns seen in debug output:
        // "OFFCoolberg Non Alcoholic Beer (Assorted)6 x 330 ml₹547 ₹594ADD"
        // "OFFBudweiser 0.0 Non Alcoholic Beer330 ml₹94 ₹99ADD"
        
        const patterns = [
          // Pattern 1: mins + Brand Name + size + price (most common format)
          /\d+\s*mins([A-Z][a-zA-Z\s&\+\-\.0-9()]{8,50}?)(\d+\s*(?:g|kg|ml|l))\s*₹(\d+)/gi,
          // Pattern 2: Brand Name + size + price + ADD
          /([A-Z][a-zA-Z\s&\+\-\.0-9()]{8,50}?)(\d+\s*(?:g|kg|ml|l))\s*₹(\d+)(?:\s*₹\d+)?\s*ADD/gi,
          // Pattern 3: Simple Brand + price + ADD 
          /([A-Z][a-zA-Z\s&\+\-\.0-9()]{8,40})\s*₹(\d+)(?:\s*₹\d+)?\s*ADD/gi
        ];
        
        const extractedProducts = [];
        
        for (const pattern of patterns) {
          let match;
          pattern.lastIndex = 0; // Reset regex
          
          while ((match = pattern.exec(bodyText)) !== null && extractedProducts.length < 2) {
            let productName, size, price;
            
            if (match.length === 5) { // Pattern with discount, name, size, price
              productName = match[2].trim();
              size = match[3].trim(); 
              price = parseFloat(match[4]);
            } else if (match.length === 4) { // Pattern with name, size, price
              productName = match[1].trim();
              size = match[2].trim();
              price = parseFloat(match[3]);
            } else if (match.length === 3) { // Pattern with name, price only
              productName = match[1].trim();
              size = '';
              price = parseFloat(match[2]);
            } else {
              continue;
            }
            
            // Simple cleanup - remove common prefixes/suffixes
            productName = productName
              .replace(/\s+/g, ' ')
              .replace(/^(ADD|SAVE|OFF|\d+%|\d+\s*mins?|prMy Cart|My Cart|Welcome|Showing|No results)\s*/gi, '')
              .replace(/\s*(ADD|SAVE|OFF|\d+%)$/gi, '')
              .replace(/^\d+%\s*OFF\s*/gi, '')
              .replace(/\d+\s*mins?\s*/gi, '')
              .replace(/(No results for.*?Showing|Showing.*?products)/gi, '')
              .replace(/^[^A-Za-z]*/, '')
              .trim();
            
            const fullProductName = size ? `${productName} ${size}` : productName;
            
            if (price >= 5 && price <= 2000 && productName.length > 3 && 
                !extractedProducts.some(p => p.name === fullProductName)) {
              
              console.log(`Found product ${extractedProducts.length + 1}: "${fullProductName}" - ₹${price}`);
              
              extractedProducts.push({
                name: fullProductName,
                price: price,
                originalPrice: null,
                url: window.location.href,
                image: null,
                inStock: true,
                deliveryFee: '₹20',
                deliveryTime: '15-20 mins',
                category: 'General'
              });
            }
          }
          
          if (extractedProducts.length >= 2) break; // Got enough products
        }
        
        results.push(...extractedProducts);
        
        // Fallback to DOM elements if text extraction didn't work
        console.log("results.length:--------------------------------------> ", results.length);
        if (results.length <= 2) {
          console.log("helooooooooooooo---------------------->")
          for (const selector of productSelectors) {
            const elements = document.querySelectorAll(selector);
            console.log(`Found ${elements.length} elements with selector: ${selector}`);
            
            if (elements.length > 0) {
              foundProducts = true;
              
              elements.forEach((element, index) => {
                if (results.length > 2) return;
                
                const text = element.textContent || '';
                const priceMatch = text.match(/₹(\d+)/);
                
                if (priceMatch) {
                  const price = parseFloat(priceMatch[1]);
                  
                  // Extract clean product names
                  let productName = text
                    .replace(/ADD/gi, '')
                    .replace(/\bmins\b/gi, '')          // standalone mins
                    .replace(/^mins/gi, '')             // mins at start
                    .replace(/mins(?=[A-Z])/gi, '')     // mins glued to capital
                    .replace(/\d+%\s*OFF/gi, '')
                    .replace(/showing results for.*/gi, '')
                    .replace(/\d+\s*mins?\s*/gi, '')
                    .replace(/My Cart/gi, '')
                    .split('₹')[0]
                    .replace(/\s+/g, ' ')
                    .trim();

                  // ✅ Also force remove mins from fallback match
                  let cleanMatch = productName.match(
                    /([A-Z][a-zA-Z\s&\+\-]+ (?:Cup Curd|Bread|Milk|Butter|Cheese|Dahi)[^₹\d]*?)(?=\d+\s*[gml]|₹)/i
                  );
                  if (cleanMatch && cleanMatch[1].trim().length > 5) {
                    productName = cleanMatch[1].trim();
                    // 🔑 Final force cleanup if match reintroduces 'mins'
                    productName = productName
                      .replace(/\bmins\b/gi, '')
                      .replace(/^mins/gi, '')
                      .replace(/mins(?=[A-Z])/gi, '')
                      .replace(/\s+/g, ' ')
                      .trim();
                  }
                  if (cleanMatch && cleanMatch[1].trim().length > 5) {
                    productName = cleanMatch[1].trim();
}
                  
                  // Final cleanup
                  productName = productName
                    .replace(/^[^A-Za-z]*/, '') // Remove leading non-letters
                    .replace(/\s+/g, ' ')
                    .trim();
                  console.log(`CLEANEDUP DONE NOW SHOWING PRDUCTNAME: ${productName}`);
                  if (price >= 5 && price <= 1000 && 
                      productName.length > 3 && productName.length < 100 &&
                      !results.some(r => r.name === productName)) {
                    
                    console.log(`Found structured product: "${productName}" - ₹${price}`);
                    
                    results.push({
                      name: productName,
                      price: price,
                      originalPrice: null,
                      url: window.location.href,
                      image: null,
                      inStock: true,
                      deliveryFee: '₹20',
                      deliveryTime: '15-20 mins',
                      category: 'General'
                    });
                  }
                }
              });
              
              if (results.length >= 2) break; // Stop when we have enough products
            }
          }
        }
        
        // If no structured products found, fall back to text extraction
        if (!foundProducts || results.length === 0) {
          console.log(`No structured products found, trying text extraction...`);
          
          const bodyText = document.body.textContent || '';
          const pricePattern = /([A-Za-z][^₹]*?)₹(\d+)/g;
          let match;
          
          while ((match = pricePattern.exec(bodyText)) !== null && results.length < 2) {
            const productPart = match[1];
            const price = parseFloat(match[2]);
            
            if (price < 5 || price > 1000) continue;
            
            const cleanName = productPart
              .replace(/\d+\s*mins?\s*/i, '')
              .replace(/^(add|buy|cart)\s*/i, '')
              .replace(/\s+/g, ' ')
              .trim();
            
            if (cleanName && cleanName.length > 3 && cleanName.length < 100 &&
                !cleanName.toLowerCase().includes('search') && 
                !cleanName.toLowerCase().includes('result') &&
                !cleanName.toLowerCase().includes('showing') &&
                !results.some(r => r.name === cleanName)) {
              
              console.log(`Found text product: "${cleanName}" - ₹${price}`);
              
              results.push({
                name: cleanName,
                price: price,
                originalPrice: null,
                url: window.location.href,
                image: null,
                inStock: true,
                deliveryFee: '₹20',
                deliveryTime: '15-20 mins',
                category: 'General'
              });
            }
          }
        }
        
        console.log(`Total products found: ${results.length}`);
        return results;
      }, query);
      
      console.log(`🟡 Blinkit: Extracted ${products.length} products:`);
      products.forEach((p, i) => console.log(`  ${i+1}. ${p.name} - ₹${p.price}`));
      
      // Return top 2 products (platforms already have good relevancy)
      return products.slice(0, 2);
      
    } catch (error) {
      console.error(`🟡 Blinkit scraping error: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  cleanProductName(rawName) {
    if (!rawName) return '';
    
    let cleaned = rawName
      // 1. Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
      
      // 2. Remove common UI elements and noise
      .replace(/^(prMy Cart|My Cart|Welcome to|Please provide|Detect my|Showing|No results|related products|Cart)\s*/gi, '')
      .replace(/(No results for.*?Showing|Showing.*?products|related products)/gi, '')
      .replace(/^(ADD|SAVE|OFF|\d+%|\d+\s*mins?)\s*/gi, '')
      .replace(/\s*(ADD|SAVE|OFF|\d+%)$/gi, '')
      .replace(/^\d+%\s*OFF\s*/gi, '')
      .replace(/\d+\s*mins?\s*/gi, '')
      
      // 3. Remove leading/trailing junk
      .replace(/^[^A-Za-z]*/, '') // Remove leading non-letters
      .replace(/[^A-Za-z0-9\s\.\-\(\)]*$/, '') // Remove trailing junk
      .trim();
    
    // 4. Extract the actual product name (first meaningful part)
    const parts = cleaned.split(/\s+/);
    const meaningfulParts = [];
    
    for (const part of parts) {
      // Stop at common breaking points
      if (/^(Showing|results|for|related|products|₹|ADD|SAVE|OFF)$/i.test(part)) {
        break;
      }
      // Skip pure numbers unless they look like weights/volumes
      if (/^\d+$/.test(part) && !meaningfulParts.some(p => /^(g|ml|kg|l)$/i.test(p))) {
        continue;
      }
      meaningfulParts.push(part);
      
      // Stop after reasonable product name length
      if (meaningfulParts.length >= 8) break;
    }
    
    const result = meaningfulParts.join(' ').trim();
    
    // 5. Final validation - return only if it looks like a real product name
    if (result.length >= 8 && result.length <= 100 && /[A-Za-z]/.test(result)) {
      return result;
    }
    
    return '';
  }
}

module.exports = new RealBlinkitScraper();