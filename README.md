# Weather App (Android)

An Android app that shows the current weather for any city in the world. Search by city name and see the temperature, conditions, humidity, wind and more, in Fahrenheit or Celsius.

Built in Kotlin for CIS 436 (Mobile Application Development) at the University of Michigan-Dearborn. Weather data comes from the [OpenWeatherMap](https://openweathermap.org/api) API.

## Features

- Search by city name, with the keyboard's search key or the button
- Shows temperature, feels-like, a weather icon and description, humidity, wind speed, pressure, visibility, and the day's high and low
- Toggle between Fahrenheit and Celsius
- Clear messages for an empty search, a city that isn't found, and network problems
- A loading spinner while the data is fetched
- Survives screen rotation: the weather, the unit and the last city stay put without asking the API again

## How it's built

- Two fragments in one activity: `TopFragment` (search bar, unit toggle and the API request) and `BottomFragment` (the weather display)
- `WeatherViewModel` with LiveData keeps the state across rotation, so the two fragments share data and nothing is refetched
- [Volley](https://developer.android.com/training/volley) for the HTTP request, and [Glide](https://github.com/bumptech/glide) for the weather icons
- The API key is read from a git-ignored file at build time and exposed to the app as `BuildConfig.WEATHER_API_KEY`, so it is never committed

## Run it

You need a current, stable version of [Android Studio](https://developer.android.com/studio). The project uses Android Gradle Plugin 9.0 and Gradle 9.1, so an older Android Studio may ask you to update before it will open the project.

1. Get a free API key: create an account at [openweathermap.org](https://home.openweathermap.org/users/sign_up), then copy the key from the **API keys** page. A new key can take a little while to start working.
2. Clone the repo:
   ```bash
   git clone https://github.com/mberry-dev/weather-app.git
   ```
3. In Android Studio choose **Open** and select the `WeatherApp` folder inside the repo. Let Gradle finish syncing. The first sync downloads Gradle and the Java version the project needs, so it needs an internet connection and can take a few minutes.
4. Add your key to the file `WeatherApp/local.properties`, which Android Studio creates for you and Git ignores. Add this line to it (keep the existing `sdk.dir` line), then sync again:
   ```
   WEATHER_API_KEY=your_key_here
   ```
5. Run the app on an emulator or a connected phone (Android 7.0 / API 24 or newer).

Without a key the app still opens, but every search shows "Invalid API key", and Gradle prints a warning when it syncs.

## Testing

I tested the app on three Pixel emulator profiles (Pixel 2, Pixel 4 and Pixel 7) with a written test plan: [`WeatherApp/WeatherApp_TestPlan.xlsx`](WeatherApp/WeatherApp_TestPlan.xlsx). It has 32 test cases over three days (startup and UI, the API and weather data, and rotation), and each one was run on all three devices.

The project description with screenshots is in [`WeatherApp/WeatherApp_Description.docx`](WeatherApp/WeatherApp_Description.docx).

## Project structure

```
weather-app/
└── WeatherApp/
    ├── WeatherApp_TestPlan.xlsx
    ├── WeatherApp_Description.docx
    └── app/src/main/
        ├── java/com/example/weatherapp/
        │   ├── MainActivity.kt        # Hosts the two fragments
        │   ├── TopFragment.kt         # Search bar, unit toggle, API request
        │   ├── BottomFragment.kt      # Weather display
        │   ├── WeatherViewModel.kt    # State kept across rotation
        │   └── WeatherData.kt         # The weather data model
        └── res/                       # Layouts (portrait and landscape), strings, colors
```
