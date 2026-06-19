package com.apostolos.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!BuildConfig.IS_TV_FORM_FACTOR) {
            enableEdgeToEdge()
        }
        setContent {
            TvApp(application = application)
        }
    }
}
