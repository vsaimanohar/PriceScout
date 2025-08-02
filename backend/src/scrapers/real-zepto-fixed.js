// Fixed Zepto scraper that handles React loading properly
const puppeteer = require('puppeteer');

class RealZeptoScraper {
  constructor() {
    this.baseUrl = 'https://www.zeptonow.com';
    this.searchUrl = 'https://www.zeptonow.com/search';
  }

  async searchProducts(query, maxResults = 5) {
    let browser;
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      try {
        console.log(`🟣 Zepto: Real scraping for "${query}" (attempt ${retryCount + 1}/${maxRetries + 1})`);
        
        browser = await puppeteer.launch({
          headless: "new",
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-images',
            '--disable-plugins',
            '--disable-extensions',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-default-apps',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ],
          timeout: 20000
        });
        
        const page = await browser.newPage();
        
        // Set longer timeout for complex extraction
        page.setDefaultTimeout(60000);
        
        // Browser simulation
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Set location to Chennai
        await page.setGeolocation({ latitude: 13.0827, longitude: 80.2707 });
        console.log(`🟣 Zepto: Location set to Chennai`);
        
        const context = browser.defaultBrowserContext();
        await context.overridePermissions('https://www.zeptonow.com', ['geolocation']);
        
        console.log(`🟣 Zepto: Navigating to search page...`);
        
        try {
          const searchUrl = `https://www.zeptonow.com/search?query=${query.replace(/\s+/g, '+')}`;
          console.log(`🟣 Zepto: Loading search URL: ${searchUrl}`);
          
          await page.goto(searchUrl, { 
            waitUntil: ['domcontentloaded'],
            timeout: 15000 
          });
        } catch (error) {
          console.log(`🟣 Zepto: Direct search failed, trying main page navigation...`);
          
          await page.goto(this.baseUrl, { 
            waitUntil: ['domcontentloaded'],
            timeout: 15000 
          });
          await page.waitForTimeout(3000);
          
          const searchUrl = `${this.searchUrl}?query=${encodeURIComponent(query)}`;
          await page.goto(searchUrl, { 
            waitUntil: ['domcontentloaded'],
            timeout: 20000 
          });
        }
        
        console.log(`🟣 Zepto: Page loaded, waiting for React content to load...`);
        
        // Enhanced waiting strategy for React components
        await this.waitForReactContent(page);
        
        // Extract products using optimized method
        console.log(`🟣 Zepto: Starting optimized product extraction...`);
        const products = await this.extractProductsFromPage(page, query, maxResults);
        
        if (products.length > 0) {
          console.log(`🟣 Zepto: Successfully extracted ${products.length} products!`);
          products.forEach((p, i) => {
            console.log(`🟣 Zepto: ${i+1}. "${p.name}" - ₹${p.price}`);
          });
        } else {
          console.log(`🟣 Zepto: No products found with extraction`);
          
          if (retryCount < maxRetries) {
            console.log(`🟣 Zepto: No products found, retrying...`);
            await browser.close();
            retryCount++;
            continue;
          }
        }
        
        // Apply relevancy filtering
        const filteredProducts = this.filterByRelevancy(products, query);
        
        console.log(`🟣 Zepto: Final result: ${filteredProducts.length} products after filtering`);
        
        return filteredProducts.slice(0, 2);
        
      } catch (error) {
        console.error(`🟣 Zepto scraping error (attempt ${retryCount + 1}): ${error.message}`);
        
        if (browser) {
          await browser.close();
          browser = null;
        }
        
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`🟣 Zepto: Retrying in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        throw error;
      } finally {
        if (browser) {
          await browser.close();
        }
      }
      
      break;
    }
  }

  async waitForReactContent(page) {
    console.log(`🟣 Zepto: Implementing smart wait for React content...`);
    
    let attempt = 0;
    const maxAttempts = 6;
    const baseWaitTime = 2000;
    
    while (attempt < maxAttempts) {
      attempt++;
      console.log(`🟣 Zepto: Wait attempt ${attempt}/${maxAttempts}`);
      
      try {
        await Promise.race([
          page.waitForSelector('[data-testid*="product"]', { timeout: 3000 }).catch(() => null),
          page.waitForSelector('[class*="product" i]', { timeout: 3000 }).catch(() => null),
          page.waitForFunction(
            () => {
              const elements = Array.from(document.querySelectorAll('*'));
              return elements.some(el => el.textContent && el.textContent.includes('₹'));
            },
            { timeout: 3000 }
          ).catch(() => null)
        ]);
        
        const contentCheck = await page.evaluate(() => {
          const priceElements = Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent && el.textContent.includes('₹')
          );
          
          return {
            priceElementsCount: priceElements.length,
            bodyTextLength: document.body.textContent?.length || 0
          };
        });
        
        console.log(`🟣 Zepto: Content check - Prices: ${contentCheck.priceElementsCount}, Body: ${contentCheck.bodyTextLength}`);
        
        if (contentCheck.priceElementsCount >= 3 || contentCheck.bodyTextLength > 10000) {
          console.log(`🟣 Zepto: Content loaded successfully after ${attempt} attempts`);
          break;
        }
        
        const waitTime = baseWaitTime + (attempt * 1000);
        console.log(`🟣 Zepto: Insufficient content, waiting ${waitTime}ms before retry...`);
        await page.waitForTimeout(waitTime);
        
      } catch (error) {
        console.log(`🟣 Zepto: Wait attempt ${attempt} failed: ${error.message}`);
        await page.waitForTimeout(baseWaitTime + (attempt * 500));
      }
    }
    
    await page.waitForTimeout(1500);
  }

  async extractProductsFromPage(page, query, maxResults = 5) {
    console.log(`🟣 Zepto: Starting optimized extraction from available content...`);
    
    const products = await page.evaluate((query, maxResults) => {
      const results = [];
      
      // Words that indicate promotional content (to filter out)
      const promotionalWords = [
        'coupon', 'earn', 'get', 'sign', 'up', 'worth', 'flat', 'offer', 'discount', 
        'save', 'free', 'delivery', 'welcome', 'both', 'refer', 'friend', 'bonus',
        'cashback', 'reward', 'promo', 'deal', 'special', 'limited', 'time'
      ];
      
      // Look for product containers first (much faster than regex on full HTML)
      const productSelectors = [
        '[data-testid*="product"]',
        '[class*="product" i]:not([class*="promo"])',
        '[class*="item" i]:not([class*="menu"])',
        'div[class*="card"]:not([class*="promo"])',
        'div[class*="tile"]',
        'article', 'section'
      ];
      
      const seenProducts = new Set();
      
      productSelectors.forEach(selector => {
        if (results.length >= maxResults) return;
        
        const productElements = Array.from(document.querySelectorAll(selector));
        console.log(`🟣 Found ${productElements.length} elements with selector: ${selector}`);
        
        productElements.slice(0, 15).forEach(element => {
          if (results.length >= maxResults) return;
          
          const text = element.textContent || '';
          const priceMatch = text.match(/₹(\d+)/);
          
          if (priceMatch) {
            const price = parseInt(priceMatch[1]);
            
            if (price >= 10 && price <= 1000) {
              // Look for product name in structured way
              const titleElements = element.querySelectorAll(
                'h1, h2, h3, h4, h5, [class*="title"], [class*="name"], [data-testid*="name"], [class*="product"]'
              );
              
              let productName = '';
              
              if (titleElements.length > 0) {
                // Find the most product-like title
                for (let titleEl of titleElements) {
                  const titleText = titleEl.textContent?.trim() || '';
                  if (titleText.length >= 8 && 
                      titleText.length <= 100 &&
                      !promotionalWords.some(word => 
                        titleText.toLowerCase().includes(word.toLowerCase())
                      )) {
                    productName = titleText;
                    break;
                  }
                }
              }
              
              // Fallback: extract from text content before price
              if (!productName) {
                const beforePrice = text.split('₹')[0];
                const lines = beforePrice.split(/[\n\r]/).filter(line => {
                  const trimmed = line.trim();
                  return trimmed.length >= 8 && 
                         trimmed.length <= 100 &&
                         /[A-Za-z]{4,}/.test(trimmed) &&
                         !promotionalWords.some(word => 
                           trimmed.toLowerCase().includes(word.toLowerCase())
                         );
                });
                
                if (lines.length > 0) {
                  productName = lines[0].trim();
                }
              }
              
              if (productName && 
                  !seenProducts.has(productName.toLowerCase())) {
                
                // Clean the product name
                productName = productName
                  .replace(/u003e/g, '>')
                  .replace(/u0026/g, '&')
                  .replace(/&quot;/g, '"')
                  .replace(/&amp;/g, '&')
                  .replace(/\s+/g, ' ')
                  .trim();
                
                seenProducts.add(productName.toLowerCase());
                
                console.log(`🟣 Found product: "${productName}" - ₹${price}`);
                
                results.push({
                  name: productName,
                  price: price,
                  originalPrice: null,
                  url: window.location.href,
                  image: null,
                  inStock: true,
                  deliveryFee: 'Free',
                  deliveryTime: '10-15 mins',
                  category: 'Food & Snacks'
                });
              }
            }
          }
        });
      });
      
      // Fallback: Lightweight text extraction if no products found
      if (results.length === 0) {
        console.log(`🟣 Fallback: Using lightweight text extraction...`);
        
        const bodyText = document.body.textContent || '';
        const textChunks = bodyText.split('₹').slice(0, 50);
        
        textChunks.forEach(chunk => {
          if (results.length >= maxResults) return;
          
          const match = chunk.match(/(\d+)/);
          if (match) {
            const price = parseInt(match[1]);
            
            if (price >= 10 && price <= 1000) {
              const beforePriceIndex = bodyText.indexOf(`₹${price}`);
              if (beforePriceIndex > 0) {
                const textBefore = bodyText.substring(Math.max(0, beforePriceIndex - 200), beforePriceIndex);
                const lines = textBefore.split(/[\n\r]/).filter(line => {
                  const trimmed = line.trim();
                  return trimmed.length >= 8 && 
                         trimmed.length <= 80 &&
                         /[A-Za-z]{4,}/.test(trimmed) &&
                         !promotionalWords.some(word => 
                           trimmed.toLowerCase().includes(word.toLowerCase())
                         );
                });
                
                if (lines.length > 0) {
                  const productName = lines[lines.length - 1].trim();
                  
                  if (!seenProducts.has(productName.toLowerCase())) {
                    seenProducts.add(productName.toLowerCase());
                    
                    console.log(`🟣 Fallback found: "${productName}" - ₹${price}`);
                    
                    results.push({
                      name: productName,
                      price: price,
                      originalPrice: null,
                      url: window.location.href,
                      image: null,
                      inStock: true,
                      deliveryFee: 'Free',
                      deliveryTime: '10-15 mins',
                      category: 'Food & Snacks'
                    });
                  }
                }
              }
            }
          }
        });
      }
      
      console.log(`🟣 Total extraction results: ${results.length} products`);
      return results;
      
    }, query, maxResults);
    
    console.log(`🟣 Zepto: Extracted ${products.length} products from available content`);
    return products.slice(0, maxResults);
  }

  filterByRelevancy(products, query) {
    const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    console.log(`🟣 Zepto: Query terms for relevancy: [${queryTerms.join(', ')}]`);
    
    const primaryTerm = queryTerms[0];
    const secondaryTerms = queryTerms.slice(1);
    
    const knownBrands = ['yippee', 'maggi', 'nestle', 'mtr', 'knorr', 'wai', 'bambino', 'amul', 'heritage', 'hatsun'];
    const isBrandSearch = knownBrands.some(brand => primaryTerm.includes(brand) || brand.includes(primaryTerm));
    
    console.log(`🟣 Zepto: Primary term: "${primaryTerm}" (Brand search: ${isBrandSearch})`);
    
    const scoredProducts = products.map(product => {
      const productName = product.name.toLowerCase();
      let score = 0;
      let hasAnyMatch = false;
      
      if (productName.includes(primaryTerm)) {
        score += 10;
        hasAnyMatch = true;
      }
      
      secondaryTerms.forEach(term => {
        if (productName.includes(term)) {
          score += 5;
          hasAnyMatch = true;
        }
      });
      
      if (productName.includes(query.toLowerCase())) {
        score += 8;
        hasAnyMatch = true;
      }
      
      if (isBrandSearch && !productName.includes(primaryTerm)) {
        return { ...product, relevancyScore: 0 };
      } else if (!hasAnyMatch) {
        return { ...product, relevancyScore: 0 };
      }
      
      return { ...product, relevancyScore: score };
    });
    
    const relevantProducts = scoredProducts
      .filter(product => product.relevancyScore > 0)
      .sort((a, b) => b.relevancyScore - a.relevancyScore)
      .slice(0, 2);
    
    console.log(`🟣 Zepto: Filtered to ${relevantProducts.length} relevant products from ${products.length} total`);
    
    return relevantProducts;
  }
}

module.exports = new RealZeptoScraper();