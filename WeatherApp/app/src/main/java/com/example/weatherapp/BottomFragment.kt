package com.example.weatherapp

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import com.bumptech.glide.Glide

// Bottom fragment — displays weather information for the searched city
class BottomFragment : Fragment() {

    private val viewModel: WeatherViewModel by activityViewModels()

    private lateinit var progressBar: ProgressBar
    private lateinit var weatherIcon: ImageView
    private lateinit var cityNameText: TextView
    private lateinit var temperatureText: TextView
    private lateinit var descriptionText: TextView
    private lateinit var feelsLikeText: TextView
    private lateinit var humidityText: TextView
    private lateinit var windSpeedText: TextView
    private lateinit var highLowText: TextView
    private lateinit var pressureText: TextView
    private lateinit var visibilityText: TextView
    private lateinit var placeholderText: TextView

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        val view = inflater.inflate(R.layout.fragment_bottom, container, false)

        progressBar     = view.findViewById(R.id.progressBar)
        weatherIcon     = view.findViewById(R.id.weatherIcon)
        cityNameText    = view.findViewById(R.id.cityNameText)
        temperatureText = view.findViewById(R.id.temperatureText)
        descriptionText = view.findViewById(R.id.descriptionText)
        feelsLikeText   = view.findViewById(R.id.feelsLikeText)
        humidityText    = view.findViewById(R.id.humidityText)
        windSpeedText   = view.findViewById(R.id.windSpeedText)
        highLowText     = view.findViewById(R.id.highLowText)
        pressureText    = view.findViewById(R.id.pressureText)
        visibilityText  = view.findViewById(R.id.visibilityText)
        placeholderText = view.findViewById(R.id.placeholderText)

        return view
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        viewModel.isLoading.observe(viewLifecycleOwner) { loading ->
            progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        }

        // Observe both weather data and unit toggle — update UI when either changes
        viewModel.weatherData.observe(viewLifecycleOwner) { data ->
            if (data != null) showWeather(data, viewModel.isFahrenheit.value ?: true)
            else showPlaceholder()
        }

        viewModel.isFahrenheit.observe(viewLifecycleOwner) { isFahrenheit ->
            val data = viewModel.weatherData.value
            if (data != null) showWeather(data, isFahrenheit)
        }
    }

    // Convert Celsius to Fahrenheit
    private fun toFahrenheit(celsius: Double): Int {
        return ((celsius * 9 / 5) + 32).toInt()
    }

    // Format temperature with correct unit symbol
    private fun formatTemp(celsius: Double, isFahrenheit: Boolean): String {
        return if (isFahrenheit) "${toFahrenheit(celsius)}°F"
        else "${celsius.toInt()}°C"
    }

    private fun showWeather(data: WeatherData, isFahrenheit: Boolean) {
        placeholderText.visibility = View.GONE
        weatherIcon.visibility     = View.VISIBLE
        cityNameText.visibility    = View.VISIBLE

        cityNameText.text    = "${data.cityName}, ${data.country}"
        temperatureText.text = formatTemp(data.temperature, isFahrenheit)
        descriptionText.text = data.description
        feelsLikeText.text   = "Feels like: ${formatTemp(data.feelsLike, isFahrenheit)}"
        humidityText.text    = "Humidity: ${data.humidity}%"
        windSpeedText.text   = "Wind: ${data.windSpeed} m/s"
        highLowText.text     = "H: ${formatTemp(data.high, isFahrenheit)}  " +
                "L: ${formatTemp(data.low, isFahrenheit)}"
        pressureText.text    = "Pressure: ${data.pressure} hPa"
        visibilityText.text  = "Visibility: ${data.visibility / 1000} km"

        val iconUrl = "https://openweathermap.org/img/wn/${data.iconCode}@2x.png"
        Glide.with(this).load(iconUrl).into(weatherIcon)
    }

    private fun showPlaceholder() {
        placeholderText.visibility = View.VISIBLE
        weatherIcon.visibility     = View.GONE
        cityNameText.visibility    = View.GONE
        temperatureText.text       = ""
        descriptionText.text       = ""
        feelsLikeText.text         = ""
        humidityText.text          = ""
        windSpeedText.text         = ""
        highLowText.text           = ""
        pressureText.text          = ""
        visibilityText.text        = ""
    }
}