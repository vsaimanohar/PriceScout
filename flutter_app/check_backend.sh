#!/bin/bash
cd /Users/saimanohar.veeravajhula/Desktop/price-comparison-app/backend
echo "=== Backend directory contents ==="
ls -la
echo ""
echo "=== Looking for main backend files ==="
find . -name "*.js" -o -name "*.json" -o -name "package.json" -o -name "server.js" -o -name "app.js" -o -name "index.js" 2>/dev/null