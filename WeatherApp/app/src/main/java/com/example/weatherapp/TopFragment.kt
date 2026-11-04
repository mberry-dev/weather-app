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
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels

// Top fragment — the search bar, unit toggle and error message. The searching itself is done in WeatherViewModel.
class TopFragment : Fragment() {

    private val viewModel: WeatherViewModel by activityViewModels()

    private lateinit var cityInput: EditText
    private lateinit var searchButton: Button
    private lateinit var errorText: TextView
    private lateinit var unitToggleButton: Button

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

        // Keep the blue header out from under the status bar and camera cutout
        // (Android 15+ draws apps edge to edge, so the clock and icons would overlap the title)
        val basePaddingTop = view.paddingTop
        ViewCompat.setOnApplyWindowInsetsListener(view) { v, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            v.updatePadding(top = basePaddingTop + bars.top)
            insets
        }

        // Show the last searched city (after rotation, or from the previous launch)
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
            hideKeyboard()
            viewModel.search(cityInput.text.toString())
        }

        // Allow pressing Enter on keyboard to search
        cityInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                searchButton.performClick()
                true
            } else false
        }
    }

    private fun hideKeyboard() {
        val imm = requireContext()
            .getSystemService(android.content.Context.INPUT_METHOD_SERVICE)
                as InputMethodManager
        imm.hideSoftInputFromWindow(cityInput.windowToken, 0)
    }
}
