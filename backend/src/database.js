const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.db');
let db;

function getDatabase() {
  if (!db) {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Connected to SQLite database');
      }
    });
  }
  return db;
}

async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    
    // Create products table
    const createProductsTable = `
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Create prices table
    const createPricesTable = `
      CREATE TABLE IF NOT EXISTS prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        platform TEXT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        original_price DECIMAL(10,2),
        url TEXT,
        in_stock BOOLEAN DEFAULT 1,
        delivery_fee TEXT,
        delivery_time TEXT,
        scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
      )
    `;
    
    // Create indexes for better performance
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)',
      'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)',
      'CREATE INDEX IF NOT EXISTS idx_prices_product_id ON prices(product_id)',
      'CREATE INDEX IF NOT EXISTS idx_prices_platform ON prices(platform)',
      'CREATE INDEX IF NOT EXISTS idx_prices_scraped_at ON prices(scraped_at)'
    ];
    
    database.serialize(() => {
      database.run(createProductsTable, (err) => {
        if (err) {
          console.error('Error creating products table:', err);
          reject(err);
          return;
        }
      });
      
      database.run(createPricesTable, (err) => {
        if (err) {
          console.error('Error creating prices table:', err);
          reject(err);
          return;
        }
      });
      
      // Create indexes
      createIndexes.forEach(indexSql => {
        database.run(indexSql, (err) => {
          if (err) {
            console.error('Error creating index:', err);
          }
        });
      });
      
      resolve();
    });
  });
}

// Helper function to run queries with promises
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

// Helper function to get single row
function getRow(sql, params = []) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Helper function to get all rows
function getAllRows(sql, params = []) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Database is now used only for caching scraped results
// No seeding of sample data

module.exports = {
  initializeDatabase,
  getDatabase,
  runQuery,
  getRow,
  getAllRows
};