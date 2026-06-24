package com.apostolos.tv.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.apostolos.tv.ui.theme.CinemaBlack
import com.apostolos.tv.ui.theme.CinemaOnDarkMuted

@Composable
fun SplashScreen(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(CinemaBlack),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            BrandLockup(
                wordmarkHeight = 56.dp,
                showTagline = true,
                showDescription = false,
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "Premium IPTV Experience",
                style = MaterialTheme.typography.bodySmall,
                color = CinemaOnDarkMuted,
                textAlign = TextAlign.Center,
            )
        }
    }
}
