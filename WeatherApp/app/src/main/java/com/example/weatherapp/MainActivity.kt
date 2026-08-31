package com.example.weatherapp

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

// Host activity — loads the layout containing both fragments
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
    }
}