import 'package:flutter/material.dart';

class Product {
  final int id;
  final String name;
  final String category;
  final String? imageUrl;
  final List<Price> prices;
  final DateTime? createdAt;

  Product({
    required this.id,
    required this.name,
    required this.category,
    this.imageUrl,
    this.prices = const [],
    this.createdAt,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    List<Price> pricesList = [];
    
    // Handle different JSON structures for prices
    if (json['prices'] is List) {
      pricesList = (json['prices'] as List).map((p) => Price.fromJson(p)).toList();
    } else if (json['prices'] is String && json['prices'].isNotEmpty) {
      // Handle comma-separated price format from backend GROUP_CONCAT
      final pricesString = json['prices'] as String;
      pricesList = pricesString.split(',').map((priceInfo) {
        final parts = priceInfo.split(':');
        if (parts.length == 2) {
          return Price(
            id: 0, // Temporary ID for GROUP_CONCAT format
            platform: parts[0],
            price: double.tryParse(parts[1]) ?? 0.0,
            inStock: true,
            scrapedAt: DateTime.now(),
          );
        }
        return null;
      }).where((p) => p != null).cast<Price>().toList();
    }
    
    return Product(
      id: json['id'],
      name: json['name'],
      category: json['category'] ?? '',
      imageUrl: json['image_url'],
      prices: pricesList,
      createdAt: json['created_at'] != null ? DateTime.parse(json['created_at']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'category': category,
      'image_url': imageUrl,
      'prices': prices.map((p) => p.toJson()).toList(),
      'created_at': createdAt?.toIso8601String(),
    };
  }

  // Price comparison logic
  Price? get cheapestPrice {
    if (prices.isEmpty) return null;
    final inStockPrices = prices.where((p) => p.inStock).toList();
    if (inStockPrices.isEmpty) return prices.isNotEmpty ? prices.first : null;
    return inStockPrices.reduce((a, b) => a.price < b.price ? a : b);
  }

  Price? get mostExpensivePrice {
    if (prices.isEmpty) return null;
    final inStockPrices = prices.where((p) => p.inStock).toList();
    if (inStockPrices.isEmpty) return prices.isNotEmpty ? prices.first : null;
    return inStockPrices.reduce((a, b) => a.price > b.price ? a : b);
  }

  double? get averagePrice {
    final inStockPrices = prices.where((p) => p.inStock).toList();
    if (inStockPrices.isEmpty) return null;
    return inStockPrices.map((p) => p.price).reduce((a, b) => a + b) / inStockPrices.length;
  }

  double? get maxSavings {
    final cheapest = cheapestPrice;
    final expensive = mostExpensivePrice;
    if (cheapest == null || expensive == null) return null;
    return expensive.price - cheapest.price;
  }

  int get availablePlatformsCount => prices.where((p) => p.inStock).length;

  List<Price> get sortedPrices {
    final inStockPrices = prices.where((p) => p.inStock).toList();
    inStockPrices.sort((a, b) => a.price.compareTo(b.price));
    return inStockPrices;
  }

  bool get isAvailable => prices.any((p) => p.inStock);

  // Get price for specific platform
  Price? getPriceForPlatform(String platform) {
    try {
      return prices.firstWhere((p) => p.platform.toLowerCase() == platform.toLowerCase());
    } catch (e) {
      return null;
    }
  }
}

class Price {
  final int id;
  final String platform;
  final double price;
  final String? url;
  final bool inStock;
  final DateTime scrapedAt;
  final double? originalPrice;
  final String? deliveryFee;
  final String? deliveryTime;

  Price({
    required this.id,
    required this.platform,
    required this.price,
    this.url,
    this.inStock = true,
    required this.scrapedAt,
    this.originalPrice,
    this.deliveryFee,
    this.deliveryTime,
  });

  factory Price.fromJson(Map<String, dynamic> json) {
    return Price(
      id: json['id'] ?? 0,
      platform: json['platform'] ?? '',
      price: (json['price'] ?? 0).toDouble(),
      url: json['url'],
      inStock: json['in_stock'] == 1 || json['in_stock'] == true,
      scrapedAt: json['scraped_at'] != null 
        ? DateTime.parse(json['scraped_at'])
        : DateTime.now(),
      originalPrice: json['original_price']?.toDouble(),
      deliveryFee: json['delivery_fee'],
      deliveryTime: json['delivery_time'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'platform': platform,
      'price': price,
      'url': url,
      'in_stock': inStock,
      'scraped_at': scrapedAt.toIso8601String(),
      'original_price': originalPrice,
      'delivery_fee': deliveryFee,
      'delivery_time': deliveryTime,
    };
  }

  String get platformDisplayName {
    switch (platform.toLowerCase()) {
      case 'zepto':
        return 'Zepto';
      case 'blinkit':
        return 'Blinkit';
      case 'swiggy':
        return 'Swiggy Instamart';
      default:
        return platform.replaceAll('_', ' ').split(' ').map((word) => 
          word.isNotEmpty ? word[0].toUpperCase() + word.substring(1) : word
        ).join(' ');
    }
  }

  Color get platformColor {
    switch (platform.toLowerCase()) {
      case 'zepto':
        return const Color(0xFF6C5CE7);
      case 'blinkit':
        return const Color(0xFFFFB800);
      case 'swiggy':
        return const Color(0xFFFC8019);
      default:
        return const Color(0xFF636E72);
    }
  }

  String get platformLogo {
    switch (platform.toLowerCase()) {
      case 'zepto':
        return 'assets/icons/zepto.png';
      case 'blinkit':
        return 'assets/icons/blinkit.png';
      case 'swiggy':
        return 'assets/icons/swiggy.png';
      default:
        return 'assets/icons/default_store.png';
    }
  }

  String get formattedPrice => '₹${price.toStringAsFixed(2)}';

  String get formattedOriginalPrice => originalPrice != null ? '₹${originalPrice!.toStringAsFixed(2)}' : '';

  bool get hasDiscount => originalPrice != null && originalPrice! > price;

  double get discountPercentage => hasDiscount ? ((originalPrice! - price) / originalPrice!) * 100 : 0.0;

  String get discountText => hasDiscount ? '${discountPercentage.toStringAsFixed(0)}% OFF' : '';

  String get deliveryTimeDisplay => deliveryTime ?? '30-40 mins';

  String get deliveryFeeDisplay => deliveryFee ?? 'Free';

  bool get isFreeDelivery => deliveryFee == null || deliveryFee == 'Free' || deliveryFee == '0';

  // Calculate total price including delivery
  double get totalPrice {
    double deliveryAmount = 0.0;
    if (deliveryFee != null && deliveryFee != 'Free') {
      deliveryAmount = double.tryParse(deliveryFee!.replaceAll(RegExp(r'[^\d.]'), '')) ?? 0.0;
    }
    return price + deliveryAmount;
  }

  String get formattedTotalPrice => '₹${totalPrice.toStringAsFixed(2)}';

  // Check how fresh the price data is
  bool get isDataFresh => DateTime.now().difference(scrapedAt).inHours < 24;

  String get dataFreshnessText {
    final hoursDiff = DateTime.now().difference(scrapedAt).inHours;
    if (hoursDiff < 1) return 'Updated recently';
    if (hoursDiff < 24) return 'Updated ${hoursDiff}h ago';
    return 'Updated ${DateTime.now().difference(scrapedAt).inDays}d ago';
  }
}