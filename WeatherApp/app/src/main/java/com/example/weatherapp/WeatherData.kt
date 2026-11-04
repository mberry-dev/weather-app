package com.example.weatherapp

// A place found by the geocoding search (one of up to five matches for a city name)
data class Place(
    val name: String,
    val region: String?,
    val countryCode: String,
    val latitude: Double,
    val longitude: Double
)

// A same-name match the user can switch to
data class Alternative(
    val index: Int,
    val label: String
)

// Current weather for one place, as returned by the OpenWeatherMap API.
// Temperatures are Celsius, wind is metres per second, visibility is metres.
data class WeatherData(
    val placeName: String,
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
