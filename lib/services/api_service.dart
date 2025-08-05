import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/product.dart';

class ApiException implements Exception {
  final String message;
  final int statusCode;
  
  ApiException(this.message, this.statusCode);
  
  @override
  String toString() => 'ApiException: $message (Status: $statusCode)';
}

class ApiService {
  static const String baseUrl = 'https://qecpricetracker-production.up.railway.app/api';
  static const Duration timeoutDuration = Duration(seconds: 300); // 3 minutes for scraping
  
  Future<List<Product>> searchProducts(String query) async {
    if (query.trim().isEmpty) return [];
    
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/products/search?q=${Uri.encodeComponent(query)}'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ).timeout(timeoutDuration);
      
      if (response.statusCode == 200) {
        final dynamic responseBody = json.decode(response.body);
        
        // Handle both old format (direct array) and new format (object with products array)
        final List<dynamic> data;
        if (responseBody is Map<String, dynamic> && responseBody.containsKey('products')) {
          // New format with debug info
          data = responseBody['products'] as List<dynamic>;
          print('API Debug: ${responseBody['debug']}'); // Log debug info for development
        } else if (responseBody is List) {
          // Old format - direct array
          data = responseBody;
        } else {
          print('Unexpected response format: $responseBody');
          return [];
        }
        
        return data.map((item) => Product.fromJson(item)).toList();
      } else if (response.statusCode == 404) {
        return []; // No products found
      } else {
        throw ApiException('Search failed', response.statusCode);
      }
    } on TimeoutException {
      throw ApiException('Search request timed out', 408);
    } catch (e) {
      if (e is ApiException) rethrow;
      print('Error searching products: $e');
      throw ApiException('Unable to search products. Please check your connection.', 500);
    }
  }

  Future<List<Product>> getPopularProducts({int limit = 20}) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/products/popular?limit=$limit'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ).timeout(timeoutDuration);
      
      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((item) => Product.fromJson(item)).toList();
      } else if (response.statusCode == 404) {
        return [];
      } else {
        throw ApiException('Failed to fetch popular products', response.statusCode);
      }
    } on TimeoutException {
      throw ApiException('Request timed out', 408);
    } catch (e) {
      if (e is ApiException) rethrow;
      print('Error fetching popular products: $e');
      throw ApiException('Unable to fetch popular products', 500);
    }
  }
  
  // COMMENTED OUT: Auto-suggestions disabled to prevent excessive API calls
  // Future<List<String>> getSuggestions(String query) async {
  //   if (query.trim().isEmpty) return [];
  //   
  //   try {
  //     final response = await http.get(
  //       Uri.parse('$baseUrl/products/suggestions?q=${Uri.encodeComponent(query)}'),
  //       headers: {
  //         'Content-Type': 'application/json',
  //         'Accept': 'application/json',
  //       },
  //     ).timeout(timeoutDuration);
  //     
  //     if (response.statusCode == 200) {
  //       final List<dynamic> data = json.decode(response.body);
  //       return data.cast<String>();
  //     } else if (response.statusCode == 404) {
  //       return [];
  //     } else {
  //       print('Suggestions request failed: ${response.statusCode}');
  //       return [];
  //     }
  //   } on TimeoutException {
  //     print('Suggestions request timed out');
  //     return [];
  //   } catch (e) {
  //     print('Error getting suggestions: $e');
  //     return [];
  //   }
  // }
  
  // Temporary replacement that returns empty suggestions
  Future<List<String>> getSuggestions(String query) async {
    return []; // Always return empty to disable auto-suggestions
  }
  
  Future<List<Price>> getProductPrices(int productId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/products/$productId/prices'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ).timeout(timeoutDuration);
      
      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((item) => Price.fromJson(item)).toList();
      } else if (response.statusCode == 404) {
        return [];
      } else {
        throw ApiException('Failed to get product prices', response.statusCode);
      }
    } on TimeoutException {
      throw ApiException('Request timed out', 408);
    } catch (e) {
      if (e is ApiException) rethrow;
      print('Error getting product prices: $e');
      throw ApiException('Unable to get product prices', 500);
    }
  }
  
  // Check if the API is reachable
  Future<bool> isApiHealthy() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/health'),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 5));
      
      return response.statusCode == 200;
    } catch (e) {
      print('API health check failed: $e');
      return false;
    }
  }
  
  // Get trending/featured products
  Future<List<Product>> getTrendingProducts({int limit = 10}) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/products/trending?limit=$limit'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ).timeout(timeoutDuration);
      
      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((item) => Product.fromJson(item)).toList();
      } else {
        // Fallback to popular products if trending endpoint doesn't exist
        return await getPopularProducts(limit: limit);
      }
    } catch (e) {
      print('Error fetching trending products: $e');
      // Fallback to popular products
      return await getPopularProducts(limit: limit);
    }
  }
  
  // Trigger live scraping for a product
  Future<Map<String, dynamic>> scrapeLiveData(String productName) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/scrape/live/${Uri.encodeComponent(productName)}'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ).timeout(const Duration(seconds: 300)); // 3 minutes timeout for scraping
      
      if (response.statusCode == 200) {
        return json.decode(response.body);
      } else {
        throw ApiException('Failed to scrape live data', response.statusCode);
      }
    } on TimeoutException {
      throw ApiException('Scraping request timed out', 408);
    } catch (e) {
      if (e is ApiException) rethrow;
      print('Error scraping live data: $e');
      throw ApiException('Unable to scrape live data', 500);
    }
  }
}