plugins {
    id("com.android.library")
    id("com.vanniktech.maven.publish")
}

val sdkVersion = providers.gradleProperty("VERSION_NAME").get()

group = "com.saidloop"
version = sdkVersion

android {
    namespace = "com.saidloop.sdk"
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
}

// Maven Central: com.saidloop:android
//   ./gradlew :sdk:publishToMavenLocal                  local build for the Flutter and React Native wrappers
//   ./gradlew :sdk:publishAndReleaseToMavenCentral      needs mavenCentralUsername / mavenCentralPassword
//                                                       and signingInMemoryKey* in ~/.gradle/gradle.properties
//                                                       or ORG_GRADLE_PROJECT_* env vars
mavenPublishing {
    publishToMavenCentral()
    if (providers.gradleProperty("signingInMemoryKey").isPresent) {
        signAllPublications()
    }
    coordinates("com.saidloop", "android", sdkVersion)

    pom {
        name.set("Saidloop Android SDK")
        description.set("In-app bug reports and feedback for Android that your coding agent can fix via MCP.")
        inceptionYear.set("2026")
        url.set("https://github.com/XERV-Project/saidloop-android")
        licenses {
            license {
                name.set("MIT License")
                url.set("https://opensource.org/licenses/MIT")
                distribution.set("repo")
            }
        }
        developers {
            developer {
                id.set("xerv-project")
                name.set("XERV Project")
                url.set("https://github.com/XERV-Project")
            }
        }
        scm {
            url.set("https://github.com/XERV-Project/saidloop-android")
            connection.set("scm:git:https://github.com/XERV-Project/saidloop-android.git")
            developerConnection.set("scm:git:ssh://git@github.com/XERV-Project/saidloop-android.git")
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
