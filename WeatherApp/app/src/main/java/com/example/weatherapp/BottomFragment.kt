package com.example.weatherapp

import android.content.res.ColorStateList
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import com.bumptech.glide.Glide
import com.google.android.material.button.MaterialButton

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
    private lateinit var othersTitle: TextView
    private lateinit var othersList: LinearLayout

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
        othersTitle     = view.findViewById(R.id.othersTitle)
        othersList      = view.findViewById(R.id.othersList)

        return view
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        viewModel.isLoading.observe(viewLifecycleOwner) { loading ->
            progressBar.visibility = if (loading) View.VISIBLE else View.GONE
            updatePlaceholder()
        }

        // Observe both weather data and unit toggle — update UI when either changes
        viewModel.weatherData.observe(viewLifecycleOwner) { data ->
            if (data != null) showWeather(data, viewModel.isFahrenheit.value ?: true)
            else showPlaceholder()
            updatePlaceholder()
        }

        viewModel.isFahrenheit.observe(viewLifecycleOwner) { isFahrenheit ->
            val data = viewModel.weatherData.value
            if (data != null) showWeather(data, isFahrenheit)
        }

        viewModel.alternatives.observe(viewLifecycleOwner) { alternatives ->
            showAlternatives(alternatives)
        }
    }

    // The placeholder shows only before the first result, and not while a search is loading
    private fun updatePlaceholder() {
        val noWeather = viewModel.weatherData.value == null
        val loading = viewModel.isLoading.value == true
        placeholderText.visibility = if (noWeather && !loading) View.VISIBLE else View.GONE
    }

    private fun showWeather(data: WeatherData, isFahrenheit: Boolean) {
        weatherIcon.visibility     = View.VISIBLE
        cityNameText.visibility    = View.VISIBLE

        cityNameText.text    = data.placeName
        temperatureText.text = WeatherFormat.temp(data.temperature, isFahrenheit)
        descriptionText.text = data.description
        feelsLikeText.text   = WeatherFormat.temp(data.feelsLike, isFahrenheit)
        humidityText.text    = WeatherFormat.humidity(data.humidity)
        windSpeedText.text   = WeatherFormat.wind(data.windSpeed, isFahrenheit)
        highLowText.text     = WeatherFormat.highLow(data.high, data.low, isFahrenheit)
        pressureText.text    = WeatherFormat.pressure(data.pressure)
        visibilityText.text  = WeatherFormat.visibility(data.visibility, isFahrenheit)

        val iconUrl = "https://openweathermap.org/img/wn/${data.iconCode}@2x.png"
        Glide.with(this).load(iconUrl).into(weatherIcon)
    }

    private fun showPlaceholder() {
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

    // "Other matches": one full-width button per same-name place; tapping one shows its weather
    private fun showAlternatives(alternatives: List<Alternative>) {
        othersList.removeAllViews()
        val visibility = if (alternatives.isEmpty()) View.GONE else View.VISIBLE
        othersTitle.visibility = visibility
        othersList.visibility = visibility

        val gap = (6 * resources.displayMetrics.density).toInt()
        for (alternative in alternatives) {
            val button = MaterialButton(requireContext()).apply {
                text = alternative.label
                isAllCaps = false
                gravity = Gravity.START or Gravity.CENTER_VERTICAL
                cornerRadius = 0
                backgroundTintList = ColorStateList.valueOf(Color.parseColor("#BBDEFB"))
                setTextColor(Color.parseColor("#212121"))
                setOnClickListener { viewModel.showMatch(alternative.index) }
            }
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            params.bottomMargin = gap
            othersList.addView(button, params)
        }
    }
}
