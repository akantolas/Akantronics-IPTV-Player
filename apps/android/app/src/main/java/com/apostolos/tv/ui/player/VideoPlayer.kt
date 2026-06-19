package com.apostolos.tv.ui.player

import android.content.pm.ActivityInfo
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.material.icons.Icons
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.filled.ClosedCaption
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.FullscreenExit
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.Tracks
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.apostolos.tv.ui.theme.CinemaOnDark
import com.apostolos.tv.ui.theme.CinemaPrimary
import com.apostolos.tv.ui.theme.CinemaSurface
import kotlinx.coroutines.delay
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

@Composable
fun VideoPlayer(
    streamUrl: String,
    modifier: Modifier = Modifier,
    title: String = "",
    subtitle: String = "",
    isLive: Boolean = false,
    startPositionMs: Long = 0L,
    externalSubtitles: List<ExternalSubtitleSource> = emptyList(),
    onError: (String) -> Unit = {},
    onPlaybackEnded: (() -> Unit)? = null,
    onProgressUpdate: (positionMs: Long, durationMs: Long) -> Unit = { _, _ -> },
) {
    val context = LocalContext.current
    var isFullscreen by remember { mutableStateOf(false) }

    val exoPlayer = remember {
        ExoPlayer.Builder(context).build().apply {
            playWhenReady = true
        }
    }

    var isPlaying by remember { mutableStateOf(true) }
    var isBuffering by remember { mutableStateOf(true) }
    var positionMs by remember { mutableLongStateOf(0L) }
    var durationMs by remember { mutableLongStateOf(0L) }
    var showControls by remember { mutableStateOf(true) }
    var textTracks by remember { mutableStateOf(emptyList<PlayerTextTrack>()) }
    var selectedTextTrack by remember { mutableStateOf<PlayerTextTrack?>(null) }
    var showSubtitleDialog by remember { mutableStateOf(false) }
    var currentTracks by remember { mutableStateOf<Tracks?>(null) }
    val isSeekingRef = remember { AtomicBoolean(false) }
    val pendingSeekRef = remember(streamUrl, startPositionMs) {
        AtomicLong(startPositionMs.coerceAtLeast(0L))
    }
    var seekSlider by remember { mutableFloatStateOf(0f) }

    DisposableEffect(streamUrl, startPositionMs, externalSubtitles) {
        textTracks = emptyList()
        selectedTextTrack = null
        currentTracks = null
        pendingSeekRef.set(startPositionMs.coerceAtLeast(0L))
        val listener = object : Player.Listener {
            override fun onPlayerError(error: PlaybackException) {
                onError(error.localizedMessage ?: "Playback failed.")
            }

            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
            }

            override fun onTracksChanged(tracks: Tracks) {
                currentTracks = tracks
                textTracks = SubtitleTracks.extract(tracks)
                selectedTextTrack = SubtitleTracks.findSelected(tracks, exoPlayer.trackSelectionParameters)
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                isBuffering = playbackState == Player.STATE_BUFFERING
                if (playbackState == Player.STATE_READY) {
                    val seekTarget = pendingSeekRef.getAndSet(0L)
                    if (seekTarget > 0L) {
                        exoPlayer.seekTo(seekTarget)
                        positionMs = seekTarget
                        if (exoPlayer.duration > 0L) {
                            seekSlider = seekTarget.toFloat() / exoPlayer.duration
                        }
                    }
                }
                if (playbackState == Player.STATE_ENDED) {
                    onProgressUpdate(
                        exoPlayer.duration.coerceAtLeast(0L),
                        exoPlayer.duration.coerceAtLeast(0L),
                    )
                    onPlaybackEnded?.invoke()
                }
            }
        }
        exoPlayer.addListener(listener)
        val mediaItem = SubtitleTracks.buildMediaItem(streamUrl, externalSubtitles)
        exoPlayer.setMediaItem(mediaItem)
        exoPlayer.prepare()

        val handler = Handler(Looper.getMainLooper())
        val progressRunnable = object : Runnable {
            override fun run() {
                val duration = exoPlayer.duration
                val current = exoPlayer.currentPosition
                if (duration > 0L) {
                    if (!isSeekingRef.get()) {
                        positionMs = current
                        durationMs = duration
                        seekSlider = positionMs.toFloat() / duration
                    }
                    onProgressUpdate(current, duration)
                } else if (current >= 5_000L) {
                    if (!isSeekingRef.get()) {
                        positionMs = current
                    }
                    onProgressUpdate(current, 0L)
                }
                handler.postDelayed(this, PROGRESS_INTERVAL_MS)
            }
        }
        handler.postDelayed(progressRunnable, PROGRESS_INTERVAL_MS)

        onDispose {
            val duration = exoPlayer.duration
            if (duration > 0L) {
                onProgressUpdate(exoPlayer.currentPosition, duration)
            } else if (exoPlayer.currentPosition >= 5_000L) {
                onProgressUpdate(exoPlayer.currentPosition, 0L)
            }
            handler.removeCallbacks(progressRunnable)
            exoPlayer.removeListener(listener)
        }
    }

    DisposableEffect(Unit) {
        onDispose { exoPlayer.release() }
    }

    LaunchedEffect(showControls, isPlaying) {
        if (showControls && isPlaying && !isBuffering) {
            delay(CONTROLS_HIDE_DELAY_MS)
            showControls = false
        }
    }

    if (showSubtitleDialog) {
        SubtitleSelectionDialog(
            tracks = textTracks,
            selectedTrack = selectedTextTrack,
            onDismiss = { showSubtitleDialog = false },
            onSelect = { track ->
                val tracks = currentTracks
                if (tracks != null) {
                    SubtitleTracks.applySelection(exoPlayer, tracks, track)
                    selectedTextTrack = track
                }
                showSubtitleDialog = false
                showControls = true
            },
        )
    }

    val playerContent: @Composable (Modifier) -> Unit = { surfaceModifier ->
        Box(modifier = surfaceModifier) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                    ) {
                        showControls = !showControls
                    },
            ) {
                ExoPlayerSurface(
                    exoPlayer = exoPlayer,
                    modifier = Modifier.fillMaxSize(),
                )
            }

            if (isBuffering) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.35f)),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(
                        color = CinemaPrimary,
                        modifier = Modifier.size(44.dp),
                    )
                }
            }

            AnimatedVisibility(
                visible = showControls,
                enter = fadeIn(),
                exit = fadeOut(),
            ) {
                PlayerControlsOverlay(
                    title = title,
                    subtitle = subtitle,
                    isLive = isLive,
                    isPlaying = isPlaying,
                    isFullscreen = isFullscreen,
                    positionMs = positionMs,
                    durationMs = durationMs,
                    seekSlider = seekSlider,
                    hasSubtitles = !isLive && textTracks.isNotEmpty(),
                    subtitlesEnabled = selectedTextTrack != null,
                    onPlayPause = {
                        if (exoPlayer.isPlaying) exoPlayer.pause() else exoPlayer.play()
                        showControls = true
                    },
                    onSeekStart = {
                        isSeekingRef.set(true)
                        showControls = true
                    },
                    onSeekChange = { value ->
                        seekSlider = value
                        if (durationMs > 0L) {
                            positionMs = (value * durationMs).toLong()
                        }
                    },
                    onSeekFinish = {
                        isSeekingRef.set(false)
                        if (durationMs > 0L) {
                            val target = (seekSlider * durationMs).toLong()
                            exoPlayer.seekTo(target)
                            positionMs = target
                        }
                    },
                    onFullscreenToggle = { isFullscreen = !isFullscreen },
                    onSubtitlesClick = {
                        showSubtitleDialog = true
                        showControls = true
                    },
                )
            }
        }
    }

    if (isFullscreen) {
        BackHandler { isFullscreen = false }
        Dialog(
            onDismissRequest = { isFullscreen = false },
            properties = DialogProperties(
                dismissOnBackPress = true,
                dismissOnClickOutside = false,
                usePlatformDefaultWidth = false,
                decorFitsSystemWindows = false,
            ),
        ) {
            val activity = context.findActivity()
            DisposableEffect(Unit) {
                val previousOrientation = activity?.requestedOrientation
                    ?: ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                activity?.setPlayerImmersiveMode(true)
                onDispose {
                    activity?.requestedOrientation = previousOrientation
                    activity?.setPlayerImmersiveMode(false)
                }
            }
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black),
            ) {
                playerContent(Modifier.fillMaxSize())
            }
        }
    } else {
        playerContent(modifier.fillMaxSize())
    }
}

