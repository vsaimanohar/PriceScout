const express = require('express');
const { getAllRows, getRow, runQuery } = require('../database');
const { scrapeProduct, scrapeAllPlatforms } = require('../scrapers/index');
const router = express.Router();

// Live scraping endpoint
router.post('/live/:productName', async (req, res) => {
  try {
    const { productName } = req.params;
    
    if (!productName || productName.trim().length === 0) {
      return res.status(400).json({ error: 'Product name is required' });
    }
    
    console.log(`Starting live scrape for: ${productName}`);
    
    // Scrape all platforms for the product
    const scrapingResults = await scrapeAllPlatforms(productName);
    
    // Check if we have any results
    const hasResults = scrapingResults.some(result => result.success && result.products.length > 0);
    
    if (!hasResults) {
      return res.json({
        success: false,
        message: 'No products found on any platform',
        results: scrapingResults
      });
    }
    
    // Store results in database
    const storedProducts = [];
    
    for (const platformResult of scrapingResults) {
      if (platformResult.success && platformResult.products.length > 0) {
        for (const scrapedProduct of platformResult.products) {
          try {
            // Check if product already exists
            let existingProduct = await getRow(
              'SELECT id FROM products WHERE LOWER(name) = LOWER(?)',
              [scrapedProduct.name]
            );
            
            let productId;
            
            if (existingProduct) {
              productId = existingProduct.id;
              // Update the product if needed
              await runQuery(
                'UPDATE products SET image_url = COALESCE(?, image_url), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [scrapedProduct.image, productId]
              );
            } else {
              // Create new product
              const result = await runQuery(
                'INSERT INTO products (name, category, image_url) VALUES (?, ?, ?)',
                [scrapedProduct.name, scrapedProduct.category || 'General', scrapedProduct.image]
              );
              productId = result.id;
            }
            
            // Update or insert price
            const existingPrice = await getRow(
              'SELECT id FROM prices WHERE product_id = ? AND platform = ?',
              [productId, platformResult.platform]
            );
            
            if (existingPrice) {
              await runQuery(
                `UPDATE prices SET 
                 price = ?, 
                 original_price = ?, 
                 url = ?, 
                 in_stock = ?, 
                 delivery_fee = ?, 
                 delivery_time = ?, 
                 scraped_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [
                  scrapedProduct.price,
                  scrapedProduct.originalPrice,
                  scrapedProduct.url,
                  scrapedProduct.inStock ? 1 : 0,
                  scrapedProduct.deliveryFee,
                  scrapedProduct.deliveryTime,
                  existingPrice.id
                ]
              );
            } else {
              await runQuery(
                `INSERT INTO prices 
                 (product_id, platform, price, original_price, url, in_stock, delivery_fee, delivery_time) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  productId,
                  platformResult.platform,
                  scrapedProduct.price,
                  scrapedProduct.originalPrice,
                  scrapedProduct.url,
                  scrapedProduct.inStock ? 1 : 0,
                  scrapedProduct.deliveryFee,
                  scrapedProduct.deliveryTime
                ]
              );
            }
            
            storedProducts.push({
              id: productId,
              name: scrapedProduct.name,
              platform: platformResult.platform,
              price: scrapedProduct.price
            });
            
          } catch (dbError) {
            console.error(`Error storing product ${scrapedProduct.name}:`, dbError);
          }
        }
      }
    }
    
    res.json({
      success: true,
      message: `Successfully scraped and stored ${storedProducts.length} products`,
      stored_products: storedProducts,
      scraping_results: scrapingResults
    });
    
  } catch (error) {
    console.error('Error in live scraping:', error);
    res.status(500).json({ 
      error: 'Failed to scrape live data',
      details: error.message 
    });
  }
});

// Trigger scraping for a specific platform and product
router.post('/platform/:platform/:productName', async (req, res) => {
  try {
    const { platform, productName } = req.params;
    
    const supportedPlatforms = ['zepto', 'blinkit', 'swiggy'];
    if (!supportedPlatforms.includes(platform.toLowerCase())) {
      return res.status(400).json({ 
        error: 'Unsupported platform',
        supported_platforms: supportedPlatforms
      });
    }
    
    console.log(`Starting scrape for ${platform}: ${productName}`);
    
    const result = await scrapeProduct(platform.toLowerCase(), productName);
    
    res.json({
      platform: platform,
      product_name: productName,
      result: result
    });
    
  } catch (error) {
    console.error('Error in platform scraping:', error);
    res.status(500).json({ 
      error: 'Failed to scrape platform data',
      details: error.message 
    });
  }
});

// Get scraping status/stats
router.get('/stats', async (req, res) => {
  try {
    const totalProducts = await getRow('SELECT COUNT(*) as count FROM products');
    const totalPrices = await getRow('SELECT COUNT(*) as count FROM prices');
    const recentScrapes = await getAllRows(
      'SELECT platform, COUNT(*) as count FROM prices WHERE scraped_at > datetime("now", "-1 day") GROUP BY platform'
    );
    
    const platformStats = await getAllRows(`
      SELECT 
        platform,
        COUNT(*) as total_prices,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price,
        COUNT(CASE WHEN in_stock = 1 THEN 1 END) as in_stock_count
      FROM prices 
      GROUP BY platform
    `);
    
    res.json({
      total_products: totalProducts.count,
      total_prices: totalPrices.count,
      recent_scrapes_24h: recentScrapes,
      platform_stats: platformStats
    });
    
  } catch (error) {
    console.error('Error getting scraping stats:', error);
    res.status(500).json({ error: 'Failed to get scraping stats' });
  }
});

module.exports = router;