package com.example.weatherapp

import org.junit.Assert.assertEquals
import org.junit.Test

// These mirror web/tests/weather.test.js value for value. If the two apps ever format a number
// differently, one of these suites fails.
class WeatherFormatTest {

    @Test fun convertsCelsiusToFahrenheit() {
        assertEquals(32.0, WeatherFormat.toFahrenheit(0.0), 0.0001)
        assertEquals(212.0, WeatherFormat.toFahrenheit(100.0), 0.0001)
        assertEquals(-40.0, WeatherFormat.toFahrenheit(-40.0), 0.0001)
        assertEquals(98.6, WeatherFormat.toFahrenheit(37.0), 0.0001)
    }

    @Test fun temperatureIsRoundedNotCutOff() {
        assertEquals("8°C", WeatherFormat.temp(8.4, false))
        assertEquals("9°C", WeatherFormat.temp(8.6, false))
        assertEquals("47°F", WeatherFormat.temp(8.4, true))
        assertEquals("48°F", WeatherFormat.temp(8.8, true))
        assertEquals("32°F", WeatherFormat.temp(0.0, true))
    }

    @Test fun neverShowsNegativeZero() {
        assertEquals("0°C", WeatherFormat.temp(-0.3, false))
        assertEquals("0°F", WeatherFormat.temp(-17.8, true))
    }

    @Test fun keepsRealNegatives() {
        assertEquals("-5°C", WeatherFormat.temp(-5.4, false))
    }

    @Test fun windIsMphInFahrenheitAndKmhInCelsius() {
        assertEquals("22 mph", WeatherFormat.wind(10.0, true))
        assertEquals("36 km/h", WeatherFormat.wind(10.0, false))
        assertEquals("0 km/h", WeatherFormat.wind(0.0, false))
        assertEquals("10 mph", WeatherFormat.wind(4.5, true))
    }

    @Test fun visibilityIsMilesOrKilometresWithOneDecimalAtMost() {
        assertEquals("24.1 km", WeatherFormat.visibility(24140, false))
        assertEquals("15 mi", WeatherFormat.visibility(24140, true))
        assertEquals("0.5 km", WeatherFormat.visibility(500, false))
        assertEquals("10 km", WeatherFormat.visibility(10000, false))
    }

    @Test fun pressureAndHumidity() {
        assertEquals("1019 hPa", WeatherFormat.pressure(1019))
        assertEquals("71%", WeatherFormat.humidity(71))
    }

    @Test fun highAndLowUseTwoSpaces() {
        assertEquals("H: 53°F  L: 38°F", WeatherFormat.highLow(11.6, 3.4, true))
        assertEquals("H: 12°C  L: 3°C", WeatherFormat.highLow(11.6, 3.4, false))
    }

    @Test fun locationHasRegionAndCountryName() {
        assertEquals("Detroit, Michigan, United States", WeatherFormat.location("Detroit", "Michigan", "US"))
        assertEquals("Detroit, Oregon, United States", WeatherFormat.location("Detroit", "Oregon", "US"))
    }

    @Test fun locationSkipsRepeatedOrMissingRegion() {
        assertEquals("Singapore, Singapore", WeatherFormat.location("Singapore", "Singapore", "SG"))
        assertEquals("Paris, France", WeatherFormat.location("Paris", null, "FR"))
        assertEquals("Paris, France", WeatherFormat.location("Paris", "", "FR"))
    }

    @Test fun unknownCountryCodeFallsBackToTheCode() {
        assertEquals("Nowhere, !!", WeatherFormat.location("Nowhere", null, "!!"))
        assertEquals("Nowhere", WeatherFormat.location("Nowhere", null, ""))
    }
}
