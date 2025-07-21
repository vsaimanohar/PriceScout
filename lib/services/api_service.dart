import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/product.dart';

class ApiService {
  static const String baseUrl = 'http://localhost:3000/api';
  
  Future<List<Product>> searchProducts(String query) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/products/search?q=${Uri.encodeComponent(query)}'),
        headers: {'Content-Type': 'application/json'},
      );
      
      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((item) => Product.fromJson(item)).toList();
      } else {
        throw Exception('Failed to search products: ${response.statusCode}');
      }
    } catch (e) {
      print('Error searching products: $e');
      throw Exception('Network error: Unable to search products');
    }
  }
  
  Future<List<String>> getSuggestions(String query) async {
    if (query.isEmpty) return [];
    
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/products/suggestions?q=${Uri.encodeComponent(query)}'),
        headers: {'Content-Type': 'application/json'},
      );
      
      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.cast<String>();
      } else {
        return [];
      }
    } catch (e) {
      print('Error getting suggestions: $e');
      return [];
    }
  }
  
  Future<List<Price>> getProductPrices(int productId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/products/$productId/prices'),
        headers: {'Content-Type': 'application/json'},
      );
      
      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((item) => Price.fromJson(item)).toList();
      } else {
        throw Exception('Failed to get product prices: ${response.statusCode}');
      }
    } catch (e) {
      print('Error getting product prices: $e');
      throw Exception('Network error: Unable to get product prices');
    }
  }
}