# Price Comparison App Setup Guide

## ⚠️ IMPORTANT: Configuration Required

This repository contains a Flutter frontend and Node.js backend for price comparison across Indian e-commerce platforms.

### 🔧 Backend Setup

1. **Environment Configuration**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Database Setup**
   ```bash
   npm run build  # Rebuilds SQLite for your system
   ```

4. **Start Development Server**
   ```bash
   npm start
   # Server runs on http://localhost:3000
   ```

### 📱 Frontend Setup

1. **Install Dependencies**
   ```bash
   flutter pub get
   ```

2. **Development (uses localhost:3000)**
   ```bash
   flutter run
   ```

3. **Production Build (with your API URL)**
   ```bash
   # For web deployment
   flutter build web --dart-define=API_BASE_URL=https://your-backend-url.up.railway.app/api
   
   # For mobile app
   flutter build apk --dart-define=API_BASE_URL=https://your-backend-url.up.railway.app/api
   ```

### 🚀 Deployment

**Backend**: Deploy to Railway, Render, or similar platform

**Frontend**: 
1. Build with production API URL:
   ```bash
   flutter build web --dart-define=API_BASE_URL=https://your-actual-backend-url.com/api
   ```

2. Deploy the `build/web` folder to Netlify, Vercel, etc.

**Example Netlify deployment script:**
```bash
# build.sh
flutter build web --dart-define=API_BASE_URL=$API_BASE_URL
```

**Environment Variables for deployment platforms:**
- `API_BASE_URL`: Your backend URL (e.g., `https://myapp.up.railway.app/api`)

### 🔐 Security Notes

- Never commit `.env` files
- Always use environment variables for sensitive configuration
- Update the API URL before deploying frontend

### 📋 Features

- ✅ Price comparison across Zepto, Blinkit, Swiggy Instamart
- ✅ Real-time web scraping with Puppeteer
- ✅ Browser pooling for performance
- ✅ Docker deployment ready
- ✅ Material Design UI