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
        headless: "new", // Use new headless mode to avoid warnings
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-images', // Skip images for speed
          // REMOVED --disable-javascript - we NEED JS for React!
          '--disable-plugins',
          '--disable-extensions',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-default-apps',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security', // Help with React SPA loading
          '--disable-features=VizDisplayCompositor'
        ],
        timeout: 15000
      });
      
      const page = await browser.newPage();
      
      // More realistic browser simulation
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set location to Chennai for better product availability (Hatsun products)
      await page.setGeolocation({ latitude: 13.0827, longitude: 80.2707 });
      console.log(`🟣 Zepto: Location set to Chennai`);
      
      // Add extra headers to appear more like a real browser
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      });
      
      // Override permissions for geolocation
      const context = browser.defaultBrowserContext();
      await context.overridePermissions('https://www.zeptonow.com', ['geolocation']);
      
      // Allow all resources initially to ensure React can load properly
      // We'll optimize this later once content is working
      console.log(`🟣 Zepto: Allowing all resources for React to load properly`);
      
      // Try different approach: Use the mobile/simpler URL format
      console.log(`🟣 Zepto: Trying mobile-optimized approach...`);
      
      try {
        // Use the correct URL format with + signs instead of %20
        const searchUrl = `https://www.zeptonow.com/search?query=${query.replace(/\s+/g, '+')}`;
        console.log(`🟣 Zepto: Loading search URL: ${searchUrl}`);
        
        await page.goto(searchUrl, { 
          waitUntil: ['domcontentloaded'],
          timeout: 15000 
        });
      } catch (error) {
        console.log(`🟣 Zepto: Alternative approaches failed, trying main page navigation...`);
        
        // Final fallback: Load main page first
        await page.goto(this.baseUrl, { 
          waitUntil: ['domcontentloaded'],
          timeout: 15000 
        });
        await page.waitForTimeout(3000);
        
        const searchUrl = `${this.searchUrl}?query=${encodeURIComponent(query)}`;
        console.log(`🟣 Zepto: Final attempt with: ${searchUrl}`);
        
        await page.goto(searchUrl, { 
          waitUntil: ['domcontentloaded'],
          timeout: 20000 
        });
      }
      
      console.log(`🟣 Zepto: Page loaded, waiting for React content to render...`);
      
      // Wait for React/Next.js to render actual content with prices, not just placeholder elements
      try {
        console.log(`🟣 Zepto: Waiting for actual product content with prices...`);
        
        // Wait for basic React app to initialize
        await page.waitForTimeout(5000);
        
        // Check if we're on the search page by looking at URL and content
        const currentUrl = page.url();
        console.log(`🟣 Zepto: Current URL: ${currentUrl}`);
        
        // If we're not on a search page, try to navigate properly
        if (!currentUrl.includes('search') && !currentUrl.includes('query')) {
          console.log(`🟣 Zepto: Not on search page, trying direct navigation...`);
          const directSearchUrl = `https://www.zeptonow.com/search?query=${encodeURIComponent(query)}`;
          await page.goto(directSearchUrl, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(5000);
        }
        
        // Try to detect search results specifically
        await page.waitForFunction((searchQuery) => {
          const bodyText = document.body.textContent || '';
          const bodyHTML = document.body.innerHTML || '';
          
          // Check if page has loaded real content (not just JS bundles)
          const hasRealContent = !bodyText.startsWith('Object.assign(window,') && 
                                !bodyText.startsWith('(self.__next_f=') &&
                                bodyText.length > 5000;
          
          // Check for search-specific indicators
          const hasSearchResults = bodyText.toLowerCase().includes('results') ||
                                 bodyText.toLowerCase().includes('found') ||
                                 bodyText.includes(searchQuery.toLowerCase()) ||
                                 bodyHTML.includes('search');
          
          const hasPriceElements = bodyText.includes('₹') && 
                                 document.querySelectorAll('*').length > 100;
          
          console.log(`Zepto: Search check - hasRealContent: ${hasRealContent}, hasSearchResults: ${hasSearchResults}, hasPrices: ${hasPriceElements}, URL: ${window.location.href}`);
          
          return hasRealContent && (hasSearchResults || hasPriceElements);
        }, { timeout: 25000, polling: 3000 }, query);
        
        console.log(`🟣 Zepto: Actual product content with prices found!`);
      } catch (error) {
        console.log(`🟣 Zepto: Timeout waiting for content, trying search input approach...`);
        
        try {
          // Try using search input if direct URL didn't work
          console.log(`🟣 Zepto: Trying to navigate via homepage and search input...`);
          
          await page.goto(this.baseUrl, { waitUntil: ['domcontentloaded'], timeout: 15000 });
          await page.waitForTimeout(5000);
          
          // Handle location permission if needed
          try {
            await page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button, div[role="button"], span[role="button"]'));
              for (const btn of buttons) {
                const text = btn.textContent?.toLowerCase() || '';
                if (text.includes('allow') || text.includes('detect') || text.includes('enable location')) {
                  btn.click();
                  break;
                }
              }
            });
            await page.waitForTimeout(3000);
          } catch (e) {
            console.log(`🟣 Zepto: Location permission handling failed`);
          }
          
          // Force navigate to search URL and wait for it to properly load
          console.log(`🟣 Zepto: Forcing navigation to search URL...`);
          const searchUrl = `https://www.zeptonow.com/search?query=${encodeURIComponent(query)}`;
          
          // Clear any existing content and navigate fresh
          await page.evaluate(() => {
            document.body.innerHTML = '';
          });
          
          await page.goto(searchUrl, { 
            waitUntil: ['networkidle0'],
            timeout: 20000 
          });
          
          console.log(`🟣 Zepto: Forced navigation to: ${searchUrl}`);
          
          // Wait longer for React to render with search results
          await page.waitForTimeout(10000);
          
          // Try to find and use search input as additional verification
          try {
            const searchInputSelectors = [
              'input[placeholder*="search" i]',
              'input[type="search"]',
              'input[name*="search" i]',
              'input[aria-label*="search" i]',
              '[data-testid*="search" i] input'
            ];
            
            for (const selector of searchInputSelectors) {
              const searchInput = await page.$(selector);
              if (searchInput) {
                console.log(`🟣 Zepto: Found search input, re-entering query...`);
                await searchInput.click();
                await searchInput.clear();
                await searchInput.type(query);
                await page.keyboard.press('Enter');
                await page.waitForTimeout(8000);
                break;
              }
            }
          } catch (e) {
            console.log(`🟣 Zepto: Search input approach failed: ${e.message}`);
          }
          
        } catch (e) {
          console.log(`🟣 Zepto: Search input approach failed: ${e.message}`);
        }
      }
      
      // Final scroll to ensure all content is loaded
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await page.waitForTimeout(3000);
      
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
            for (let i = 0; i < Math.min(containers.length, 50); i++) { // Extract more from structured selectors
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
        
        // Zepto-specific smart extraction based on visible structure
        console.log('🟣 Zepto: Starting Zepto-specific product extraction');
        
        // Strategy 1: Look for elements with specific price patterns like "₹34", "₹25", etc.
        const pricePatterns = [/₹(\d+)/g];
        const allText = document.body.textContent || '';
        const foundPrices = [];
        
        pricePatterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(allText)) !== null) {
            const price = parseInt(match[1]);
            if (price > 5 && price < 2000) {
              foundPrices.push({ price, index: match.index });
            }
          }
        });
        
        console.log(`🟣 Zepto: Found ${foundPrices.length} price mentions in text`);
        
        // Strategy 2: Look for product cards that contain both text and prices
        const productCards = Array.from(document.querySelectorAll('div, article, section')).filter(el => {
          const text = el.textContent || '';
          const hasPrice = /₹\d+/.test(text);
          
          // Make product detection more flexible - look for food/grocery related terms or the search query itself
          const hasProductName = /(amul|heritage|hatsun|nestle|mother dairy|curd|milk|potato|chips|baby|wellfare|hungritos|too yumm|pringles|bingo|uncle|lays|haldirams|namkeen|popcorn|snacks)/i.test(text) ||
                                 text.toLowerCase().includes('g ') || // Weight indicators like "500 g", "100 g"
                                 text.toLowerCase().includes('ml ') || // Volume indicators  
                                 /\d+\s*g\b/i.test(text) || // Pattern like "500g", "100g"
                                 /\d+\s*ml\b/i.test(text); // Pattern like "500ml", "200ml"
          
          const isReasonableSize = text.length > 10 && text.length < 500;
          const hasAddButton = text.toLowerCase().includes('add'); // Products usually have ADD button
          
          return hasPrice && hasProductName && isReasonableSize && hasAddButton;
        });
        
        console.log(`🟣 Zepto: Found ${productCards.length} potential product cards`);
        
        // Extract from product cards
        productCards.slice(0, 50).forEach(card => {
          try {
            const cardText = card.textContent.trim();
            // Look for price patterns, prioritizing realistic prices
            const priceMatches = cardText.match(/₹(\d+)/g);
            
            if (priceMatches && priceMatches.length > 0) {
              // Convert to numbers and find the most reasonable price (usually smallest or most common range)
              const prices = priceMatches.map(m => parseInt(m.replace('₹', ''))).filter(p => p > 5 && p < 2000);
              
              if (prices.length === 0) return;
              
              // If multiple prices, pick the most reasonable one (usually the smallest realistic price)
              const price = prices.sort((a, b) => a - b)[0];
              
              // Now we have the best price, extract product name
              // Try to extract product name from the card text
              let productName = null;
            
            // Look for brand names followed by product details - expanded for all grocery items
            const brandPatterns = [
              /Amul\s+[^₹\n]+/i,
              /Heritage\s+[^₹\n]+/i,
              /Hatsun\s+[^₹\n]+/i,
              /Nestle\s+[^₹\n]+/i,
              /Mother\s+Dairy\s+[^₹\n]+/i,
              /Baby\s+Potato[^₹\n]*/i,
              /^Baby\s*Potato$/i, // Exact "Baby Potato" match
              /Wellfare\s+[^₹\n]+/i,
              /Hungritos\s+[^₹\n]+/i,
              /Too\s+Yumm[^₹\n]*/i,
              /Pringles\s+[^₹\n]+/i,
              /Lays?\s+[^₹\n]+/i,
              /Uncle\s+Chipps[^₹\n]*/i,
              /Bingo\s+[^₹\n]+/i,
              /Haldirams?\s+[^₹\n]+/i,
              /BBB\s+[^₹\n]+/i,
              /VS\s+Mani[^₹\n]*/i,
              /[A-Z][a-z]+\s+Potato[^₹\n]*/i, // Generic "Brand Potato" pattern
              /[A-Z][a-z]+\s+Chips[^₹\n]*/i   // Generic "Brand Chips" pattern
            ];
            
            for (const pattern of brandPatterns) {
              const nameMatch = cardText.match(pattern);
              if (nameMatch) {
                productName = nameMatch[0].trim();
                // Clean up the name more thoroughly
                productName = productName
                  .replace(/\s+/g, ' ')
                  .replace(/₹.*/, '') // Remove price and everything after
                  .replace(/\d+\.\d+\([^)]*\)/g, '') // Remove ratings like "4.8(14.0k)"
                  .replace(/\d+\s*g\s*$/i, '') // Remove weight at end
                  .replace(/\d+\s*ml\s*$/i, '') // Remove volume at end
                  .replace(/ADD$/i, '') // Remove ADD button
                  .replace(/Premium$/i, '') // Remove Premium tag
                  .replace(/Sold\s*out$/i, '') // Remove Sold out
                  .replace(/Notify$/i, '') // Remove Notify
                  .replace(/\s+/g, ' ') // Clean up multiple spaces
                  .trim();
                
                if (productName.length > 5) {
                  break;
                }
              }
            }
            
            // Fallback: extract text before price as product name
            if (!productName) {
              const beforePrice = cardText.split('₹')[0];
              const lines = beforePrice.split(/\n/).filter(line => {
                const trimmed = line.trim();
                return trimmed.length > 3 && 
                       !trimmed.toLowerCase().includes('sold out') &&
                       !trimmed.toLowerCase().includes('notify') &&
                       !trimmed.toLowerCase().includes('save ₹') &&
                       !trimmed.toLowerCase().includes('add') &&
                       !/^\d+\s*[gml]\s*$/.test(trimmed) && // Skip pure weight/volume lines
                       !/^\d+\.\d+\s*\(\d+/.test(trimmed); // Skip rating lines like "4.2 (164)"
              });
              
              // Try to find the most descriptive line (usually longest meaningful text)
              if (lines.length > 0) {
                // First try to find lines that contain "potato" specifically
                const potatoLines = lines.filter(line => 
                  line.toLowerCase().includes('potato') && line.trim().length > 3
                );
                
                if (potatoLines.length > 0) {
                  // Pick the shortest potato line (usually the cleanest product name)
                  productName = potatoLines.sort((a, b) => a.length - b.length)[0]?.trim();
                } else {
                  // Sort by length and pick the longest meaningful line that likely contains product name
                  const sortedLines = lines
                    .filter(line => line.trim().length > 5)
                    .sort((a, b) => b.length - a.length);
                  
                  productName = sortedLines[0]?.trim();
                }
              }
            }
            
            // Validate product name
            if (productName && 
                productName.length > 3 && 
                productName.length < 100 &&
                !results.some(r => r.name === productName)) {
              
              console.log(`🟣 Zepto: Extracted from card: "${productName}" at ₹${price}`);
              
              results.push({
                name: productName,
                price: price,
                originalPrice: null,
                url: window.location.href,
                image: null,
                inStock: !cardText.toLowerCase().includes('sold out'),
                deliveryFee: 'Free',
                deliveryTime: '10-15 mins',
                category: 'General'
              });
            }
            }
          } catch (error) {
            console.log('🟣 Zepto: Error extracting from card:', error);
          }
        });
        
        // Strategy 3: Fallback aggressive text parsing if we still don't have enough
        if (results.length < 5) {
          console.log('🟣 Zepto: Using fallback text parsing');
          
          // Parse structured patterns from visible text
          const textPatterns = [
            /Amul\s+[^₹\n]+₹(\d+)/gi,
            /Heritage\s+[^₹\n]+₹(\d+)/gi,
            /(\w+\s+)*Curd[^₹\n]*₹(\d+)/gi,
            /(\w+\s+)*Milk[^₹\n]*₹(\d+)/gi
          ];
          
          textPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(allText)) !== null && results.length < 50) {
              try {
                const fullMatch = match[0];
                const priceGroup = match[match.length - 1]; // Last capturing group is price
                const price = parseInt(priceGroup);
                
                if (price > 5 && price < 2000) {
                  const productName = fullMatch.replace(/₹\d+/, '').trim();
                  
                  if (productName.length > 5 && 
                      !results.some(r => r.name === productName)) {
                    
                    console.log(`🟣 Zepto: Pattern match: "${productName}" at ₹${price}`);
                    
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
              } catch (error) {
                console.log('🟣 Zepto: Error in pattern matching:', error);
              }
            }
          });
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
    
    // Detect if this is a brand search and adjust strictness accordingly
    const primaryTerm = queryTerms[0];
    const secondaryTerms = queryTerms.slice(1);
    
    // List of known brands - if primary term is a brand, be strict about matching
    const knownBrands = ['amul', 'hatsun', 'mother', 'dairy', 'nestle', 'heritage', 'country', 'delight', 'id', 'epigamia', 'frubon'];
    const isBrandSearch = knownBrands.some(brand => primaryTerm.includes(brand) || brand.includes(primaryTerm));
    
    console.log(`🟣 Zepto: Primary term: "${primaryTerm}" (Brand search: ${isBrandSearch})`);
    console.log(`🟣 Zepto: Secondary terms: [${secondaryTerms.join(', ')}]`);
    
    // Calculate relevancy score for each product
    const scoredProducts = products.map(product => {
      const productName = product.name.toLowerCase();
      let score = 0;
      let hasAnyMatch = false;
      
      // Check primary term match (HIGH PRIORITY but not REQUIRED)
      if (productName.includes(primaryTerm)) {
        score += 10; // High score for primary term
        hasAnyMatch = true;
        console.log(`🟣 Zepto: "${product.name}" matches primary "${primaryTerm}" (+10 points)`);
      }
      
      // Secondary term matching (can also provide relevancy)
      secondaryTerms.forEach(term => {
        if (productName.includes(term)) {
          score += 5; // Increased secondary term value
          hasAnyMatch = true;
          console.log(`🟣 Zepto: "${product.name}" matches secondary "${term}" (+5 points)`);
        }
      });
      
      // Exact phrase matching (bonus)
      if (productName.includes(query.toLowerCase())) {
        score += 8;
        hasAnyMatch = true;
        console.log(`🟣 Zepto: "${product.name}" matches full phrase (+8 points)`);
      }
      
      // Category relevancy - give points for dairy/food related terms even if brand doesn't match
      const categoryTerms = ['curd', 'milk', 'dairy', 'cheese', 'butter', 'yogurt', 'cream'];
      categoryTerms.forEach(term => {
        if (productName.includes(term)) {
          score += 2;
          hasAnyMatch = true;
          console.log(`🟣 Zepto: "${product.name}" matches category "${term}" (+2 points)`);
        }
      });
      
      // Apply different rejection criteria based on search type
      if (isBrandSearch) {
        // For brand searches, REQUIRE primary term match
        if (!productName.includes(primaryTerm)) {
          console.log(`🟣 Zepto: "${product.name}" REJECTED - brand search requires "${primaryTerm}" match`);
          return {
            ...product,
            relevancyScore: 0
          };
        }
      } else {
        // For generic searches, allow products with any relevant matches
        if (!hasAnyMatch) {
          console.log(`🟣 Zepto: "${product.name}" REJECTED - no relevant terms match`);
          return {
            ...product,
            relevancyScore: 0
          };
        }
      }
      
      return {
        ...product,
        relevancyScore: score
      };
    });
    
    // Filter products that have some relevancy and sort by score
    const relevantProducts = scoredProducts
      .filter(product => product.relevancyScore > 0)
      .sort((a, b) => b.relevancyScore - a.relevancyScore)
      .slice(0, 10); // Increased from 5 to 10 to show more results
    
    console.log(`🟣 Zepto: Filtered to ${relevantProducts.length} relevant products from ${products.length} total`);
    
    // If still no relevant products, show a sample of what was found
    if (relevantProducts.length === 0) {
      console.log(`🟣 Zepto: No relevant products found. Sample of extracted products:`);
      products.slice(0, 5).forEach(p => {
        console.log(`🟣 Zepto: Sample: "${p.name}" at ₹${p.price}`);
      });
    }
    
    return relevantProducts;
  }
}

module.exports = new RealZeptoScraper();