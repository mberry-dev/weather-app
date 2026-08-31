package com.example.weatherapp

// Data class representing weather information returned from OpenWeatherMap API
data class WeatherData(
    val cityName: String,
    val country: String,
    val temperature: Double,
    val feelsLike: Double,
    val humidity: Int,
    val windSpeed: Double,
    val description: String,
    val iconCode: String,
    val high: Double,
    val low: Double,
    val pressure: Int,
    val visibility: Int
)