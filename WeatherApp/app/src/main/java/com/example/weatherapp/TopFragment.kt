package com.example.weatherapp

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import com.android.volley.Request
import com.android.volley.toolbox.JsonObjectRequest
import com.android.volley.toolbox.Volley

// Top fragment — contains the search bar and fetches weather from OpenWeatherMap API
class TopFragment : Fragment() {

    private val viewModel: WeatherViewModel by activityViewModels()

    private lateinit var cityInput: EditText
    private lateinit var searchButton: Button
    private lateinit var errorText: TextView
    private lateinit var unitToggleButton: Button

    private val API_KEY = BuildConfig.WEATHER_API_KEY

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        val view = inflater.inflate(R.layout.fragment_top, container, false)

        cityInput         = view.findViewById(R.id.cityInput)
        searchButton      = view.findViewById(R.id.searchButton)
        errorText         = view.findViewById(R.id.errorText)
        unitToggleButton  = view.findViewById(R.id.unitToggleButton)

        return view
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Restore last searched city after rotation
        viewModel.lastCity.observe(viewLifecycleOwner) { city ->
            if (!city.isNullOrEmpty()) cityInput.setText(city)
        }

        // Show error messages
        viewModel.errorMessage.observe(viewLifecycleOwner) { error ->
            if (!error.isNullOrEmpty()) {
                errorText.text = error
                errorText.visibility = View.VISIBLE
            } else {
                errorText.visibility = View.GONE
            }
        }

        // Update toggle button label when unit changes
        viewModel.isFahrenheit.observe(viewLifecycleOwner) { isFahrenheit ->
            unitToggleButton.text = if (isFahrenheit) "°F" else "°C"
        }

        // Toggle unit on button click
        unitToggleButton.setOnClickListener {
            viewModel.toggleUnit()
        }

        // Search button click
        searchButton.setOnClickListener {
            val city = cityInput.text.toString().trim()
            if (city.isNotEmpty()) {
                hideKeyboard()
                errorText.visibility = View.GONE
                fetchWeather(city)
            } else {
                errorText.text = "Please enter a city name"
                errorText.visibility = View.VISIBLE
            }
        }

        // Allow pressing Enter on keyboard to search
        cityInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                searchButton.performClick()
                true
            } else false
        }
    }

    private fun fetchWeather(city: String) {
        viewModel.setLoading(true)
        viewModel.setLastCity(city)

        val url = "https://api.openweathermap.org/data/2.5/weather" +
                "?q=$city&appid=$API_KEY&units=metric"

        val queue = Volley.newRequestQueue(requireContext())

        val request = JsonObjectRequest(
            Request.Method.GET, url, null,
            { response ->
                viewModel.setLoading(false)
                try {
                    val main    = response.getJSONObject("main")
                    val wind    = response.getJSONObject("wind")
                    val weather = response.getJSONArray("weather").getJSONObject(0)
                    val sys     = response.getJSONObject("sys")

                    val data = WeatherData(
                        cityName     = response.getString("name"),
                        country      = sys.getString("country"),
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

                    viewModel.setWeatherData(data)
                    viewModel.setError(null)

                } catch (e: Exception) {
                    viewModel.setError("Error reading weather data")
                }
            },
            { error ->
                viewModel.setLoading(false)
                val msg = when (error.networkResponse?.statusCode) {
                    404  -> "City not found. Please check the spelling."
                    401  -> "Invalid API key."
                    else -> "Network error. Please check your connection."
                }
                viewModel.setError(msg)
            }
        )

        queue.add(request)
    }

    private fun hideKeyboard() {
        val imm = requireContext()
            .getSystemService(android.content.Context.INPUT_METHOD_SERVICE)
                as InputMethodManager
        imm.hideSoftInputFromWindow(cityInput.windowToken, 0)
    }
}