package com.apostolos.tv.ui.common

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.apostolos.tv.R
import com.apostolos.tv.ui.theme.CinemaOnDark
import com.apostolos.tv.ui.theme.CinemaOnDarkMuted

@Composable
fun BrandWordmark(
    modifier: Modifier = Modifier,
    height: Dp = 32.dp,
    contentDescription: String = stringResource(R.string.brand_name),
) {
    Image(
        painter = painterResource(R.drawable.ic_brand_wordmark),
        contentDescription = contentDescription,
        modifier = modifier.height(height),
        contentScale = ContentScale.Fit,
    )
}

@Composable
fun BrandMark(
    modifier: Modifier = Modifier,
    size: Dp = 40.dp,
    contentDescription: String = stringResource(R.string.brand_name),
) {
    Image(
        painter = painterResource(R.drawable.ic_brand_mark),
        contentDescription = contentDescription,
        modifier = modifier.height(size),
        contentScale = ContentScale.Fit,
    )
}

@Composable
fun BrandLockup(
    modifier: Modifier = Modifier,
    wordmarkHeight: Dp = 44.dp,
    showTagline: Boolean = true,
    showDescription: Boolean = false,
    horizontalAlignment: Alignment.Horizontal = Alignment.CenterHorizontally,
) {
    Column(
        modifier = modifier,
        horizontalAlignment = horizontalAlignment,
    ) {
        BrandWordmark(height = wordmarkHeight)
        if (showTagline) {
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = stringResource(R.string.brand_tagline),
                style = MaterialTheme.typography.titleMedium,
                color = CinemaOnDarkMuted,
                letterSpacing = 3.sp,
            )
        }
        if (showDescription) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = stringResource(R.string.brand_description),
                style = MaterialTheme.typography.bodyMedium,
                color = CinemaOnDarkMuted,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
fun BrandAppBarTitle(
    modifier: Modifier = Modifier,
    sectionTitle: String? = null,
) {
    if (sectionTitle.isNullOrBlank()) {
        BrandWordmark(
            modifier = modifier,
            height = 26.dp,
        )
    } else {
        Column(modifier = modifier) {
            BrandWordmark(height = 20.dp)
            Text(
                text = sectionTitle,
                style = MaterialTheme.typography.labelMedium,
                color = CinemaOnDark,
            )
        }
    }
}
