const express = require('express');
const { getAllRows, getRow, runQuery } = require('../database');
const router = express.Router();

// Search products - now performs live scraping
router.get('/search', async (req, res) => {
  try {
    const { q: query, limit = 20 } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.json([]);
    }
    
    console.log(`🔍 Live search started for: "${query}"`);
    
    // Import scraping functionality
    const { scrapeAllPlatforms } = require('../scrapers/index');
    
    // Perform live scraping with detailed logging
    console.log(`⏳ Starting scraping process for "${query}"...`);
    const scrapingResults = await scrapeAllPlatforms(query.trim());
    console.log(`✅ Scraping completed for "${query}". Processing results...`);
    
    // Process and store results
    console.log(`🔄 Processing scraping results: ${scrapingResults.length} platforms`);
    const products = [];
    const productMap = new Map(); // To group products by name
    
    // Helper functions (moved outside the loop)
    const normalizeProductName = (name) => {
      return name.toLowerCase()
        .replace(/[()]/g, '') // Remove parentheses but keep other chars
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
    };
    
    for (const platformResult of scrapingResults) {
      const status = platformResult.success ? '✅ SUCCESS' : '❌ FAILED';
      const count = platformResult.success ? platformResult.products.length : 0;
      console.log(`📊 Platform ${platformResult.platform}: ${status} - ${count} products found`);
      
      if (platformResult.success && platformResult.products.length > 0) {
        platformResult.products.forEach((product, index) => {
          console.log(`   📦 ${platformResult.platform}: "${product.name}" - ₹${product.price}`);
        });
        
        for (const scrapedProduct of platformResult.products) {
          const normalizedName = normalizeProductName(scrapedProduct.name);
          
          // Use exact product name as key - no fuzzy matching for now
          const productKey = normalizedName;
          
          if (!productMap.has(productKey)) {
            // Create new product entry
            const productData = {
              id: Math.floor(Math.random() * 1000000),
              name: scrapedProduct.name,
              category: scrapedProduct.category || 'General',
              image_url: scrapedProduct.image,
              created_at: new Date().toISOString(),
              prices: []
            };
            productMap.set(productKey, productData);
            console.log(`➕ Created new product: "${scrapedProduct.name}" (${platformResult.platform})`);
          } else {
            console.log(`🔄 Adding price to existing product: "${scrapedProduct.name}" (${platformResult.platform})`);
          }
          
          // Add price data
          const productData = productMap.get(productKey);
          productData.prices.push({
            id: 0,
            platform: platformResult.platform,
            price: scrapedProduct.price,
            original_price: scrapedProduct.originalPrice,
            url: scrapedProduct.url,
            in_stock: scrapedProduct.inStock,
            delivery_fee: scrapedProduct.deliveryFee,
            delivery_time: scrapedProduct.deliveryTime,
            scraped_at: new Date().toISOString()
          });
        }
      }
    }
    
    // Convert map to array and limit results
    console.log(`🔄 ProductMap contains ${productMap.size} unique products`);
    const finalProducts = Array.from(productMap.values()).slice(0, parseInt(limit));
    console.log(`📦 Returning ${finalProducts.length} products to client`);
    
    // Optionally cache in database for future requests
    try {
      for (const product of finalProducts) {
        // Check if product exists in database
        let existingProduct = await getRow(
          'SELECT id FROM products WHERE LOWER(name) = LOWER(?)',
          [product.name]
        );
        
        let productId;
        
        if (existingProduct) {
          productId = existingProduct.id;
          await runQuery(
            'UPDATE products SET image_url = COALESCE(?, image_url), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [product.image_url, productId]
          );
        } else {
          const result = await runQuery(
            'INSERT INTO products (name, category, image_url) VALUES (?, ?, ?)',
            [product.name, product.category, product.image_url]
          );
          productId = result.id;
        }
        
        // Update/insert prices
        for (const price of product.prices) {
          const existingPrice = await getRow(
            'SELECT id FROM prices WHERE product_id = ? AND platform = ?',
            [productId, price.platform]
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
                price.price,
                price.original_price,
                price.url,
                price.in_stock ? 1 : 0,
                price.delivery_fee,
                price.delivery_time,
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
                price.platform,
                price.price,
                price.original_price,
                price.url,
                price.in_stock ? 1 : 0,
                price.delivery_fee,
                price.delivery_time
              ]
            );
          }
        }
      }
    } catch (dbError) {
      console.error('Error caching scraped data:', dbError);
      // Continue anyway - caching is optional
    }
    
    console.log(`🎉 Live search completed for "${query}": found ${finalProducts.length} products`);
    console.log(`📦 Returning ${finalProducts.length} products to client`);
    // For debugging, include scraping results summary
    const debugInfo = {
      products: finalProducts,
      debug: {
        total_platforms: scrapingResults.length,
        platform_results: scrapingResults.map(r => ({
          platform: r.platform,
          success: r.success,
          product_count: r.success ? r.products.length : 0,
          error: r.error || null
        })),
        unique_products_found: productMap.size,
        returned_products: finalProducts.length
      }
    };
    
    res.json(debugInfo);
    
  } catch (error) {
    console.error('Error in live search:', error);
    res.status(500).json({ error: 'Failed to search products' });
  }
});

