const puppeteer = require('puppeteer');

class RealBlinkitScraper {
  constructor() {
    this.baseUrl = 'https://blinkit.com';
  }

  async searchProducts(query, maxResults = 2) {
    let browser;
    
    try {
      console.log(`🟡 Blinkit: Real scraping for "${query}"`);
      
      browser = await puppeteer.launch({
        headless: "new", // Use new headless mode to avoid warnings
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
      
      // Set location to Bangalore (where Blinkit operates) - Chennai not serviceable by Blinkit
      await page.setGeolocation({ latitude: 12.9716, longitude: 77.5946 });
      console.log(`🟡 Blinkit: Location set to Bangalore (Blinkit serviceable area)`);
      
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
      
      // Try direct search URL with potential location parameters
      const searchUrl = `https://blinkit.com/s/?q=${encodeURIComponent(query)}`;
      console.log(`🟡 Blinkit: Loading ${searchUrl}`);
      
      await page.goto(searchUrl, { 
        waitUntil: ['domcontentloaded', 'networkidle0'],
        timeout: 20000 
      });
      
      console.log(`🟡 Blinkit: Page loaded, checking for location prompt...`);
      
      // Check if location selection is needed
      const needsLocation = await page.evaluate(() => {
        const bodyText = document.body.textContent || '';
        const needsLoc = bodyText.includes('provide your delivery location') || 
                        bodyText.includes('Detect my location') ||
                        bodyText.includes('Welcome to blinkit');
        
        console.log(`Location check - Body includes location prompt: ${needsLoc}`);
        console.log(`Body text sample: "${bodyText.substring(0, 200)}"`);
        return needsLoc;
      });
      
      if (needsLocation) {
        console.log(`🟡 Blinkit: Location selection needed, trying to set location...`);
        
        try {
          // First, try to find a location input field and manually enter Koramangala
          const manualLocationSet = await page.evaluate(() => {
            console.log('Searching for location input fields...');
            
            // Try different input selectors
            const selectors = [
              'input[type="text"]',
              'input[placeholder*="location" i]',
              'input[placeholder*="address" i]', 
              'input[placeholder*="area" i]',
              'input[placeholder*="pincode" i]',
              'input[placeholder*="search" i]',
              'input[name*="location" i]',
              'input[id*="location" i]',
              'input'
            ];
            
            for (const selector of selectors) {
              const inputs = Array.from(document.querySelectorAll(selector));
              console.log(`Found ${inputs.length} inputs with selector: ${selector}`);
              
              for (const input of inputs) {
                const placeholder = input.placeholder?.toLowerCase() || '';
                const name = input.name?.toLowerCase() || '';
                const id = input.id?.toLowerCase() || '';
                
                console.log(`Input details - placeholder: "${placeholder}", name: "${name}", id: "${id}"`);
                
                if (placeholder.includes('location') || placeholder.includes('address') || 
                    placeholder.includes('area') || placeholder.includes('pin') ||
                    placeholder.includes('search delivery') || name.includes('location') ||
                    id.includes('location')) {
                  
                  console.log(`Found suitable location input: "${placeholder || name || id}"`);
                  input.focus();
                  input.value = '';
                  input.value = 'Koramangala, Bangalore';
                  
                  // Try multiple event types
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                  
                  console.log(`Set input value to: "${input.value}"`);
                  return true;
                }
              }
            }
            
            console.log('No suitable location input found');
            return false;
          });
          
          if (manualLocationSet) {
            console.log(`🟡 Blinkit: Manually entered Bangalore location`);
            await page.waitForTimeout(3000);
            
            // Try alternative typing approach for React inputs
            await page.evaluate(() => {
              const inputs = Array.from(document.querySelectorAll('input'));
              for (const input of inputs) {
                if (input.value === 'Koramangala, Bangalore') {
                  console.log('Found our input, trying alternative typing...');
                  input.focus();
                  input.select();
                  return true;
                }
              }
              return false;
            });
            
            // Type character by character (works better with React)
            await page.type('input', 'Koramangala, Bangalore', { delay: 100 });
            await page.waitForTimeout(2000); // Wait for dropdown to appear
            
            // Try to click on the first dropdown option with better selectors
            const dropdownClicked = await page.evaluate(() => {
              // More comprehensive search for dropdown options
              const dropdownSelectors = [
                'div[role="option"]',
                'li[role="option"]',
                '[data-testid*="option"]',
                '[class*="dropdown"] div',
                '[class*="suggestion"] div',
                '[class*="option"]',
                'div[tabindex="0"]',
                'div[tabindex="-1"]',
                // Look for clickable elements with location-like text
                'div',
                'span',
                'li'
              ];
              
              console.log('Searching for location dropdown options...');
              
              for (const selector of dropdownSelectors) {
                const elements = Array.from(document.querySelectorAll(selector));
                console.log(`Checking ${elements.length} elements with selector: ${selector}`);
                
                for (const element of elements) {
                  const text = element.textContent?.toLowerCase() || '';
                  const isClickable = element.onclick || element.getAttribute('role') === 'option' || 
                                    element.tabIndex >= 0 || element.getAttribute('data-testid');
                  
                  // Look for Bangalore/Koramangala-related options
                  if ((text.includes('koramangala') || text.includes('bangalore') || 
                       text.includes('8th block') || text.includes('bengaluru')) && 
                      text.length > 10 && text.length < 200) {
                    
                    console.log(`Found potential Bangalore option: "${text.substring(0, 80)}..."`);
                    console.log(`Element info - clickable: ${isClickable}, tag: ${element.tagName}`);
                    
                    // Try to click it
                    try {
                      element.scrollIntoView();
                      element.click();
                      console.log(`Successfully clicked: "${text.substring(0, 50)}..."`);
                      return true;
                    } catch (e) {
                      console.log(`Click failed on: "${text.substring(0, 50)}..."`);
                    }
                  }
                }
              }
              
              console.log('No Chennai options found, trying any visible dropdown option...');
              
              // Fallback: click any visible dropdown-like option
              const allOptions = Array.from(document.querySelectorAll('div[role="option"], li, [class*="dropdown"] div, [class*="suggestion"] div'));
              for (const option of allOptions) {
                const text = option.textContent?.trim() || '';
                if (text.length > 5 && text.length < 100) {
                  console.log(`Fallback clicking: "${text.substring(0, 50)}..."`);
                  try {
                    option.click();
                    return true;
                  } catch (e) {
                    console.log(`Fallback click failed`);
                  }
                }
              }
              
              return false;
            });
            
            if (dropdownClicked) {
              console.log(`🟡 Blinkit: Clicked dropdown option, waiting for location to be set...`);
              await page.waitForTimeout(4000);
            } else {
              console.log(`🟡 Blinkit: No dropdown options found, trying multiple approaches...`);
              
              // Try Enter key
              await page.keyboard.press('Enter');
              await page.waitForTimeout(2000);
              
              // Try Tab and Enter
              await page.keyboard.press('Tab');
              await page.keyboard.press('Enter');
              await page.waitForTimeout(2000);
              
              // Try clicking the first visible location suggestion directly
              await page.evaluate(() => {
                // Look for any clickable location elements
                const locationElements = Array.from(document.querySelectorAll('*')).filter(el => {
                  const text = el.textContent?.toLowerCase() || '';
                  return (text.includes('chennai') || text.includes('airport')) && 
                         text.length > 15 && text.length < 150;
                });
                
                if (locationElements.length > 0) {
                  console.log(`Trying direct click on: "${locationElements[0].textContent?.substring(0, 50)}..."`);
                  locationElements[0].click();
                  return true;
                }
                return false;
              });
              
              await page.waitForTimeout(2000);
            }
            
            // Try to click a submit or search button with more options
            await page.evaluate(() => {
              const buttonSelectors = ['button', 'div[role="button"]', '[role="button"]', 'a[role="button"]', '.button', '[class*="button"]'];
              
              for (const selector of buttonSelectors) {
                const buttons = Array.from(document.querySelectorAll(selector));
                for (const btn of buttons) {
                  const text = btn.textContent?.toLowerCase() || '';
                  const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
                  
                  if (text.includes('confirm') || text.includes('submit') || text.includes('search') || 
                      text.includes('go') || text.includes('save') || text.includes('set') ||
                      ariaLabel.includes('confirm') || ariaLabel.includes('search')) {
                    console.log(`Clicking button: "${text || ariaLabel}"`);
                    btn.click();
                    return true;
                  }
                }
              }
              return false;
            });
            await page.waitForTimeout(4000);
          } else {
            // Fallback: Try clicking "Detect my location" button
            const buttonClicked = await page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button, div[role="button"], div[class*="button"], span[class*="button"]'));
              for (const btn of buttons) {
                const text = btn.textContent?.toLowerCase() || '';
                if (text.includes('detect my location') || text.includes('detect location') || 
                    text.includes('current location') || text.includes('use current')) {
                  console.log(`Found location button: "${text}"`);
                  btn.click();
                  return true;
                }
              }
              return false;
            });
            
            if (buttonClicked) {
              console.log(`🟡 Blinkit: Clicked location detection button`);
              await page.waitForTimeout(6000); // Wait longer for location detection
            } else {
              console.log(`🟡 Blinkit: No location button found, trying alternative approach...`);
              
              // Alternative: Try to find and click any clickable element related to location
              await page.evaluate(() => {
                const allElements = Array.from(document.querySelectorAll('*'));
                for (const el of allElements) {
                  const text = el.textContent?.toLowerCase() || '';
                  if ((text.includes('detect') && text.includes('location')) || 
                      text === 'detect my location') {
                    el.click();
                    return;
                  }
                }
              });
              await page.waitForTimeout(3000);
            }
          }
          
          // Check if location was set successfully and try to dismiss popup
          await page.waitForTimeout(2000);
          
          const stillNeedsLocation = await page.evaluate(() => {
            const hasLocationPopup = document.body.textContent?.includes('provide your delivery location');
            const hasWelcomePopup = document.body.textContent?.includes('Welcome to blinkit');
            return hasLocationPopup || hasWelcomePopup;
          });
          
          if (stillNeedsLocation) {
            console.log(`🟡 Blinkit: Location popup still visible, trying forceful dismissal...`);
            
            // Try to forcefully dismiss the popup by clicking outside or finding close buttons
            await page.evaluate(() => {
              // Look for close buttons, X buttons, or overlay dismissal
              const closeButtons = Array.from(document.querySelectorAll('button, div, span')).filter(el => {
                const text = el.textContent?.toLowerCase() || '';
                const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
                return text === '×' || text === 'x' || text.includes('close') || 
                       ariaLabel.includes('close') || el.classList.contains('close');
              });
              
              if (closeButtons.length > 0) {
                console.log(`Found close button, clicking...`);
                closeButtons[0].click();
                return true;
              }
              
              // Try clicking on any detected location from the dropdown that's visible
              const visibleLocations = Array.from(document.querySelectorAll('*')).filter(el => {
                const text = el.textContent?.toLowerCase() || '';
                const rect = el.getBoundingClientRect();
                return (text.includes('koramangala') || text.includes('bangalore') || text.includes('8th block')) && 
                       rect.width > 0 && rect.height > 0 && 
                       text.length > 20 && text.length < 200;
              });
              
              if (visibleLocations.length > 0) {
                console.log(`Clicking visible Bangalore location: "${visibleLocations[0].textContent?.substring(0, 60)}..."`);
                visibleLocations[0].click();
                return true;
              }
              
              // Last resort: try clicking anywhere on the right side to dismiss popup
              const bodyRect = document.body.getBoundingClientRect();
              document.elementFromPoint(bodyRect.width * 0.7, bodyRect.height * 0.5)?.click();
              
              return false;
            });
            
            await page.waitForTimeout(3000);
            
            // Final check after dismissal attempts
            const finalLocationCheck = await page.evaluate(() => {
              return document.body.textContent?.includes('provide your delivery location');
            });
            
            if (finalLocationCheck) {
              console.log(`🟡 Blinkit: Location popup still present after all attempts, proceeding with extraction...`);
            } else {
              console.log(`🟡 Blinkit: Location popup successfully dismissed!`);
            }
          } else {
            console.log(`🟡 Blinkit: Location successfully set!`);
            
            // Double verification - check if we can see location-specific content
            await page.waitForTimeout(3000);
            const hasLocationContent = await page.evaluate(() => {
              const text = document.body.textContent || '';
              return text.includes('mins') && text.includes('₹') && text.length > 5000;
            });
            
            if (hasLocationContent) {
              console.log(`🟡 Blinkit: Location verification passed - seeing location-specific products`);
            } else {
              console.log(`🟡 Blinkit: WARNING - Not seeing expected location-specific content`);
            }
          }
          
        } catch (error) {
          console.log(`🟡 Blinkit: Error setting location: ${error.message}`);
          
          // Ultimate fallback: Try homepage approach
          console.log(`🟡 Blinkit: Trying homepage location setting approach...`);
          try {
            await page.goto('https://blinkit.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(3000);
            
            // Try location setting on homepage
            const homepageLocationSet = await page.evaluate(() => {
              const inputs = Array.from(document.querySelectorAll('input'));
              for (const input of inputs) {
                const placeholder = input.placeholder?.toLowerCase() || '';
                if (placeholder.includes('location') || placeholder.includes('search') || placeholder.includes('area')) {
                  input.value = 'Koramangala, Bangalore';
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  return true;
                }
              }
              return false;
            });
            
            if (homepageLocationSet) {
              console.log(`🟡 Blinkit: Set location on homepage, now navigating to search...`);
              await page.waitForTimeout(2000);
              await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            }
          } catch (homepageError) {
            console.log(`🟡 Blinkit: Homepage approach also failed: ${homepageError.message}`);
          }
        }
      } else {
        console.log(`🟡 Blinkit: Location already set or not required`);
      }
      
      // Wait for actual content to load after location handling
      console.log(`🟡 Blinkit: Waiting for product content to render...`);
      
      try {
        // Wait for products or content to appear
        await page.waitForSelector('[class*="product"], [data-testid*="product"], [class*="item"], .product', { 
          timeout: 15000 
        });
        console.log(`🟡 Blinkit: Product content found!`);
      } catch (error) {
        console.log(`🟡 Blinkit: Timeout waiting for products, proceeding anyway...`);
      }
      
      // Additional wait and scroll for dynamic content
      await page.waitForTimeout(3000);
      
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await page.waitForTimeout(2000);
      
      // Debug: Take screenshot for debugging
      await page.screenshot({ path: 'blinkit_debug.png', fullPage: false });
      console.log(`🟡 Blinkit: Debug screenshot saved as blinkit_debug.png`);
      
      // Debug: Check page title and basic content
      const title = await page.title();
      const bodyText = await page.evaluate(() => document.body.textContent?.substring(0, 200));
      console.log(`🟡 Blinkit: Page title: "${title}"`);
      console.log(`🟡 Blinkit: Body text sample: "${bodyText}"`);
      
      // Debug: Count potential product containers
      const containerCounts = await page.evaluate(() => {
        const selectors = [
          'div[data-testid="plp-product"]',
          '.Product__UpdatedC', 
          '[class*="ProductPack"]',
          '[class*="product"]',
          'div[class*="item"]'
        ];
        
        const counts = {};
        selectors.forEach(selector => {
          counts[selector] = document.querySelectorAll(selector).length;
        });
        
        return counts;
      });
      
      console.log(`🟡 Blinkit: Container counts:`, containerCounts);
      
      // First check what we have on page before extraction
      const debugInfo = await page.evaluate(() => {
        const selectorCounts = {
          'div[data-testid="plp-product"]': document.querySelectorAll('div[data-testid="plp-product"]').length,
          '.Product__UpdatedC': document.querySelectorAll('.Product__UpdatedC').length,
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
      
      console.log(`🟡 Blinkit: Page analysis:`, debugInfo);
      
      const products = await page.evaluate((maxResults) => {
        const results = [];
        
        // Blinkit-specific selectors - updated based on actual DOM structure
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
          // Try to find products by looking for price patterns and nearby text
          {
            container: 'div',
            name: '*',
            price: '*',
            image: 'img',
            strategy: 'price_search'
          }
        ];
        
        // Skip traditional selector strategies for Blinkit - they don't work
        console.log(`🟡 Blinkit: Skipping traditional selectors, using text parsing instead`);
        
        // Parse the massive text to extract individual products
        console.log('🟡 Blinkit: Starting text parsing for individual products');
        
        // Get the body text that contains all the product info
        const bodyText = document.body.textContent || '';
        
        // Look for multiple patterns that might contain products
        const patterns = [
          /(\d+\s*mins[^₹]*?)₹(\d+)[^₹]*?ADD/g,  // Original pattern
          /(Hatsun[^₹]*?)₹(\d+)/g,              // Hatsun specific pattern
          /([A-Za-z][^₹]*?)₹(\d+)(?:\s*ADD)?/g   // General pattern
        ];
        
        console.log(`🟡 Blinkit: Body text length: ${bodyText.length}`);
        console.log(`🟡 Blinkit: Sample text: "${bodyText.substring(0, 500)}"`);
        
        let allMatches = [];
        patterns.forEach((pattern, index) => {
          const matches = bodyText.match(pattern);
          if (matches) {
            console.log(`🟡 Blinkit: Pattern ${index + 1} found ${matches.length} matches`);
            allMatches.push(...matches);
          }
        });
        
        console.log(`🟡 Blinkit: Total matches from all patterns: ${allMatches.length}`);
        
        // Process each pattern to extract products
        patterns.forEach((pattern, patternIndex) => {
          let match;
          pattern.lastIndex = 0; // Reset regex state
          
          while ((match = pattern.exec(bodyText)) !== null && results.length < 5) {
            try {
              const fullMatch = match[0];
              const productPart = match[1];
              const price = parseFloat(match[2]);
              
              console.log(`🟡 Blinkit: Pattern ${patternIndex + 1} found match: "${fullMatch.substring(0, 100)}..."`);
              
              if (price < 5 || price > 1000) continue;
              
              // Clean up product name based on pattern type
              let productName = productPart;
              
              if (patternIndex === 0) {
                // Original pattern - remove "mins" prefix
                productName = productPart
                  .replace(/^\d+\s*mins\s*/i, '')
                  .replace(/\s+/g, ' ')
                  .trim();
              } else if (patternIndex === 1) {
                // Hatsun pattern - keep as is but clean
                productName = productPart.replace(/\s+/g, ' ').trim();
              } else {
                // General pattern - basic cleanup
                productName = productPart
                  .replace(/^\d+\s*mins\s*/i, '') // Remove mins if present
                  .replace(/\s+/g, ' ')
                  .trim();
              }
              
              // Further clean product name
              const cleanName = productName
                .replace(/^(add|buy|cart)/i, '') // Remove action words
                .replace(/\d+%?\s*off/gi, '') // Remove discount text
                .trim();
              
              // Validate product name
              const isValidProduct = cleanName && 
                cleanName.length > 5 && 
                cleanName.length < 100 &&
                !cleanName.toLowerCase().includes('showing results') &&
                !cleanName.toLowerCase().includes('search results') &&
                !cleanName.toLowerCase().includes('no results for') &&
                !cleanName.toLowerCase().includes('welcome to') &&
                !cleanName.toLowerCase().includes('detect my location') &&
                !cleanName.toLowerCase().includes('provide your delivery') &&
                !results.some(r => r.name === cleanName);
              
              if (isValidProduct) {
                console.log(`🟡 Blinkit: Valid product found (Pattern ${patternIndex + 1}): "${cleanName}" at ₹${price}`);
                
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
              } else {
                console.log(`🟡 Blinkit: Invalid product rejected (Pattern ${patternIndex + 1}): "${cleanName}"`);
              }
            } catch (error) {
              console.log(`🟡 Blinkit: Error parsing product (Pattern ${patternIndex + 1}):`, error);
            }
          }
        });
        
        console.log(`🟡 Blinkit: Text parsing found ${results.length} products total`);
        
        return results;
      }, maxResults);
      
      console.log(`🟡 Blinkit: Extracted ${products.length} products before relevancy filtering`);
      
      // Apply relevancy algorithm - prioritize products that match search terms
      const relevantProducts = this.filterByRelevancy(products, query);
      
      // Log each relevant product found
      relevantProducts.forEach((product, index) => {
        console.log(`🟡 Blinkit: Product ${index + 1}: "${product.name}" - ₹${product.price} (Relevancy: ${product.relevancyScore})`);
      });
      
      return relevantProducts;
      
    } catch (error) {
      console.error(`🟡 Blinkit scraping error: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  filterByRelevancy(products, query) {
    const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    console.log(`🟡 Blinkit: Query terms for relevancy: [${queryTerms.join(', ')}]`);
    
    // If no specific query terms, return all products
    if (queryTerms.length === 0) {
      console.log(`🟡 Blinkit: No specific query terms, returning all ${products.length} products`);
      return products.slice(0, 5);
    }
    
    // Identify the primary term and detect if it's a brand search
    const primaryTerm = queryTerms[0];
    const secondaryTerms = queryTerms.slice(1);
    
    // List of known brands - if primary term is a brand, be strict about matching
    const knownBrands = ['amul', 'hatsun', 'mother', 'dairy', 'nestle', 'heritage', 'country', 'delight', 'id', 'epigamia', 'frubon'];
    const isBrandSearch = knownBrands.some(brand => primaryTerm.includes(brand) || brand.includes(primaryTerm));
    
    console.log(`🟡 Blinkit: Primary term: "${primaryTerm}" (Brand search: ${isBrandSearch})`);
    console.log(`🟡 Blinkit: Secondary terms: [${secondaryTerms.join(', ')}]`);
    
    // Calculate relevancy score for each product
    const scoredProducts = products.map(product => {
      const productName = product.name.toLowerCase();
      let score = 0;
      let matchesPrimary = false;
      
      // Check primary term match (REQUIRED for brand searches, highly weighted for others)
      if (productName.includes(primaryTerm)) {
        score += 20; // Higher score for primary term
        matchesPrimary = true;
        console.log(`🟡 Blinkit: "${product.name}" matches primary "${primaryTerm}" (+20 points)`);
      }
      
      // Allow products without primary term if they have good secondary matches
      let hasSecondaryMatches = false;
      
      // Secondary term matching (important for multi-word searches)
      secondaryTerms.forEach(term => {
        if (productName.includes(term)) {
          score += 15; // Much higher weight for secondary terms
          hasSecondaryMatches = true;
          console.log(`🟡 Blinkit: "${product.name}" matches secondary "${term}" (+15 points)`);
        }
      });
      
      // Category relevancy - give points for common grocery categories
      const categoryTerms = ['curd', 'milk', 'dairy', 'cheese', 'butter', 'yogurt', 'cream', 'dahi'];
      categoryTerms.forEach(term => {
        if (productName.includes(term)) {
          score += 2;
          hasSecondaryMatches = true;
          console.log(`🟡 Blinkit: "${product.name}" matches category "${term}" (+2 points)`);
        }
      });
      
      // For brand searches, don't reject alternatives completely - user might want to see what's available
      if (!matchesPrimary && !hasSecondaryMatches) {
        console.log(`🟡 Blinkit: "${product.name}" REJECTED - no relevant terms match`);
        return {
          ...product,
          relevancyScore: 0
        };
      }
      
      // For brand searches without exact match, note as alternative
      if (isBrandSearch && !matchesPrimary && hasSecondaryMatches) {
        console.log(`🟡 Blinkit: "${product.name}" - no exact brand match but has secondary matches (score: ${score})`);
      }
      
      // Exact phrase matching (bonus)
      if (productName.includes(query.toLowerCase())) {
        score += 5;
        console.log(`🟡 Blinkit: "${product.name}" matches full phrase (+5 points)`);
      }
      
      return {
        ...product,
        relevancyScore: score
      };
    });
    
    // Filter products and apply fallback strategy
    let relevantProducts = scoredProducts
      .filter(product => product.relevancyScore > 0)
      .sort((a, b) => b.relevancyScore - a.relevancyScore)
      .slice(0, 2);
    
    // Fallback: if no products found for brand search, show top products with secondary matches
    if (relevantProducts.length === 0 && isBrandSearch) {
      console.log(`🟡 Blinkit: No exact brand matches for "${primaryTerm}", showing alternatives with "${secondaryTerms.join(', ')}"`);
      relevantProducts = scoredProducts
        .filter(product => product.relevancyScore >= 10) // Lower threshold for alternatives
        .sort((a, b) => b.relevancyScore - a.relevancyScore)
        .slice(0, 2);
      
      console.log(`🟡 Blinkit: Fallback found ${relevantProducts.length} alternative products`);
    }
    
    console.log(`🟡 Blinkit: Filtered to ${relevantProducts.length} relevant products from ${products.length} total`);
    
    // Show sample of found products if no relevant matches
    if (relevantProducts.length === 0) {
      console.log(`🟡 Blinkit: No relevant products found. Sample of extracted products:`);
      products.slice(0, 5).forEach(p => {
        console.log(`🟡 Blinkit: Sample: "${p.name}" at ₹${p.price}`);
      });
    }
    
    return relevantProducts;
  }
}

module.exports = new RealBlinkitScraper();