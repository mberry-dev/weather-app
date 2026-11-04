import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
}

// The OpenWeatherMap API key is never committed. It is looked up, in order, in:
//   1. WeatherApp/local.properties (git-ignored):  WEATHER_API_KEY=your_key
//   2. A Gradle property, for example in ~/.gradle/gradle.properties
//   3. The WEATHER_API_KEY environment variable
val localProperties = Properties().apply {
    providers.fileContents(rootProject.layout.projectDirectory.file("local.properties"))
        .asText.orNull?.let { load(it.reader()) }
}
val weatherApiKey: String = localProperties.getProperty("WEATHER_API_KEY")
    ?: providers.gradleProperty("WEATHER_API_KEY").orNull
    ?: providers.environmentVariable("WEATHER_API_KEY").orNull
    ?: ""
if (weatherApiKey.isBlank()) {
    logger.warn("WEATHER_API_KEY is not set. Add WEATHER_API_KEY=your_key to local.properties. Weather searches will fail with 'Invalid API key' until you do.")
}

android {
    namespace = "com.example.weatherapp"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.weatherapp"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Exposed to the app as BuildConfig.WEATHER_API_KEY (see the lookup at the top of this file)
        buildConfigField("String", "WEATHER_API_KEY", "\"$weatherApiKey\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.2.0")
    implementation("androidx.fragment:fragment-ktx:1.8.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-livedata-ktx:2.8.7")
    implementation("com.android.volley:volley:1.2.1")
    implementation("com.github.bumptech.glide:glide:4.16.0")
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
}