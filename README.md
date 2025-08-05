# 🛍️ PriceScout

**Fast, Real-time Price Comparison Across Indian E-commerce Platforms**

[![Flutter](https://img.shields.io/badge/Flutter-3.0+-blue.svg)](https://flutter.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Railway](https://img.shields.io/badge/Deployed_on-Railway-blueviolet.svg)](https://railway.app/)

PriceScout is a modern price comparison application that scrapes real-time prices from major Indian e-commerce platforms including **Zepto**, **Blinkit**, and **Swiggy Instamart**. Built with Flutter for the frontend and Node.js for the backend, it delivers lightning-fast results in under 10 seconds.

## ✨ Features

- 🚀 **Ultra-fast Search** - Get price comparisons in 9-10 seconds
- 🔄 **Real-time Scraping** - Live prices from multiple platforms
- 📱 **Cross-platform** - Web, Android, iOS support  
- ⚡ **Browser Pooling** - Optimized performance with warm browsers
- 🎯 **Smart Filtering** - Relevant results with intelligent matching
- 🛡️ **Production Ready** - Docker deployment with comprehensive error handling

## 🏆 Performance

| Platform | Response Time | Platforms Covered |
|----------|---------------|-------------------|
| **PriceScout** | **~9 seconds** | Zepto + Blinkit |
| Competitors | ~67 seconds | Limited coverage |

## 🛠️ Tech Stack

**Frontend:**
- Flutter 3.0+ with Material Design
- Provider for state management
- HTTP client with timeout handling
- Cached network images
- Staggered animations

**Backend:**
- Node.js with Express
- Puppeteer for web scraping
- SQLite database
- Browser pooling for performance
- Docker deployment ready

**Infrastructure:**
- Railway.app (Singapore region)
- Chrome/Chromium headless browsers
- Environment-based configuration

## 🚀 Quick Start

### Prerequisites
- Flutter 3.0+
- Node.js 18+
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/vsaimanohar/PriceScout.git
cd PriceScout
```

### 2. Backend Setup
```bash
cd backend
cp .env.example .env
npm install
npm start
# Server runs on http://localhost:3000
```

### 3. Frontend Setup
```bash
# From project root
flutter pub get
flutter run
# For production build with custom API URL:
flutter build web --dart-define=API_BASE_URL=https://your-backend-url.com/api
```

## 📖 Detailed Setup

See [SETUP.md](SETUP.md) for comprehensive deployment instructions.

## 🔧 Configuration

The app uses environment variables for configuration:

**Backend (.env):**
```bash
NODE_ENV=production
PORT=3000
SCRAPING_ENABLED=true
SCRAPING_TIMEOUT=30000
```

**Frontend (build time):**
```bash
flutter build web --dart-define=API_BASE_URL=https://your-api-url.com/api
```

## 🌐 Supported Platforms

| Platform | Status | Coverage |
|----------|--------|----------|
| **Zepto** | ✅ Active | Full product catalog |
| **Blinkit** | ✅ Active | Full product catalog |
| **Swiggy Instamart** | 🔄 Development | Coming soon |

## 📊 API Endpoints

- `GET /api/products/search?q={query}` - Search products
- `GET /api/health` - Health check
- `GET /api/products/{id}/prices` - Get product prices

## 🚀 Deployment

**Backend:** One-click deploy to Railway using Docker
**Frontend:** Deploy to Netlify, Vercel, or any static hosting

```bash
# Build for production
flutter build web --dart-define=API_BASE_URL=https://your-backend.railway.app/api
```

## 🔐 Security

- Environment variables for sensitive configuration  
- No hardcoded URLs or API keys
- Comprehensive .gitignore for sensitive files
- Rate limiting and error handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎯 Roadmap

- [ ] Add more e-commerce platforms (Amazon, Flipkart)
- [ ] Price history tracking and alerts  
- [ ] Mobile app optimization
- [ ] Advanced filtering and sorting
- [ ] User accounts and favorites

## 📞 Contact

**Developer:** Sai Manohar Veeravajhula  
**GitHub:** [@vsaimanohar](https://github.com/vsaimanohar)

---

⭐ **Star this repo if you find it useful!**