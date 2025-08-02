// Real scrapers that hit actual websites
const realZeptoScraper = require('./real-zepto');
const realBlinkitScraper = require('./real-blinkit');
const realSwiggyScraper = require('./real-swiggy');

// Platform configurations - using real scrapers
const platforms = {
  zepto: {
    name: 'Zepto',
    scraper: realZeptoScraper,
    enabled: true // Re-enabled with improved extraction and cleaning
  },
  blinkit: {
    name: 'Blinkit',
    scraper: realBlinkitScraper,
    enabled: true
  },
  swiggy: {
    name: 'Swiggy Instamart',
    scraper: realSwiggyScraper,
    enabled: false // Re-enabled with simplified approach
  }
};

// Scrape a single platform
async function scrapeProduct(platformName, productName) {
  const platform = platforms[platformName.toLowerCase()];
  
  if (!platform) {
    throw new Error(`Unsupported platform: ${platformName}`);
  }
  
  if (!platform.enabled) {
    return {
      platform: platformName,
      success: false,
      error: 'Platform scraping is disabled',
      products: []
    };
  }
  
  try {
    console.log(`Scraping ${platform.name} for: ${productName}`);
    const products = await platform.scraper.searchProducts(productName);
    
    return {
      platform: platformName,
      success: true,
      products: products,
      scraped_at: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error scraping ${platform.name}:`, error.message);
    return {
      platform: platformName,
      success: false,
      error: error.message,
      products: []
    };
  }
}

// Scrape all platforms for a product
async function scrapeAllPlatforms(productName) {
  const results = [];
  const enabledPlatforms = Object.keys(platforms).filter(p => platforms[p].enabled);
  
  console.log(`Scraping ${enabledPlatforms.length} platforms for: ${productName}`);
  
  // Run all scrapers in parallel for faster results
  const promises = enabledPlatforms.map(platformName => 
    scrapeProduct(platformName, productName)
  );
  
  try {
    const platformResults = await Promise.allSettled(promises);
    
    platformResults.forEach((result, index) => {
      const platformName = enabledPlatforms[index];
      
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          platform: platformName,
          success: false,
          error: result.reason.message || 'Unknown error',
          products: []
        });
      }
    });
  } catch (error) {
    console.error('Error in parallel scraping:', error);
  }
  
  return results;
}

// Get platform status
function getPlatformStatus() {
  return Object.keys(platforms).map(key => ({
    platform: key,
    name: platforms[key].name,
    enabled: platforms[key].enabled
  }));
}

// Enable/disable a platform
function togglePlatform(platformName, enabled = true) {
  const platform = platforms[platformName.toLowerCase()];
  if (platform) {
    platform.enabled = enabled;
    console.log(`${platform.name} scraping ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }
  return false;
}

module.exports = {
  scrapeProduct,
  scrapeAllPlatforms,
  getPlatformStatus,
  togglePlatform,
  platforms
};