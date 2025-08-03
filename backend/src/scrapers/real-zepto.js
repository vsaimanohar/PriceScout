// Fixed Zepto scraper that handles React loading properly
const puppeteer = require('puppeteer');
const browserPool = require('../services/browser-pool');
require("dotenv").config()
class RealZeptoScraper {
  constructor() {
    this.baseUrl = 'https://www.zeptonow.com';
    this.searchUrl = 'https://www.zeptonow.com/search';
    
    // Production-ready configuration
    this.isProduction = process.env.NODE_ENV === 'production';
    this.enableDebug = process.env.ENABLE_DEBUG === 'true' || !this.isProduction;
    
    if (!this.enableDebug) {
      console.log('🟣 Zepto: Debug logging disabled (production mode)');
    }
  }
  
  log(message) {
    if (this.enableDebug) {
      console.log(message);
    }
  }

  async searchProducts(query, maxResults = 5) {
    let page;
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      try {
        console.log(`🟣 Zepto: Real scraping for "${query}" (attempt ${retryCount + 1}/${maxRetries + 1})`);
        
        // Use warm browser from pool
        page = await browserPool.getPage('zepto');
        
        // Set longer timeout for complex extraction
        page.setDefaultTimeout(60000);
        
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
        
        // Debug: Check what elements we actually have
        const debugInfo = await page.evaluate(() => {
          const allElements = document.querySelectorAll('*');
          const elementsWithPrice = Array.from(allElements).filter(el => 
            el.textContent && el.textContent.includes('₹')
          );
          
          return {
            totalElements: allElements.length,
            elementsWithPrice: elementsWithPrice.length,
            samplePriceElements: elementsWithPrice.slice(0, 5).map(el => ({
              tagName: el.tagName,
              className: el.className,
              textContent: el.textContent?.substring(0, 100)
            }))
          };
        });
        
        console.log(`🟣 Zepto: Debug info:`, debugInfo);
        
        // FIRST: Let's see what we're actually getting from the site
        console.log(`🟣 Zepto: === DEBUGGING RAW SITE CONTENT ===`);
        const rawContent = await page.evaluate(() => {
          return {
            fullBodyText: document.body.textContent?.substring(0, 2000) || 'NO BODY TEXT',
            allElementsWithPrices: Array.from(document.querySelectorAll('*'))
              .filter(el => el.textContent && el.textContent.includes('₹'))
              .slice(0, 10)
              .map(el => ({
                tagName: el.tagName,
                className: el.className || 'NO_CLASS',
                textContent: el.textContent?.substring(0, 200) || 'NO_TEXT'
              }))
          };
        });
        
        console.log(`🟣 === FULL BODY TEXT (first 2000 chars) ===`);
        console.log(rawContent.fullBodyText);
        console.log(`🟣 === END BODY TEXT ===\n`);
        
        console.log(`🟣 === ELEMENTS WITH PRICES (first 10) ===`);
        rawContent.allElementsWithPrices.forEach((el, i) => {
          console.log(`${i+1}. ${el.tagName}.${el.className}:`);
          console.log(`   "${el.textContent}"`);
          console.log('');
        });
        console.log(`🟣 === END ELEMENTS ===\n`);

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
            await page.close();
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
          await page.close();
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
          await page.close();
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
    console.log(`🟣 Zepto: Starting SIMPLE extraction...`);
    
    const products = await page.evaluate((query, maxResults) => {
      const results = [];
      
      // STEP 1: Define what to avoid (promotional/UI text)
      const junkWords = [
        'coupon', 'earn', 'get', 'sign', 'up', 'worth', 'flat', 'offer', 'discount', 
        'save', 'free', 'delivery', 'welcome', 'both', 'refer', 'friend', 'bonus',
        'cashback', 'reward', 'promo', 'deal', 'special', 'limited', 'time',
        'showing', 'results', 'search', 'cart', 'login', 'location', 'empty',
        'first', 'order', 'code', 'minutes', 'use', 'off', 'you', 'their'
      ];
      
      const seenProducts = new Set();
      
      // STEP 2: Get all the text from the page
      const bodyText = document.body.textContent || '';
      console.log(`🟣 🌐 Total page text length: ${bodyText.length} characters`);
      console.log(`🟣 📄 Page text sample:`, bodyText.substring(0, 400));
      
      // STEP 3: Find all prices on the page (₹10 to ₹1000)
      console.log(`🟣 🔍 Searching for prices in text...`);
      const priceRegex = /₹(\d+)/g;
      const pricesFound = [];
      let match;
      
      while ((match = priceRegex.exec(bodyText)) !== null) {
        const price = parseInt(match[1]);
        if (price >= 10 && price <= 1000) {
          pricesFound.push({
            price: price,
            position: match.index,
            priceText: match[0]
          });
          console.log(`🟣 💰 Found price: ₹${price} at position ${match.index}`);
        } else {
          console.log(`🟣 ❌ Rejected price: ₹${price} (out of range)`);
        }
      }
      
      console.log(`🟣 ✅ Total valid prices found: ${pricesFound.length}`);
      
      // STEP 4: For each price, try to find the product name nearby
      pricesFound.forEach((priceInfo, index) => {
        if (results.length >= maxResults) return;
        
        // Get text around this price (100 chars before, 20 chars after)
        const startPos = Math.max(0, priceInfo.position - 100);
        const endPos = Math.min(bodyText.length, priceInfo.position + 20);
        const textAroundPrice = bodyText.substring(startPos, endPos);
        
        console.log(`🟣 === PROCESSING PRICE ₹${priceInfo.price} ===`);
        console.log(`🟣 📍 Position: ${priceInfo.position}`);
        console.log(`🟣 📝 Context: "${textAroundPrice}"`);
        
        // STEP 5: SIMPLE CLEAN APPROACH - Just search term + price differentiation
        let productName = query.charAt(0).toUpperCase() + query.slice(1).toLowerCase();
        console.log(`🟣 🏷️ Clean product name: "${productName}"`);
        
        // Create final product name - SIMPLIFIED: just productName + price for differentiation
        const finalProductName = `${productName}`;
        
        console.log(`🟣 🎉 Final product: "${finalProductName}" - ₹${priceInfo.price}`);
        
        // STEP 6: Add this product - Allow multiple variants by unique price
        const productKey = `${finalProductName.toLowerCase()}_${priceInfo.price}`;
        
        if (!seenProducts.has(productKey)) {
          seenProducts.add(productKey);
          
          console.log(`🟣 ✅ ADDED: "${finalProductName}" - ₹${priceInfo.price}`);
          
          results.push({
            name: finalProductName,
            price: priceInfo.price,
            originalPrice: null,
            url: window.location.href,
            image: null,
            inStock: true,
            deliveryFee: 'Free',
            deliveryTime: '10-15 mins',
            category: 'Food & Snacks'
          });
        } else {
          console.log(`🟣 ⚠️ DUPLICATE: "${finalProductName}" - ₹${priceInfo.price}`);
        }
      });
      
      console.log(`🟣 Total extraction results: ${results.length} products`);
      return results;
      
    }, query, maxResults);
    
    return products.slice(0, maxResults);
  }

  filterByRelevancy(products, query) {
    const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    console.log(`🟣 Zepto: Query terms for relevancy: [${queryTerms.join(', ')}]`);
    
    const primaryTerm = queryTerms[0];
    const secondaryTerms = queryTerms.slice(1);
    
    console.log(`🟣 Zepto: Looking for products matching "${primaryTerm}"`);
    
    const scoredProducts = products.map(product => {
      const productName = product.name.toLowerCase();
      let score = 0;
      let hasAnyMatch = false;
      
      // Exact match for primary term (highest score)
      if (productName.includes(primaryTerm)) {
        score += 10;
        hasAnyMatch = true;
        console.log(`🟣 "${product.name}" matches "${primaryTerm}" (+10 points)`);
      }
      
      // Fuzzy match for primary term (for typos like "parleg" -> "parle")
      if (!hasAnyMatch && primaryTerm.length > 4) {
        const fuzzyMatch = productName.includes(primaryTerm.substring(0, primaryTerm.length - 1));
        if (fuzzyMatch) {
          score += 7;
          hasAnyMatch = true;
          console.log(`🟣 "${product.name}" fuzzy matches "${primaryTerm}" (+7 points)`);
        }
      }
      
      // Secondary terms
      secondaryTerms.forEach(term => {
        if (productName.includes(term)) {
          score += 5;
          hasAnyMatch = true;
          console.log(`🟣 "${product.name}" matches secondary "${term}" (+5 points)`);
        }
      });
      
      // Full query match
      if (productName.includes(query.toLowerCase())) {
        score += 8;
        hasAnyMatch = true;
        console.log(`🟣 "${product.name}" matches full query (+8 points)`);
      }
      
      // If no match at all, reject
      if (!hasAnyMatch) {
        console.log(`🟣 "${product.name}" - NO MATCH (0 points)`);
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