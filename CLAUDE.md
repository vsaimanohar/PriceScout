# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Flutter App (Frontend)
- **Run the app**: `flutter run`
- **Build for release**: `flutter build apk` or `flutter build web`
- **Run tests**: `flutter test`
- **Analyze code**: `flutter analyze`
- **Format code**: `dart format lib/`
- **Get dependencies**: `flutter pub get`
- **Clean build**: `flutter clean`

### Backend Server
- **Start server**: `cd ../backend && npm start`
- **Install dependencies**: `cd ../backend && npm install`

## Architecture Overview

This is a price comparison app built with Flutter frontend and Node.js backend. The app allows users to search for products and compare prices across different e-commerce platforms (Zepto, Blinkit, Swiggy Instamart).

### Project Structure
- **Frontend**: Flutter app in current directory
- **Backend**: Node.js server in `../backend/` directory
- **Database**: SQLite database (`../backend/database.db`)

### Key Components

**Frontend Architecture**:
- **Provider Pattern**: Uses `provider` package for state management
- **Material Design**: UI follows Material Design principles with custom theming
- **API Integration**: HTTP client communicates with local Node.js backend
- **Animations**: Staggered animations for smooth UI transitions

**Core Models**:
- `Product`: Main product entity with id, name, category, imageUrl, and prices
- `Price`: Price information with platform, price, stock status, and scrape timestamp

**Main Screens**:
- `SearchScreen`: Main interface with search functionality and product results
- `PriceComparisonModal`: Bottom sheet modal showing detailed price comparison

**Services**:
- `ApiService`: Handles all HTTP communication with backend (search, suggestions, prices)

### API Integration
- Backend runs on `http://localhost:3000/api`
- Endpoints:
  - `GET /products/search?q={query}`: Search for products
  - `GET /products/suggestions?q={query}`: Get search suggestions
  - `GET /products/{id}/prices`: Get prices for specific product

### Platform-Specific Features
- **Web Support**: Configured for web deployment
- **Material Design**: Custom color scheme with purple/blue gradient theme
- **Responsive Design**: Adapts to different screen sizes
- **Error Handling**: Comprehensive error handling with user-friendly messages

### Dependencies
Key packages used:
- `provider`: State management
- `http`: API communication
- `cached_network_image`: Image caching
- `shimmer`: Loading animations
- `flutter_staggered_animations`: Staggered list animations
- `google_fonts`: Custom fonts (Poppins)

### Testing
- Widget tests are in `test/widget_test.dart`
- Run tests with `flutter test`
- Analysis configured in `analysis_options.yaml` with Flutter lints

### Platform Colors and Branding
The app includes specific branding for supported platforms:
- Zepto: Purple (#6C5CE7)
- Blinkit: Yellow (#FFB800)  
- Swiggy: Orange (#FC8019)