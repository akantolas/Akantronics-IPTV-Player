package com.apostolos.tv.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.apostolos.tv.ui.theme.CinemaOnDark
import com.apostolos.tv.ui.theme.CinemaOnDarkMuted
import com.apostolos.tv.ui.theme.CinemaPrimary

@Composable
fun EmptyState(
    message: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    headline: String? = null,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        BrandMark(size = 48.dp)
        headline?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.titleMedium,
                color = CinemaOnDark,
                textAlign = TextAlign.Center,
            )
        }
        icon?.let {
            Icon(
                imageVector = it,
                contentDescription = null,
                tint = CinemaOnDarkMuted.copy(alpha = 0.7f),
                modifier = Modifier.size(40.dp),
            )
        }
        Text(
            text = message,
            style = MaterialTheme.typography.bodyLarge,
            color = CinemaOnDarkMuted,
            textAlign = TextAlign.Center,
        )
        if (actionLabel != null && onAction != null) {
            Spacer(modifier = Modifier.height(4.dp))
            Button(
                onClick = rememberTvClickHandler(onAction),
                modifier = Modifier.focusScale(),
                colors = ButtonDefaults.buttonColors(containerColor = CinemaPrimary),
            ) {
                Text(actionLabel)
            }
        }
    }
}
