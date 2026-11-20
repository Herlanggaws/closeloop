plugins {
    id("com.android.application")
}

android {
    namespace = "ai.closeloop.sample"
    compileSdk = 36
    defaultConfig {
        applicationId = "ai.closeloop.sample"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
        // Point at your local API: ./gradlew :sample:installDebug -Psaidloop.key=pk_… -Psaidloop.api=http://10.0.2.2:8080
        buildConfigField("String", "SAIDLOOP_KEY", "\"${project.findProperty("saidloop.key") ?: "pk_demo"}\"")
        buildConfigField("String", "SAIDLOOP_API", "\"${project.findProperty("saidloop.api") ?: "http://10.0.2.2:8080"}\"")
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(project(":sdk"))
}