// Get popular products - return recent cached results or empty
router.get('/popular', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Only return recently cached products (within last 24 hours)
    const sql = `
      SELECT 
        p.id,
        p.name,
        p.category,
        p.image_url,
        p.created_at,
        COUNT(pr.id) as price_count,
        MIN(pr.price) as min_price
      FROM products p
      LEFT JOIN prices pr ON p.id = pr.product_id 
        AND pr.in_stock = 1 
        AND pr.scraped_at > datetime('now', '-24 hours')
      WHERE p.updated_at > datetime('now', '-24 hours')
      GROUP BY p.id
      HAVING price_count > 0
      ORDER BY p.updated_at DESC, price_count DESC
      LIMIT ?
    `;
    
    const products = await getAllRows(sql, [parseInt(limit)]);
    
    if (products.length === 0) {
      return res.json([]);
    }
    
    // Get detailed prices for each product
    const detailedProducts = await Promise.all(
      products.map(async (product) => {
        const prices = await getAllRows(
          'SELECT * FROM prices WHERE product_id = ? AND scraped_at > datetime("now", "-24 hours") ORDER BY price ASC',
          [product.id]
        );
        
        return {
          id: product.id,
          name: product.name,
          category: product.category,
          image_url: product.image_url,
          created_at: product.created_at,
          prices: prices.map(price => ({
            id: price.id,
            platform: price.platform,
            price: price.price,
            original_price: price.original_price,
            url: price.url,
            in_stock: price.in_stock === 1,
            delivery_fee: price.delivery_fee,
            delivery_time: price.delivery_time,
            scraped_at: price.scraped_at
          }))
        };
      })
    );
    
    res.json(detailedProducts);
  } catch (error) {
    console.error('Error getting popular products:', error);
    res.status(500).json({ error: 'Failed to get popular products' });
  }
});

// Get trending products (alias for popular for now)
router.get('/trending', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // For now, trending is the same as popular but with a smaller default limit
    req.query.limit = limit;
    
    // Reuse the popular products logic
    const { limit: popularLimit = 10 } = req.query;
    
    const sql = `
      SELECT 
        p.id,
        p.name,
        p.category,
        p.image_url,
        p.created_at,
        COUNT(pr.id) as price_count,
        MIN(pr.price) as min_price
      FROM products p
      LEFT JOIN prices pr ON p.id = pr.product_id AND pr.in_stock = 1
      GROUP BY p.id
      HAVING price_count > 0
      ORDER BY p.created_at DESC, price_count DESC
      LIMIT ?
    `;
    
    const products = await getAllRows(sql, [parseInt(popularLimit)]);
    
    const detailedProducts = await Promise.all(
      products.map(async (product) => {
        const prices = await getAllRows(
          'SELECT * FROM prices WHERE product_id = ? ORDER BY price ASC',
          [product.id]
        );
        
        return {
          id: product.id,
          name: product.name,
          category: product.category,
          image_url: product.image_url,
          created_at: product.created_at,
          prices: prices.map(price => ({
            id: price.id,
            platform: price.platform,
            price: price.price,
            original_price: price.original_price,
            url: price.url,
            in_stock: price.in_stock === 1,
            delivery_fee: price.delivery_fee,
            delivery_time: price.delivery_time,
            scraped_at: price.scraped_at
          }))
        };
      })
    );
    
    res.json(detailedProducts);
  } catch (error) {
    console.error('Error getting trending products:', error);
    res.status(500).json({ error: 'Failed to get trending products' });
  }
});

// Get search suggestions
router.get('/suggestions', async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.json([]);
    }
    
    const searchTerm = `%${query.trim()}%`;
    
    const sql = `
      SELECT DISTINCT name
      FROM products 
      WHERE name LIKE ?
      ORDER BY name
      LIMIT ?
    `;
    
    const suggestions = await getAllRows(sql, [searchTerm, parseInt(limit)]);
    const suggestionNames = suggestions.map(row => row.name);
    
    res.json(suggestionNames);
  } catch (error) {
    console.error('Error getting suggestions:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// Get prices for a specific product
router.get('/:id/prices', async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if product exists
    const product = await getRow('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Get all prices for the product
    const prices = await getAllRows(
      'SELECT * FROM prices WHERE product_id = ? ORDER BY price ASC',
      [id]
    );
    
    const formattedPrices = prices.map(price => ({
      id: price.id,
      platform: price.platform,
      price: price.price,
      original_price: price.original_price,
      url: price.url,
      in_stock: price.in_stock === 1,
      delivery_fee: price.delivery_fee,
      delivery_time: price.delivery_time,
      scraped_at: price.scraped_at
    }));
    
    res.json(formattedPrices);
  } catch (error) {
    console.error('Error getting product prices:', error);
    res.status(500).json({ error: 'Failed to get product prices' });
  }
});

// Get a specific product by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await getRow('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const prices = await getAllRows(
      'SELECT * FROM prices WHERE product_id = ? ORDER BY price ASC',
      [id]
    );
    
    const productWithPrices = {
      id: product.id,
      name: product.name,
      category: product.category,
      image_url: product.image_url,
      created_at: product.created_at,
      prices: prices.map(price => ({
        id: price.id,
        platform: price.platform,
        price: price.price,
        original_price: price.original_price,
        url: price.url,
        in_stock: price.in_stock === 1,
        delivery_fee: price.delivery_fee,
        delivery_time: price.delivery_time,
        scraped_at: price.scraped_at
      }))
    };
    
    res.json(productWithPrices);
  } catch (error) {
    console.error('Error getting product:', error);
    res.status(500).json({ error: 'Failed to get product' });
  }
});

module.exports = router;