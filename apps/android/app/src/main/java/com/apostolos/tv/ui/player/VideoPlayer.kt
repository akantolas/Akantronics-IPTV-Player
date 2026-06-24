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
import androidx.compose.material.icons.filled.Forward10
import androidx.compose.material.icons.filled.Replay10
import androidx.compose.material.icons.filled.AspectRatio
import androidx.compose.material.icons.filled.ClosedCaption
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.FullscreenExit
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material.icons.filled.VolumeUp
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import com.apostolos.tv.data.model.EpgProgramme
import com.apostolos.tv.ui.common.EpgNowNextSection
import com.apostolos.tv.ui.common.rememberIsTvFormFactor
import kotlinx.coroutines.delay
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun VideoPlayer(
    streamUrl: String,
    modifier: Modifier = Modifier,
    title: String = "",
    subtitle: String = "",
    isLive: Boolean = false,
    startPositionMs: Long = 0L,
    externalSubtitles: List<ExternalSubtitleSource> = emptyList(),
    aspectMode: VideoAspectMode = VideoAspectMode.FIT,
    sleepTimerEndsAtMs: Long? = null,
    playbackSpeed: Float = 1f,
    nowProgramme: EpgProgramme? = null,
    nextProgramme: EpgProgramme? = null,
    showChannelBrowser: Boolean = false,
    numericInputBuffer: String = "",
    onError: (String) -> Unit = {},
    onPlaybackEnded: (() -> Unit)? = null,
    onProgressUpdate: (positionMs: Long, durationMs: Long, force: Boolean) -> Unit = { _, _, _ -> },
    onAspectModeCycle: () -> Unit = {},
    onSleepTimerSelect: (Int?) -> Unit = {},
    onSleepTimerClear: () -> Unit = {},
    onZapPrevious: (() -> Unit)? = null,
    onZapNext: (() -> Unit)? = null,
    onToggleChannelBrowser: (() -> Unit)? = null,
    onDismissChannelBrowser: (() -> Unit)? = null,
    onNumericDigit: ((Int) -> Unit)? = null,
    onConfirmNumericZap: (() -> Unit)? = null,
    onSpeedCycle: (() -> Unit)? = null,
    onControlsVisibilityChange: (Boolean) -> Unit = {},
) {
    val context = LocalContext.current
    val isTv = rememberIsTvFormFactor()
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
    var showControls by remember { mutableStateOf(!isTv) }
    var controlsHideGeneration by remember { mutableIntStateOf(0) }
    val showImmersiveChrome = isFullscreen || isTv
    var textTracks by remember { mutableStateOf(emptyList<PlayerTextTrack>()) }
    var selectedTextTrack by remember { mutableStateOf<PlayerTextTrack?>(null) }
    var showSubtitleDialog by remember { mutableStateOf(false) }
    var showAudioDialog by remember { mutableStateOf(false) }
    var showSleepTimerDialog by remember { mutableStateOf(false) }
    var currentTracks by remember { mutableStateOf<Tracks?>(null) }
    var audioTracks by remember { mutableStateOf(emptyList<PlayerAudioTrack>()) }
    var selectedAudioTrack by remember { mutableStateOf<PlayerAudioTrack?>(null) }
    val isSeekingRef = remember { AtomicBoolean(false) }
    val pendingSeekRef = remember(streamUrl, startPositionMs) {
        AtomicLong(startPositionMs.coerceAtLeast(0L))
    }
    var seekSlider by remember { mutableFloatStateOf(0f) }

    DisposableEffect(streamUrl, startPositionMs, externalSubtitles) {
        textTracks = emptyList()
        selectedTextTrack = null
        audioTracks = emptyList()
        selectedAudioTrack = null
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
                audioTracks = AudioTracks.extract(tracks)
                selectedAudioTrack = AudioTracks.findSelected(tracks, exoPlayer.trackSelectionParameters)
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
                        true,
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
                    onProgressUpdate(current, duration, false)
                } else if (current >= 5_000L) {
                    if (!isSeekingRef.get()) {
                        positionMs = current
                    }
                    onProgressUpdate(current, 0L, false)
                }
                handler.postDelayed(this, PROGRESS_INTERVAL_MS)
            }
        }
        handler.postDelayed(progressRunnable, PROGRESS_INTERVAL_MS)

        onDispose {
            val duration = exoPlayer.duration
            if (duration > 0L) {
                onProgressUpdate(exoPlayer.currentPosition, duration, true)
            } else if (exoPlayer.currentPosition >= 5_000L) {
                onProgressUpdate(exoPlayer.currentPosition, 0L, true)
            }
            handler.removeCallbacks(progressRunnable)
            exoPlayer.removeListener(listener)
        }
    }

    DisposableEffect(Unit) {
        onDispose { exoPlayer.release() }
    }

    LaunchedEffect(playbackSpeed) {
        exoPlayer.setPlaybackSpeed(playbackSpeed)
    }

    LaunchedEffect(showControls) {
        onControlsVisibilityChange(showControls)
    }

    LaunchedEffect(showControls, isPlaying, controlsHideGeneration) {
        if (showControls && isPlaying && !isBuffering) {
            delay(
                if (showImmersiveChrome) {
                    IMMERSIVE_CONTROLS_HIDE_DELAY_MS
                } else {
                    CONTROLS_HIDE_DELAY_MS
                },
            )
            showControls = false
        }
    }

    fun revealControls() {
        showControls = true
        controlsHideGeneration++
    }

    fun handleRemoteKey(event: androidx.compose.ui.input.key.KeyEvent): Boolean {
        if (event.type != KeyEventType.KeyDown) return false

        event.key.toDigitOrNull()?.let { digit ->
            if (isLive) {
                onNumericDigit?.invoke(digit)
                revealControls()
                return true
            }
        }

        when (event.key) {
            Key.Back -> {
                if (showChannelBrowser) {
                    onDismissChannelBrowser?.invoke()
                    return true
                }
                return false
            }
            Key.DirectionLeft, Key.Menu -> {
                if (isLive) {
                    onToggleChannelBrowser?.invoke()
                    revealControls()
                    return true
                }
            }
            Key.DirectionCenter, Key.Enter, Key.NumPadEnter -> {
                if (isLive && numericInputBuffer.isNotEmpty()) {
                    onConfirmNumericZap?.invoke()
                    return true
                }
            }
            Key.DirectionUp, Key.PageUp -> {
                revealControls()
                if (isLive) {
                    onZapPrevious?.invoke()
                    return true
                }
                return false
            }
            Key.DirectionDown, Key.PageDown -> {
                revealControls()
                if (isLive) {
                    onZapNext?.invoke()
                    return true
                }
                return false
            }
            else -> Unit
        }

        revealControls()
        return false
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
                revealControls()
            },
        )
    }

    if (showAudioDialog) {
        AudioSelectionDialog(
            tracks = audioTracks,
            selectedTrack = selectedAudioTrack,
            onDismiss = { showAudioDialog = false },
            onSelect = { track ->
                val tracks = currentTracks
                if (tracks != null && track != null) {
                    AudioTracks.applySelection(exoPlayer, tracks, track)
                    selectedAudioTrack = track
                }
                showAudioDialog = false
                revealControls()
            },
        )
    }

    if (showSleepTimerDialog) {
        SleepTimerDialog(
            activeEndsAtMs = sleepTimerEndsAtMs,
            onDismiss = { showSleepTimerDialog = false },
            onSelect = { minutes ->
                onSleepTimerSelect(minutes)
                showSleepTimerDialog = false
                revealControls()
            },
            onClear = {
                onSleepTimerClear()
                showSleepTimerDialog = false
                revealControls()
            },
        )
    }

    val playerContent: @Composable (Modifier) -> Unit = { surfaceModifier ->
        Box(
            modifier = surfaceModifier.onPreviewKeyEvent(::handleRemoteKey),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                    ) {
                        revealControls()
                    },
            ) {
                ExoPlayerSurface(
                    exoPlayer = exoPlayer,
                    aspectMode = aspectMode,
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

            if (!showControls && showImmersiveChrome) {
                ImmersiveClockBadge(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(16.dp),
                )
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
                    aspectMode = aspectMode,
                    sleepTimerEndsAtMs = sleepTimerEndsAtMs,
                    playbackSpeed = playbackSpeed,
                    nowProgramme = nowProgramme,
                    nextProgramme = nextProgramme,
                    hasSubtitles = !isLive && textTracks.isNotEmpty(),
                    subtitlesEnabled = selectedTextTrack != null,
                    hasAudioTracks = audioTracks.size > 1,
                    onPlayPause = {
                        if (exoPlayer.isPlaying) exoPlayer.pause() else exoPlayer.play()
                        revealControls()
                    },
                    onSeekStart = {
                        isSeekingRef.set(true)
                        revealControls()
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
                    onSkipBack = {
                        val target = (exoPlayer.currentPosition - SKIP_STEP_MS).coerceAtLeast(0L)
                        exoPlayer.seekTo(target)
                        positionMs = target
                        if (durationMs > 0L) {
                            seekSlider = target.toFloat() / durationMs
                        }
                        revealControls()
                    },
                    onSkipForward = {
                        val duration = exoPlayer.duration.coerceAtLeast(0L)
                        val target = if (duration > 0L) {
                            (exoPlayer.currentPosition + SKIP_STEP_MS).coerceAtMost(duration)
                        } else {
                            exoPlayer.currentPosition + SKIP_STEP_MS
                        }
                        exoPlayer.seekTo(target)
                        positionMs = target
                        if (duration > 0L) {
                            seekSlider = target.toFloat() / duration
                        }
                        revealControls()
                    },
                    onSpeedCycle = {
                        onSpeedCycle?.invoke()
                        revealControls()
                    },
                    onFullscreenToggle = {
                        if (isFullscreen) {
                            isFullscreen = false
                            revealControls()
                        } else {
                            isFullscreen = true
                            showControls = false
                        }
                    },
                    onSubtitlesClick = {
                        showSubtitleDialog = true
                        revealControls()
                    },
                    onAudioClick = {
                        showAudioDialog = true
                        revealControls()
                    },
                    onAspectClick = {
                        onAspectModeCycle()
                        revealControls()
                    },
                    onSleepTimerClick = {
                        showSleepTimerDialog = true
                        revealControls()
                    },
                )
            }

            if (!isTv) {
                PlayerSwipeGestureLayer(
                    modifier = Modifier.fillMaxSize(),
                    enabled = true,
                )
            }
        }
    }

    if (isFullscreen) {
        BackHandler {
            isFullscreen = false
            revealControls()
        }
        Dialog(
            onDismissRequest = {
                isFullscreen = false
                revealControls()
            },
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
private fun ImmersiveClockBadge(modifier: Modifier = Modifier) {
    var clockText by remember { mutableStateOf(formatWallClock()) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(1_000L)
            clockText = formatWallClock()
        }
    }
    Text(
        text = clockText,
        modifier = modifier
            .background(Color.Black.copy(alpha = 0.32f), RoundedCornerShape(8.dp))
            .padding(horizontal = 10.dp, vertical = 5.dp),
        style = MaterialTheme.typography.labelLarge,
        color = Color.White.copy(alpha = 0.72f),
    )
}

private fun formatWallClock(): String =
    SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())

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
    aspectMode: VideoAspectMode,
    sleepTimerEndsAtMs: Long?,
    playbackSpeed: Float,
    nowProgramme: EpgProgramme?,
    nextProgramme: EpgProgramme?,
    hasSubtitles: Boolean,
    subtitlesEnabled: Boolean,
    hasAudioTracks: Boolean,
    onPlayPause: () -> Unit,
    onSeekStart: () -> Unit,
    onSeekChange: (Float) -> Unit,
    onSeekFinish: () -> Unit,
    onSkipBack: () -> Unit,
    onSkipForward: () -> Unit,
    onSpeedCycle: () -> Unit,
    onFullscreenToggle: () -> Unit,
    onSubtitlesClick: () -> Unit,
    onAudioClick: () -> Unit,
    onAspectClick: () -> Unit,
    onSleepTimerClick: () -> Unit,
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
                if (isLive && (nowProgramme != null || nextProgramme != null)) {
                    EpgNowNextSection(
                        now = nowProgramme,
                        next = nextProgramme,
                        compact = true,
                        modifier = Modifier.padding(top = 8.dp),
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
                        hasAudioTracks = hasAudioTracks,
                        isFullscreen = isFullscreen,
                        aspectMode = aspectMode,
                        sleepTimerEndsAtMs = sleepTimerEndsAtMs,
                        onSubtitlesClick = onSubtitlesClick,
                        onAudioClick = onAudioClick,
                        onAspectClick = onAspectClick,
                        onSleepTimerClick = onSleepTimerClick,
                        onFullscreenToggle = onFullscreenToggle,
                    )
                }
            } else if (durationMs > 0L) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = onSkipBack) {
                        Icon(
                            imageVector = Icons.Default.Replay10,
                            contentDescription = "−10 δευτ.",
                            tint = CinemaOnDark,
                        )
                    }
                    Text(
                        text = "${formatTime(positionMs)} / ${formatTime(durationMs)}",
                        style = MaterialTheme.typography.labelMedium,
                        color = CinemaOnDark.copy(alpha = 0.9f),
                    )
                    IconButton(onClick = onSkipForward) {
                        Icon(
                            imageVector = Icons.Default.Forward10,
                            contentDescription = "+10 δευτ.",
                            tint = CinemaOnDark,
                        )
                    }
                }
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
                    TextButton(onClick = onSpeedCycle) {
                        Text(
                            text = formatPlaybackSpeed(playbackSpeed),
                            color = if (playbackSpeed != 1f) CinemaPrimary else CinemaOnDark,
                        )
                    }
                    PlayerBottomActions(
                        hasSubtitles = hasSubtitles,
                        subtitlesEnabled = subtitlesEnabled,
                        hasAudioTracks = hasAudioTracks,
                        isFullscreen = isFullscreen,
                        aspectMode = aspectMode,
                        sleepTimerEndsAtMs = sleepTimerEndsAtMs,
                        onSubtitlesClick = onSubtitlesClick,
                        onAudioClick = onAudioClick,
                        onAspectClick = onAspectClick,
                        onSleepTimerClick = onSleepTimerClick,
                        onFullscreenToggle = onFullscreenToggle,
                    )
                }
            } else if (hasSubtitles || hasAudioTracks) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PlayerBottomActions(
                        hasSubtitles = hasSubtitles,
                        subtitlesEnabled = subtitlesEnabled,
                        hasAudioTracks = hasAudioTracks,
                        isFullscreen = isFullscreen,
                        aspectMode = aspectMode,
                        sleepTimerEndsAtMs = sleepTimerEndsAtMs,
                        onSubtitlesClick = onSubtitlesClick,
                        onAudioClick = onAudioClick,
                        onAspectClick = onAspectClick,
                        onSleepTimerClick = onSleepTimerClick,
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
    hasAudioTracks: Boolean,
    isFullscreen: Boolean,
    aspectMode: VideoAspectMode,
    sleepTimerEndsAtMs: Long?,
    onSubtitlesClick: () -> Unit,
    onAudioClick: () -> Unit,
    onAspectClick: () -> Unit,
    onSleepTimerClick: () -> Unit,
    onFullscreenToggle: () -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (hasAudioTracks) {
            IconButton(onClick = onAudioClick) {
                Icon(
                    imageVector = Icons.Default.VolumeUp,
                    contentDescription = "Ήχος",
                    tint = CinemaPrimary,
                )
            }
        }
        IconButton(onClick = onAspectClick) {
            Icon(
                imageVector = Icons.Default.AspectRatio,
                contentDescription = aspectModeLabel(aspectMode),
                tint = if (aspectMode == VideoAspectMode.FIT) CinemaOnDark else CinemaPrimary,
            )
        }
        IconButton(onClick = onSleepTimerClick) {
            Icon(
                imageVector = Icons.Default.Timer,
                contentDescription = "Sleep timer",
                tint = if (sleepTimerEndsAtMs != null) CinemaPrimary else CinemaOnDark,
            )
        }
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

private fun aspectModeLabel(mode: VideoAspectMode): String = when (mode) {
    VideoAspectMode.FIT -> "Fit"
    VideoAspectMode.FILL -> "Fill"
    VideoAspectMode.ZOOM -> "Zoom"
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
private fun AudioSelectionDialog(
    tracks: List<PlayerAudioTrack>,
    selectedTrack: PlayerAudioTrack?,
    onDismiss: () -> Unit,
    onSelect: (PlayerAudioTrack?) -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CinemaSurface,
        title = { Text("Ήχος") },
        text = {
            LazyColumn(modifier = Modifier.heightIn(max = 320.dp)) {
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
private fun SleepTimerDialog(
    activeEndsAtMs: Long?,
    onDismiss: () -> Unit,
    onSelect: (Int?) -> Unit,
    onClear: () -> Unit,
) {
    val options = listOf(15, 30, 45, 60, 90, 120)
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CinemaSurface,
        title = { Text("Sleep timer") },
        text = {
            LazyColumn(modifier = Modifier.heightIn(max = 320.dp)) {
                if (activeEndsAtMs != null) {
                    item {
                        SubtitleOptionRow(
                            label = "Απενεργοποίηση timer",
                            selected = false,
                            onClick = onClear,
                        )
                    }
                }
                items(options) { minutes ->
                    SubtitleOptionRow(
                        label = "$minutes λεπτά",
                        selected = false,
                        onClick = { onSelect(minutes) },
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
private fun ExoPlayerSurface(
    exoPlayer: ExoPlayer,
    aspectMode: VideoAspectMode,
    modifier: Modifier,
) {
    val resizeMode = when (aspectMode) {
        VideoAspectMode.FIT -> AspectRatioFrameLayout.RESIZE_MODE_FIT
        VideoAspectMode.FILL -> AspectRatioFrameLayout.RESIZE_MODE_FILL
        VideoAspectMode.ZOOM -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
    }
    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            PlayerView(ctx).apply {
                player = exoPlayer
                useController = false
                this.resizeMode = resizeMode
                layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
            }
        },
        update = { view ->
            view.player = exoPlayer
            view.resizeMode = resizeMode
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
private const val IMMERSIVE_CONTROLS_HIDE_DELAY_MS = 5_000L
private const val SKIP_STEP_MS = 10_000L

private fun formatPlaybackSpeed(speed: Float): String {
    val rounded = (speed * 100).toInt() / 100f
    return if (rounded == rounded.toLong().toFloat()) {
        "${rounded.toLong()}x"
    } else {
        String.format(Locale.getDefault(), "%.2fx", rounded)
    }
}

private fun Key.toDigitOrNull(): Int? = when (this) {
    Key.Zero, Key.NumPad0 -> 0
    Key.One, Key.NumPad1 -> 1
    Key.Two, Key.NumPad2 -> 2
    Key.Three, Key.NumPad3 -> 3
    Key.Four, Key.NumPad4 -> 4
    Key.Five, Key.NumPad5 -> 5
    Key.Six, Key.NumPad6 -> 6
    Key.Seven, Key.NumPad7 -> 7
    Key.Eight, Key.NumPad8 -> 8
    Key.Nine, Key.NumPad9 -> 9
    else -> null
}