@Composable
private fun PlayerControlsOverlay(
    title: String,
    subtitle: String,
    isLive: Boolean,
    isPlaying: Boolean,
    isFullscreen: Boolean,
    positionMs: Long,
    durationMs: Long,
    seekSlider: Float,
    hasSubtitles: Boolean,
    subtitlesEnabled: Boolean,
    onPlayPause: () -> Unit,
    onSeekStart: () -> Unit,
    onSeekChange: (Float) -> Unit,
    onSeekFinish: () -> Unit,
    onFullscreenToggle: () -> Unit,
    onSubtitlesClick: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize()) {
        if (title.isNotBlank()) {
            Column(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .fillMaxWidth()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                Color.Black.copy(alpha = 0.78f),
                                Color.Transparent,
                            ),
                        ),
                    )
                    .padding(start = 56.dp, end = 16.dp, top = 12.dp, bottom = 24.dp),
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                if (subtitle.isNotBlank()) {
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.8f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
        }

        Box(
            modifier = Modifier
                .align(Alignment.Center)
                .background(Color.Black.copy(alpha = 0.35f), shape = MaterialTheme.shapes.large)
                .clickable(onClick = onPlayPause)
                .padding(4.dp),
        ) {
            Icon(
                imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                contentDescription = if (isPlaying) "Pause" else "Play",
                tint = CinemaOnDark,
                modifier = Modifier
                    .size(52.dp)
                    .padding(8.dp),
            )
        }

        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = {},
                )
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.82f)),
                    ),
                )
                .padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            if (isLive) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    LiveBadge()
                    PlayerBottomActions(
                        hasSubtitles = hasSubtitles,
                        subtitlesEnabled = subtitlesEnabled,
                        isFullscreen = isFullscreen,
                        onSubtitlesClick = onSubtitlesClick,
                        onFullscreenToggle = onFullscreenToggle,
                    )
                }
            } else if (durationMs > 0L) {
                Slider(
                    value = seekSlider.coerceIn(0f, 1f),
                    onValueChange = {
                        onSeekStart()
                        onSeekChange(it)
                    },
                    onValueChangeFinished = onSeekFinish,
                    modifier = Modifier.fillMaxWidth(),
                    colors = SliderDefaults.colors(
                        thumbColor = CinemaPrimary,
                        activeTrackColor = CinemaPrimary,
                        inactiveTrackColor = Color.White.copy(alpha = 0.25f),
                    ),
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "${formatTime(positionMs)} / ${formatTime(durationMs)}",
                        style = MaterialTheme.typography.labelMedium,
                        color = CinemaOnDark.copy(alpha = 0.9f),
                    )
                    PlayerBottomActions(
                        hasSubtitles = hasSubtitles,
                        subtitlesEnabled = subtitlesEnabled,
                        isFullscreen = isFullscreen,
                        onSubtitlesClick = onSubtitlesClick,
                        onFullscreenToggle = onFullscreenToggle,
                    )
                }
            } else if (hasSubtitles) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PlayerBottomActions(
                        hasSubtitles = true,
                        subtitlesEnabled = subtitlesEnabled,
                        isFullscreen = isFullscreen,
                        onSubtitlesClick = onSubtitlesClick,
                        onFullscreenToggle = onFullscreenToggle,
                    )
                }
            }
        }
    }
}

