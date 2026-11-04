package com.example.weatherapp

import java.util.Locale
import kotlin.math.roundToInt

// How weather values are shown on screen. Pure functions with no Android or network code, so they can be unit tested.
// The web version (web/src/weather.js) uses the same rules and the same wording, and both have tests for them:
// Fahrenheit shows mph and miles, Celsius shows km/h and km, and everything is rounded, never cut off.
object WeatherFormat {

    // Messages shown to the user (same wording as the web version, plus the API key message that only Android needs)
    const val MSG_EMPTY = "Please enter a city name"
    const val MSG_TOO_SHORT = "Enter at least two characters."
    const val MSG_NOT_FOUND = "City not found. Please check the spelling."
    const val MSG_NETWORK = "Network error. Please check your connection."
    const val MSG_DATA = "Error reading weather data"
    const val MSG_KEY = "Invalid API key."

    fun toFahrenheit(celsius: Double): Double = celsius * 9 / 5 + 32

    // "47°F" or "8°C". Input is always Celsius.
    fun temp(celsius: Double, fahrenheit: Boolean): String =
        if (fahrenheit) "${toFahrenheit(celsius).roundToInt()}°F" else "${celsius.roundToInt()}°C"

    // Wind speed arrives in metres per second. Fahrenheit shows mph, Celsius shows km/h.
    fun wind(metresPerSecond: Double, fahrenheit: Boolean): String =
        if (fahrenheit) "${(metresPerSecond * 2.236936).roundToInt()} mph"
        else "${(metresPerSecond * 3.6).roundToInt()} km/h"

    // Visibility arrives in metres. Fahrenheit shows miles, Celsius shows kilometres, one decimal at most.
    fun visibility(metres: Int, fahrenheit: Boolean): String {
        val value = if (fahrenheit) metres / 1609.344 else metres / 1000.0
        val rounded = Math.round(value * 10) / 10.0
        val text = if (rounded == Math.floor(rounded)) rounded.toInt().toString() else rounded.toString()
        return "$text ${if (fahrenheit) "mi" else "km"}"
    }

    fun pressure(hectopascals: Int): String = "$hectopascals hPa"

    fun humidity(percent: Int): String = "$percent%"

    fun highLow(high: Double, low: Double, fahrenheit: Boolean): String =
        "H: ${temp(high, fahrenheit)}  L: ${temp(low, fahrenheit)}"

    // "Detroit, Michigan, United States". Skips a region that repeats the name (Singapore, Singapore).
    fun location(name: String, region: String?, countryCode: String): String {
        val parts = mutableListOf(name)
        if (!region.isNullOrBlank() && region != name) parts.add(region)
        val country = countryName(countryCode)
        if (country.isNotBlank()) parts.add(country)
        return parts.joinToString(", ")
    }

    // "US" -> "United States". Falls back to the code itself if it isn't a known country.
    fun countryName(code: String): String {
        if (code.isBlank()) return ""
        return try {
            val name = Locale.Builder().setRegion(code).build().getDisplayCountry(Locale.ENGLISH)
            if (name.isBlank()) code else name
        } catch (e: Exception) {
            code
        }
    }
}
