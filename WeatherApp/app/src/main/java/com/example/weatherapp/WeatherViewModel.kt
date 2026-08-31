package com.example.weatherapp

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel

// ViewModel holds weather data across orientation changes
class WeatherViewModel : ViewModel() {

    // Current weather data
    private val _weatherData = MutableLiveData<WeatherData?>()
    val weatherData: LiveData<WeatherData?> = _weatherData

    // Loading state
    private val _isLoading = MutableLiveData<Boolean>()
    val isLoading: LiveData<Boolean> = _isLoading

    // Error message
    private val _errorMessage = MutableLiveData<String?>()
    val errorMessage: LiveData<String?> = _errorMessage

    // Last searched city — retained across rotation
    private val _lastCity = MutableLiveData<String>()
    val lastCity: LiveData<String> = _lastCity

    // Unit toggle — true = Fahrenheit, false = Celsius
    private val _isFahrenheit = MutableLiveData<Boolean>(true)
    val isFahrenheit: LiveData<Boolean> = _isFahrenheit

    fun setWeatherData(data: WeatherData?) {
        _weatherData.value = data
    }

    fun setLoading(loading: Boolean) {
        _isLoading.value = loading
    }

    fun setError(message: String?) {
        _errorMessage.value = message
    }

    fun setLastCity(city: String) {
        _lastCity.value = city
    }

    // Toggle between Fahrenheit and Celsius
    fun toggleUnit() {
        _isFahrenheit.value = !(_isFahrenheit.value ?: true)
    }
}