@Composable
private fun PlayerBottomActions(
    hasSubtitles: Boolean,
    subtitlesEnabled: Boolean,
    isFullscreen: Boolean,
    onSubtitlesClick: () -> Unit,
    onFullscreenToggle: () -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (hasSubtitles) {
            IconButton(onClick = onSubtitlesClick) {
                Icon(
                    imageVector = Icons.Default.ClosedCaption,
                    contentDescription = "Υπότιτλοι",
                    tint = if (subtitlesEnabled) CinemaPrimary else CinemaOnDark,
                )
            }
        }
        IconButton(onClick = onFullscreenToggle) {
            Icon(
                imageVector = if (isFullscreen) {
                    Icons.Default.FullscreenExit
                } else {
                    Icons.Default.Fullscreen
                },
                contentDescription = "Fullscreen",
                tint = CinemaOnDark,
            )
        }
    }
}

@Composable
private fun SubtitleSelectionDialog(
    tracks: List<PlayerTextTrack>,
    selectedTrack: PlayerTextTrack?,
    onDismiss: () -> Unit,
    onSelect: (PlayerTextTrack?) -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CinemaSurface,
        title = { Text("Υπότιτλοι") },
        text = {
            LazyColumn(modifier = Modifier.heightIn(max = 320.dp)) {
                item {
                    SubtitleOptionRow(
                        label = "Απενεργοποιημένοι",
                        selected = selectedTrack == null,
                        onClick = { onSelect(null) },
                    )
                }
                items(tracks, key = { "${it.groupIndex}:${it.trackIndex}" }) { track ->
                    SubtitleOptionRow(
                        label = track.label,
                        selected = selectedTrack == track,
                        onClick = { onSelect(track) },
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Κλείσιμο")
            }
        },
    )
}

@Composable
private fun SubtitleOptionRow(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RadioButton(selected = selected, onClick = onClick)
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.padding(start = 4.dp),
        )
    }
}

@Composable
private fun LiveBadge() {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .background(Color.Red.copy(alpha = 0.85f), shape = MaterialTheme.shapes.small)
            .padding(horizontal = 8.dp, vertical = 4.dp),
    ) {
        Text(
            text = "LIVE",
            style = MaterialTheme.typography.labelSmall,
            color = Color.White,
        )
    }
}

@Composable
private fun ExoPlayerSurface(
    exoPlayer: ExoPlayer,
    modifier: Modifier,
) {
    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            PlayerView(ctx).apply {
                player = exoPlayer
                useController = false
                resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
            }
        },
        update = { view ->
            view.player = exoPlayer
            view.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
        },
    )
}

private fun formatTime(ms: Long): String {
    if (ms <= 0L) return "0:00"
    val totalSeconds = ms / 1000
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return if (hours > 0) {
        String.format("%d:%02d:%02d", hours, minutes, seconds)
    } else {
        String.format("%d:%02d", minutes, seconds)
    }
}

private const val PROGRESS_INTERVAL_MS = 1_000L
private const val CONTROLS_HIDE_DELAY_MS = 3_500L
