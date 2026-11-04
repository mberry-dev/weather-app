package com.example.weatherapp

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import com.android.volley.ParseError
import com.android.volley.Request
import com.android.volley.RequestQueue
import com.android.volley.VolleyError
import com.android.volley.toolbox.JsonArrayRequest
import com.android.volley.toolbox.JsonObjectRequest
import com.android.volley.toolbox.Volley
import java.net.URLEncoder

// Holds the weather state and does the searching. Because it lives in the ViewModel, a search keeps
// going and the screen keeps its data when the phone is rotated. It also remembers the last city and the
// unit between launches, like the web version does.
class WeatherViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences("weather_prefs", Context.MODE_PRIVATE)
    private val queue: RequestQueue by lazy { Volley.newRequestQueue(application) }
    private val apiKey = BuildConfig.WEATHER_API_KEY

    // Current weather data
    private val _weatherData = MutableLiveData<WeatherData?>()
    val weatherData: LiveData<WeatherData?> = _weatherData

    // Loading state
    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    // Error message
    private val _errorMessage = MutableLiveData<String?>()
    val errorMessage: LiveData<String?> = _errorMessage

    // Last searched city, shown in the search box
    private val _lastCity = MutableLiveData<String>()
    val lastCity: LiveData<String> = _lastCity

    // Unit toggle: true = Fahrenheit, false = Celsius. Remembered between launches.
    private val _isFahrenheit = MutableLiveData(prefs.getString(KEY_UNIT, "F") != "C")
    val isFahrenheit: LiveData<Boolean> = _isFahrenheit

    // Other places with the same name as the one being shown (for example Detroit, Oregon)
    private val _alternatives = MutableLiveData<List<Alternative>>(emptyList())
    val alternatives: LiveData<List<Alternative>> = _alternatives

    private var matches: List<Place> = emptyList()

    // Each search gets a number; an answer from an older search is ignored, so results never arrive out of order
    private var requestId = 0

    init {
        // Come back to the last city
        val saved = prefs.getString(KEY_CITY, null)
        if (!saved.isNullOrBlank()) search(saved)
    }

    fun toggleUnit() {
        val next = !(_isFahrenheit.value ?: true)
        _isFahrenheit.value = next
        prefs.edit().putString(KEY_UNIT, if (next) "F" else "C").apply()
    }

    // Looks the city up, then loads the weather for the best match
    fun search(rawCity: String) {
        val city = rawCity.trim()
        if (city.isEmpty()) {
            _errorMessage.value = WeatherFormat.MSG_EMPTY
            return
        }
        if (city.length < 2) {
            _errorMessage.value = WeatherFormat.MSG_TOO_SHORT
            return
        }

        val id = startRequest()
        _lastCity.value = city

        val url = "https://api.openweathermap.org/geo/1.0/direct" +
                "?q=${URLEncoder.encode(city, "UTF-8")}&limit=5&appid=$apiKey"

        val request = JsonArrayRequest(
            Request.Method.GET, url, null,
            { response ->
                if (id == requestId) {
                    try {
                        val found = (0 until response.length()).map { i ->
                            val item = response.getJSONObject(i)
                            Place(
                                name        = item.getString("name"),
                                region      = item.optString("state").ifBlank { null },
                                countryCode = item.optString("country"),
                                latitude    = item.getDouble("lat"),
                                longitude   = item.getDouble("lon")
                            )
                        }
                        if (found.isEmpty()) {
                            fail(WeatherFormat.MSG_NOT_FOUND)
                        } else {
                            loadWeather(found, 0, id, city)
                        }
                    } catch (e: Exception) {
                        fail(WeatherFormat.MSG_DATA)
                    }
                }
            },
            { error -> if (id == requestId) fail(messageFor(error)) }
        )
        request.tag = TAG
        queue.add(request)
    }

    // Switches to one of the other same-name places
    fun showMatch(index: Int) {
        if (index !in matches.indices) return
        val id = startRequest()
        loadWeather(matches, index, id, null)
    }

    private fun loadWeather(found: List<Place>, index: Int, id: Int, rememberCity: String?) {
        val place = found[index]
        val url = "https://api.openweathermap.org/data/2.5/weather" +
                "?lat=${place.latitude}&lon=${place.longitude}&appid=$apiKey&units=metric"

        val request = JsonObjectRequest(
            Request.Method.GET, url, null,
            { response ->
                if (id == requestId) {
                    try {
                        val main    = response.getJSONObject("main")
                        val wind    = response.getJSONObject("wind")
                        val weather = response.getJSONArray("weather").getJSONObject(0)

                        val data = WeatherData(
                            placeName    = WeatherFormat.location(place.name, place.region, place.countryCode),
                            temperature  = main.getDouble("temp"),
                            feelsLike    = main.getDouble("feels_like"),
                            humidity     = main.getInt("humidity"),
                            windSpeed    = wind.getDouble("speed"),
                            description  = weather.getString("description")
                                .replaceFirstChar { it.uppercase() },
                            iconCode     = weather.getString("icon"),
                            high         = main.getDouble("temp_max"),
                            low          = main.getDouble("temp_min"),
                            pressure     = main.getInt("pressure"),
                            visibility   = response.optInt("visibility", 0)
                        )

                        matches = found
                        _alternatives.value = found.mapIndexed { i, p ->
                            Alternative(i, WeatherFormat.location(p.name, p.region, p.countryCode))
                        }.filter { it.index != index }
                        _weatherData.value = data
                        _errorMessage.value = null
                        _isLoading.value = false
                        if (rememberCity != null) prefs.edit().putString(KEY_CITY, rememberCity).apply()
                    } catch (e: Exception) {
                        fail(WeatherFormat.MSG_DATA)
                    }
                }
            },
            { error -> if (id == requestId) fail(messageFor(error)) }
        )
        request.tag = TAG
        queue.add(request)
    }

    // Cancels any search in progress and starts a new numbered one
    private fun startRequest(): Int {
        queue.cancelAll(TAG)
        requestId++
        _isLoading.value = true
        _errorMessage.value = null
        return requestId
    }

    private fun fail(message: String) {
        _isLoading.value = false
        _errorMessage.value = message
    }

    private fun messageFor(error: VolleyError): String = when {
        error.networkResponse?.statusCode == 401 -> WeatherFormat.MSG_KEY
        error.networkResponse?.statusCode == 404 -> WeatherFormat.MSG_NOT_FOUND
        error is ParseError -> WeatherFormat.MSG_DATA
        else -> WeatherFormat.MSG_NETWORK
    }

    override fun onCleared() {
        queue.cancelAll(TAG)
        super.onCleared()
    }

    private companion object {
        const val TAG = "weather"
        const val KEY_UNIT = "unit"
        const val KEY_CITY = "city"
    }
}
