import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

val phoneRoot = rootProject.projectDir.parentFile.resolve("android")
val phoneMain = phoneRoot.resolve("app/src/main")

val tvLocalPropertiesFile = rootProject.file("local.properties")
if (!tvLocalPropertiesFile.exists()) {
    phoneRoot.resolve("local.properties")
        .takeIf { it.exists() }
        ?.copyTo(tvLocalPropertiesFile)
}

android {
    namespace = "com.apostolos.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.apostolos.tv.projector"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-tv"

        val localProperties = Properties()
        val localPropertiesFile = sequenceOf(
            rootProject.file("local.properties"),
            phoneRoot.resolve("local.properties"),
        ).firstOrNull { it.exists() }
        if (localPropertiesFile != null) {
            localPropertiesFile.inputStream().use { localProperties.load(it) }
        }
        val supabaseUrl = localProperties.getProperty("supabase.url", "")
        val supabaseAnonKey = localProperties.getProperty("supabase.anon.key", "")
        buildConfigField("String", "SUPABASE_URL", "\"$supabaseUrl\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"$supabaseAnonKey\"")
        buildConfigField("boolean", "IS_TV_FORM_FACTOR", "true")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    sourceSets {
        getByName("main") {
            java.setSrcDirs(listOf(phoneMain.resolve("java")))
            res.setSrcDirs(
                listOf(
                    file("src/main/res"),
                    phoneMain.resolve("res"),
                ),
            )
        }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.04.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.9")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.leanback:leanback:1.2.0")

    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.coil-kt:coil-compose:2.7.0")

    implementation("androidx.media3:media3-exoplayer:1.6.1")
    implementation("androidx.media3:media3-exoplayer-hls:1.6.1")
    implementation("androidx.media3:media3-ui:1.6.1")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
