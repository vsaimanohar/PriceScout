import 'package:flutter/material.dart';

class Product {
  final int id;
  final String name;
  final String category;
  final String? imageUrl;
  final List<Price> prices;

  Product({
    required this.id,
    required this.name,
    required this.category,
    this.imageUrl,
    this.prices = const [],
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'],
      name: json['name'],
      category: json['category'] ?? '',
      imageUrl: json['image_url'],
      prices: json['prices'] != null 
        ? (json['prices'] as List).map((p) => Price.fromJson(p)).toList()
        : [],
    );
  }
}

class Price {
  final int id;
  final String platform;
  final double price;
  final String? url;
  final bool inStock;
  final DateTime scrapedAt;

  Price({
    required this.id,
    required this.platform,
    required this.price,
    this.url,
    this.inStock = true,
    required this.scrapedAt,
  });

  factory Price.fromJson(Map<String, dynamic> json) {
    return Price(
      id: json['id'],
      platform: json['platform'],
      price: json['price'].toDouble(),
      url: json['url'],
      inStock: json['in_stock'] == 1,
      scrapedAt: DateTime.parse(json['scraped_at']),
    );
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
        return platform;
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
}