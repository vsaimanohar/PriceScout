#!/bin/bash

# Price Comparison App - Flutter Demo Script
# This script checks prerequisites, installs dependencies, and runs the Flutter app

set -e  # Exit on any error

echo "📱 Starting Price Comparison Flutter App..."
echo "=========================================="

# Check if Flutter is installed
if ! command -v flutter &> /dev/null; then
    echo "❌ Flutter is not installed. Please install Flutter and try again."
    echo "   Visit: https://flutter.dev/docs/get-started/install"
    exit 1
fi

# Check Flutter version
echo "🔍 Checking Flutter version..."
flutter --version | head -n 1

# Check if backend is running
echo "🔍 Checking backend connectivity..."
if curl -s http://localhost:3000/api/products/search?q=milk > /dev/null 2>&1; then
    echo "✅ Backend is running and accessible"
else
    echo "⚠️  Backend is not running or not accessible at http://localhost:3000"
    echo "   Please start the backend first:"
    echo "   cd ../backend && ./start.sh"
    echo ""
    echo "   Do you want to continue anyway? The app will show connection errors. (y/N)"
    read -r response
    if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "❌ Exiting. Please start the backend first."
        exit 1
    fi
fi

# Check if dependencies are installed
echo "📦 Checking Flutter dependencies..."
if [ ! -d ".dart_tool" ] || [ ! -f "pubspec.lock" ]; then
    echo "📦 Installing Flutter dependencies..."
    flutter pub get
    echo "✅ Dependencies installed successfully"
else
    echo "✅ Dependencies already installed"
fi

# Run flutter doctor to check for issues
echo "🏥 Running Flutter doctor check..."
flutter doctor --no-version-check

# List available devices
echo "📱 Available devices:"
flutter devices --no-version-check

# Check if any device is available
device_count=$(flutter devices --no-version-check --machine | jq length 2>/dev/null || echo "0")

if [ "$device_count" -eq 0 ]; then
    echo "⚠️  No devices found. Starting web version..."
    
    # Check if Chrome is available for web
    if ! command -v google-chrome &> /dev/null && ! command -v chromium-browser &> /dev/null && ! command -v chrome &> /dev/null; then
        echo "⚠️  Chrome not found. Web app may not work properly."
    fi
    
    echo "🌐 Starting Flutter web app..."
    echo "   App will open in browser at: http://localhost:8080"
    echo ""
    echo "🎯 Demo Features:"
    echo "   • Search for products (try 'milk', 'bread', 'noodles')"
    echo "   • View price comparisons across platforms"
    echo "   • See popular products on home screen"
    echo "   • Beautiful Material Design UI with animations"
    echo ""
    echo "Press Ctrl+C to stop the app"
    echo "=========================================="
    
    flutter run -d web-server --web-port=8080 --web-hostname=0.0.0.0
    
elif [ "$device_count" -eq 1 ]; then
    # One device available, use it
    device_id=$(flutter devices --no-version-check --machine | jq -r '.[0].id' 2>/dev/null || echo "")
    
    echo "🚀 Starting Flutter app on available device..."
    echo ""
    echo "🎯 Demo Features:"
    echo "   • Search for products (try 'milk', 'bread', 'noodles')"
    echo "   • View price comparisons across platforms"
    echo "   • See popular products on home screen"
    echo "   • Beautiful Material Design UI with animations"
    echo ""
    echo "Press Ctrl+C to stop the app"
    echo "=========================================="
    
    if [ -n "$device_id" ]; then
        flutter run -d "$device_id" --no-version-check
    else
        flutter run --no-version-check
    fi
    
else
    # Multiple devices available, let user choose
    echo "🔍 Multiple devices found. Please select one:"
    flutter devices --no-version-check
    echo ""
    echo "Enter device ID (or press Enter for first available device): "
    read -r device_choice
    
    echo "🚀 Starting Flutter app..."
    echo ""
    echo "🎯 Demo Features:"
    echo "   • Search for products (try 'milk', 'bread', 'noodles')"
    echo "   • View price comparisons across platforms"
    echo "   • See popular products on home screen"
    echo "   • Beautiful Material Design UI with animations"
    echo ""
    echo "Press Ctrl+C to stop the app"
    echo "=========================================="
    
    if [ -z "$device_choice" ]; then
        flutter run --no-version-check
    else
        flutter run -d "$device_choice" --no-version-check
    fi
fi