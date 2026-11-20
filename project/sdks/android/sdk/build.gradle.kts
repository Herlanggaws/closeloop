plugins {
    id("com.android.library")
    `maven-publish`
}

group = "ai.closeloop"
version = "0.1.0"

android {
    namespace = "ai.closeloop.sdk"
    compileSdk = 35
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
    publishing {
        singleVariant("release")
    }
}

// `./gradlew :sdk:publishToMavenLocal` lets the Flutter and React Native wrappers
// build against this SDK before it is on Maven Central.
publishing {
    publications {
        create<MavenPublication>("release") {
            groupId = "ai.closeloop"
            artifactId = "sdk"
            version = "0.1.0"
            afterEvaluate { from(components["release"]) }
        }
    }
}

dependencies {
    implementation("androidx.work:work-runtime:2.9.0")
    testImplementation("junit:junit:4.13.2")
}

// Apps on older Kotlin (React Native 0.76 ships 1.9) must be able to read this library.
kotlin {
    coreLibrariesVersion = "1.9.24"
    compilerOptions {
        apiVersion.set(org.jetbrains.kotlin.gradle.dsl.KotlinVersion.KOTLIN_1_9)
        languageVersion.set(org.jetbrains.kotlin.gradle.dsl.KotlinVersion.KOTLIN_1_9)
    }
}
