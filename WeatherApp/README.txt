WeatherApp
CIS 436 - Mobile Application Development
University of Michigan - Dearborn
Professor: John P. Baugh

Team Member:
- Hamou

========================================
PROJECT DESCRIPTION
========================================
A real-time weather application that allows users to search for current
weather conditions for any city in the world. The app uses the
OpenWeatherMap API to retrieve live weather data and displays it in a
clean, easy-to-read interface with a blue theme.

Features:
- Search for weather by city name
- Displays temperature, weather icon, description, humidity, wind speed,
  feels like, pressure, visibility, and daily high/low
- Toggle between Fahrenheit and Celsius
- Weather data retained across orientation changes using ViewModel
- Error handling for invalid city names or network issues
- Loading spinner while data is being fetched

========================================
TECHNICAL REQUIREMENTS MET
========================================
- Language: Kotlin
- Widgets: EditText, Button, TextView, ImageView, ProgressBar, GridLayout
- Fragments: TopFragment (search), BottomFragment (weather info)
- Jetpack: ViewModel + LiveData for state management
- Web Service: OpenWeatherMap API via Volley HTTP library

========================================
PROJECT STRUCTURE
========================================
WeatherApp/
├── WeatherApp_TestPlan.xlsx         <- Test plan (3 days)
├── WeatherApp_Description.docx      <- Project description with screenshots
├── README.txt                       <- This file
├── app/
│   └── src/main/
│       ├── java/com/example/weatherapp/
│       │   ├── MainActivity.kt      <- Host activity
│       │   ├── TopFragment.kt       <- Search bar + API calls
│       │   ├── BottomFragment.kt    <- Weather display
│       │   ├── WeatherViewModel.kt  <- Jetpack ViewModel
│       │   └── WeatherData.kt       <- Data class
│       ├── res/layout/
│       │   ├── activity_main.xml
│       │   ├── fragment_top.xml
│       │   └── fragment_bottom.xml
│       └── AndroidManifest.xml
├── gradle/
│   ├── libs.versions.toml
│   └── wrapper/
│       └── gradle-wrapper.properties
├── build.gradle.kts                 <- Root gradle
├── app/build.gradle.kts             <- App gradle
├── gradle.properties                <- API key stored here (never hardcoded)
├── gradlew
└── gradlew.bat

========================================
BUILD INSTRUCTIONS
========================================
1. Open Android Studio
2. Click File -> Open and navigate to the WeatherApp folder
3. Wait for Gradle sync to complete
4. Select a device or emulator (API 24+)
5. Click the green Run button

Build requirements:
- Android Studio Hedgehog or newer
- AGP 9.0.0
- Gradle 9.1.0
- Minimum SDK: API 24
- Target SDK: API 35

========================================
API KEY
========================================
The OpenWeatherMap API key is stored in gradle.properties as:
WEATHER_API_KEY=<key>

It is accessed in the app via BuildConfig.WEATHER_API_KEY.
The API key is never hardcoded in source files.

========================================
NOTES
========================================
- Internet permission is required and declared in AndroidManifest.xml
- The app uses metric units from the API and converts to Fahrenheit in-app
- Weather icons are loaded from OpenWeatherMap's icon CDN using Glide
- The ViewModel retains all state (weather data, unit preference, last
  searched city) across orientation changes without re-fetching from API