package com.apostolos.tv.ui.player

import android.content.Context
import android.media.AudioManager
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Brightness6
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.apostolos.tv.ui.theme.CinemaOnDark
import com.apostolos.tv.ui.theme.CinemaPrimary
import kotlinx.coroutines.delay

private enum class SwipeOverlayKind {
    BRIGHTNESS,
    VOLUME,
}

private data class SwipeOverlayState(
    val kind: SwipeOverlayKind,
    val progress: Float,
    val label: String,
)

@Composable
fun PlayerSwipeGestureLayer(
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    if (!enabled) return

    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val audioManager = remember(context) {
        context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }

    var brightness by remember(activity) {
        mutableFloatStateOf(activity?.readWindowBrightness() ?: DEFAULT_WINDOW_BRIGHTNESS)
    }
    var volume by remember(audioManager) {
        mutableIntStateOf(audioManager.musicVolume())
    }
    val maxVolume = remember(audioManager) { audioManager.musicMaxVolume().coerceAtLeast(1) }
    var overlay by remember { mutableStateOf<SwipeOverlayState?>(null) }

    LaunchedEffect(overlay) {
        if (overlay == null) return@LaunchedEffect
        delay(OVERLAY_HIDE_MS)
        overlay = null
    }

    fun showBrightness(value: Float) {
        overlay = SwipeOverlayState(
            kind = SwipeOverlayKind.BRIGHTNESS,
            progress = value,
            label = "${(value * 100).toInt()}%",
        )
    }

    fun showVolume(value: Int) {
        overlay = SwipeOverlayState(
            kind = SwipeOverlayKind.VOLUME,
            progress = value.toFloat() / maxVolume,
            label = "${((value.toFloat() / maxVolume) * 100).toInt()}%",
        )
    }

    Box(modifier = modifier.fillMaxSize()) {
        Row(Modifier.fillMaxSize()) {
            Box(
                Modifier
                    .weight(0.38f)
                    .fillMaxHeight()
                    .pointerInput(activity) {
                        detectVerticalDragGestures { change, dragAmount ->
                            change.consume()
                            val delta = -dragAmount / size.height * 1.4f
                            brightness = (brightness + delta).coerceIn(MIN_WINDOW_BRIGHTNESS, 1f)
                            activity?.setWindowBrightness(brightness)
                            showBrightness(brightness)
                        }
                    },
            )
            Box(Modifier.weight(0.24f))
            Box(
                Modifier
                    .weight(0.38f)
                    .fillMaxHeight()
                    .pointerInput(audioManager, maxVolume) {
                        detectVerticalDragGestures { change, dragAmount ->
                            change.consume()
                            val deltaSteps = (-dragAmount / size.height * maxVolume * 1.2f).toInt()
                            if (deltaSteps != 0) {
                                volume = (volume + deltaSteps).coerceIn(0, maxVolume)
                                audioManager.setStreamVolume(
                                    AudioManager.STREAM_MUSIC,
                                    volume,
                                    0,
                                )
                                showVolume(volume)
                            }
                        }
                    },
            )
        }

        AnimatedVisibility(
            visible = overlay != null,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.align(
                when (overlay?.kind) {
                    SwipeOverlayKind.VOLUME -> Alignment.CenterEnd
                    SwipeOverlayKind.BRIGHTNESS, null -> Alignment.CenterStart
                },
            ),
        ) {
            overlay?.let { state ->
                SwipeOverlayIndicator(state = state)
            }
        }
    }
}

@Composable
private fun SwipeOverlayIndicator(state: SwipeOverlayState) {
    Column(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .padding(vertical = 24.dp)
            .padding(
                start = if (state.kind == SwipeOverlayKind.BRIGHTNESS) 12.dp else 0.dp,
                end = if (state.kind == SwipeOverlayKind.VOLUME) 12.dp else 0.dp,
            ),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .padding(bottom = 10.dp)
                .background(Color.Black.copy(alpha = 0.55f), RoundedCornerShape(12.dp))
                .padding(horizontal = 14.dp, vertical = 12.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    imageVector = when (state.kind) {
                        SwipeOverlayKind.BRIGHTNESS -> Icons.Default.Brightness6
                        SwipeOverlayKind.VOLUME -> Icons.Default.VolumeUp
                    },
                    contentDescription = null,
                    tint = CinemaPrimary,
                    modifier = Modifier.size(28.dp),
                )
                Text(
                    text = state.label,
                    style = MaterialTheme.typography.titleMedium,
                    color = CinemaOnDark,
                    modifier = Modifier.padding(top = 6.dp),
                )
                LinearProgressIndicator(
                    progress = { state.progress.coerceIn(0f, 1f) },
                    modifier = Modifier
                        .padding(top = 8.dp)
                        .size(width = 72.dp, height = 4.dp),
                    color = CinemaPrimary,
                    trackColor = Color.White.copy(alpha = 0.25f),
                )
            }
        }
    }
}

private fun AudioManager.musicVolume(): Int =
    getStreamVolume(AudioManager.STREAM_MUSIC)

private fun AudioManager.musicMaxVolume(): Int =
    getStreamMaxVolume(AudioManager.STREAM_MUSIC)

private const val DEFAULT_WINDOW_BRIGHTNESS = 0.5f
private const val OVERLAY_HIDE_MS = 1_200L
