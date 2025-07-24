#!/bin/bash
cd /Users/saimanohar.veeravajhula/Desktop/price-comparison-app
echo "=== Contents of project root ==="
ls -la
echo ""
echo "=== Does backend directory exist? ==="
if [ -d "backend" ]; then
    echo "YES - backend directory exists"
    echo "Backend contents:"
    ls -la backend/
else
    echo "NO - backend directory does not exist"
fi