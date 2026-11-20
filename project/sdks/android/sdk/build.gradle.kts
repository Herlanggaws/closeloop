plugins {
    id("com.android.library")
}

group = "ai.closeloop"
version = "0.1.0"

android {
    namespace = "ai.closeloop.sdk"
    compileSdk = 36
    defaultConfig {
        minSdk = 24
        consumerProguardFiles("consumer-rules.pro")
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    implementation("androidx.work:work-runtime:2.9.0")
    testImplementation("junit:junit:4.13.2")
}
