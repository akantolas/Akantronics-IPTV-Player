package com.apostolos.tv

import android.os.Bundle
import android.view.View
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!BuildConfig.IS_TV_FORM_FACTOR) {
            enableEdgeToEdge()
        } else {
            enableTvSoundEffects(window.decorView)
        }
        setContent {
            TvApp(application = application)
        }
    }

    private fun enableTvSoundEffects(root: View) {
        root.isSoundEffectsEnabled = true
        if (root is android.view.ViewGroup) {
            for (i in 0 until root.childCount) {
                enableTvSoundEffects(root.getChildAt(i))
            }
        }
    }
}
