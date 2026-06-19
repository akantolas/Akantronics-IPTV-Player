package com.apostolos.tv.ui.settings

import androidx.activity.compose.BackHandler
import androidx.compose.ui.res.stringResource
import com.apostolos.tv.R
import com.apostolos.tv.ui.common.BrandLockup
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.WifiTethering
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.apostolos.tv.data.model.ContentSection
import com.apostolos.tv.data.model.XtreamCredentials
import com.apostolos.tv.ui.common.EmptyState
import com.apostolos.tv.ui.common.ErrorState
import com.apostolos.tv.ui.common.LoadingScreenSkeleton
import com.apostolos.tv.ui.common.SkeletonBox
import com.apostolos.tv.ui.common.focusScale
import com.apostolos.tv.ui.theme.CinemaBlack
import com.apostolos.tv.ui.theme.CinemaError
import com.apostolos.tv.ui.theme.CinemaOnDark
import com.apostolos.tv.ui.theme.CinemaOnDarkMuted
import com.apostolos.tv.ui.theme.CinemaPrimary
import com.apostolos.tv.ui.theme.CinemaSurface
import com.apostolos.tv.ui.theme.CinemaSurfaceBorder

private val CinemaSuccess = Color(0xFF4ADE80)
private val CinemaWarning = Color(0xFFFFB347)

private enum class SettingsPage {
    Main,
    Categories,
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel,
    onBack: () -> Unit,
    onLogout: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var snackbarIsError by remember { mutableStateOf(false) }
    var page by remember { mutableStateOf(SettingsPage.Main) }
    var showPasswordDialog by remember { mutableStateOf(false) }
    var showAddPlaylistDialog by remember { mutableStateOf(false) }
    var editingPlaylistId by remember { mutableStateOf<String?>(null) }
    var deletingPlaylistId by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(state.snackbarMessage) {
        val message = state.snackbarMessage ?: return@LaunchedEffect
        snackbarIsError = message.isError
        snackbarHostState.showSnackbar(message.text)
        viewModel.consumeSnackbar()
    }

    BackHandler(enabled = page == SettingsPage.Categories) {
        page = SettingsPage.Main
    }

    if (showPasswordDialog) {
        ChangePasswordDialog(
            isBusy = state.isAccountBusy,
            onDismiss = { showPasswordDialog = false },
            onConfirm = { newPassword, confirmPassword ->
                viewModel.changePassword(newPassword, confirmPassword)
                showPasswordDialog = false
            },
        )
    }

    if (showAddPlaylistDialog) {
        PlaylistEditorDialog(
            title = "Νέα playlist",
            isBusy = state.isAccountBusy,
            onDismiss = { showAddPlaylistDialog = false },
            onConfirm = { name, serverUrl, username, password ->
                viewModel.addPlaylist(
                    name = name,
                    credentials = XtreamCredentials(serverUrl, username, password),
                )
                showAddPlaylistDialog = false
            },
        )
    }

    editingPlaylistId?.let { playlistId ->
        PlaylistEditorDialog(
            title = "Επεξεργασία playlist",
            isBusy = state.isAccountBusy,
            initialName = viewModel.playlistNameForEdit(playlistId).orEmpty(),
            initialCredentials = viewModel.playlistForEdit(playlistId),
            onDismiss = { editingPlaylistId = null },
            onConfirm = { name, serverUrl, username, password ->
                viewModel.updatePlaylist(
                    id = playlistId,
                    name = name,
                    credentials = XtreamCredentials(serverUrl, username, password),
                )
                editingPlaylistId = null
            },
        )
    }

    deletingPlaylistId?.let { playlistId ->
        val playlistName = state.playlists.find { it.id == playlistId }?.name.orEmpty()
        AlertDialog(
            onDismissRequest = { deletingPlaylistId = null },
            title = { Text("Διαγραφή playlist") },
            text = {
                Text(
                    if (playlistName.isBlank()) {
                        "Θέλεις να διαγράψεις αυτή την playlist;"
                    } else {
                        "Θέλεις να διαγράψεις «$playlistName»;"
                    },
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deletePlaylist(playlistId)
                        deletingPlaylistId = null
                    },
                    enabled = !state.isAccountBusy,
                ) {
                    Text("Διαγραφή", color = CinemaError)
                }
            },
            dismissButton = {
                TextButton(onClick = { deletingPlaylistId = null }) {
                    Text("Ακύρωση", color = CinemaOnDarkMuted)
                }
            },
        )
    }

    Scaffold(
        containerColor = CinemaBlack,
        snackbarHost = {
            SnackbarHost(snackbarHostState) { data ->
                val isError = state.snackbarMessage?.isError == true
                Snackbar(
                    snackbarData = data,
                    containerColor = if (snackbarIsError) CinemaError.copy(alpha = 0.92f) else CinemaSurface,
                    contentColor = CinemaOnDark,
                )
            }
        },
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        when (page) {
                            SettingsPage.Main -> "Ρυθμίσεις"
                            SettingsPage.Categories -> "Κατηγορίες"
                        },
                    )
                },
                navigationIcon = {
                    IconButton(
                        onClick = {
                            if (page == SettingsPage.Categories) {
                                page = SettingsPage.Main
                            } else {
                                onBack()
                            }
                        },
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = CinemaSurface,
                    titleContentColor = MaterialTheme.colorScheme.onBackground,
                    navigationIconContentColor = MaterialTheme.colorScheme.onBackground,
                ),
            )
        },
    ) { padding ->
        CompositionLocalProvider(LocalContentColor provides CinemaOnDark) {
            when (page) {
                SettingsPage.Main -> SettingsMainContent(
                    state = state,
                    viewModel = viewModel,
                    modifier = Modifier.padding(padding),
                    onOpenCategories = { page = SettingsPage.Categories },
                    onChangePassword = { showPasswordDialog = true },
                    onAddPlaylist = { showAddPlaylistDialog = true },
                    onEditPlaylist = { editingPlaylistId = it },
                    onDeletePlaylist = { deletingPlaylistId = it },
                    onLogout = { viewModel.logout(onLogout) },
                )
                SettingsPage.Categories -> SettingsCategoriesContent(
                    state = state,
                    viewModel = viewModel,
                    modifier = Modifier.padding(padding),
                )
            }
        }
    }
}

@Composable
private fun SettingsMainContent(
    state: SettingsUiState,
    viewModel: SettingsViewModel,
    modifier: Modifier = Modifier,
    onOpenCategories: () -> Unit,
    onChangePassword: () -> Unit,
    onAddPlaylist: () -> Unit,
    onEditPlaylist: (String) -> Unit,
    onDeletePlaylist: (String) -> Unit,
    onLogout: () -> Unit,
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 32.dp),
    ) {
        item {
            SettingsSectionHeader(title = "Λογαριασμός")
            AccountSection(
                email = state.cloudEmail,
                lastSyncLabel = state.lastSyncLabel,
                isSyncing = state.isSyncing,
                isBusy = state.isAccountBusy,
                isLoggingOut = state.isLoggingOut,
                onChangePassword = onChangePassword,
                onPushToCloud = viewModel::pushToCloud,
                onPullFromCloud = viewModel::pullFromCloud,
            )
        }

        item {
            SettingsSectionHeader(title = "IPTV")
            PlaylistsSection(
                playlists = state.playlists,
                isLoading = state.isPlaylistsLoading,
                isBusy = state.isAccountBusy,
                onAdd = onAddPlaylist,
                onActivate = viewModel::activatePlaylist,
                onEdit = onEditPlaylist,
                onDelete = onDeletePlaylist,
                onTestConnection = viewModel::testPlaylistConnection,
            )
        }

        item {
            SettingsSectionHeader(title = "Περιεχόμενο")
            ContentSettingsSection(
                visibleLive = viewModel.visibleCategoryCount(state.liveCategories),
                totalLive = state.liveCategories.size,
                visibleMovies = viewModel.visibleCategoryCount(state.movieCategories),
                totalMovies = state.movieCategories.size,
                visibleSeries = viewModel.visibleCategoryCount(state.seriesCategories),
                totalSeries = state.seriesCategories.size,
                onOpenCategories = onOpenCategories,
                onClearCache = viewModel::clearContentCache,
            )
        }

        item {
            SettingsSectionHeader(title = "Ζώνη κινδύνου")
            DangerZoneSection(
                isLoggingOut = state.isLoggingOut,
                onLogout = onLogout,
            )
        }

        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 24.dp, bottom = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                BrandLockup(
                    wordmarkHeight = 36.dp,
                    showTagline = true,
                    showDescription = false,
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "${stringResource(R.string.brand_full_name)} v${state.appVersion}",
                    style = MaterialTheme.typography.labelSmall,
                    color = CinemaOnDarkMuted,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
        }
    }
}

@Composable
private fun SettingsCategoriesContent(
    state: SettingsUiState,
    viewModel: SettingsViewModel,
    modifier: Modifier = Modifier,
) {
    val sections = ContentSection.entries
    val selectedIndex = sections.indexOf(state.selectedSection)
    val allItems = when (state.selectedSection) {
        ContentSection.LIVE -> state.liveCategories
        ContentSection.MOVIES -> state.movieCategories
        ContentSection.SERIES -> state.seriesCategories
    }
    val filteredItems = viewModel.filteredCategories(allItems)

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        item {
            Text(
                text = "Επίλεξε ποιες κατηγορίες εμφανίζονται σε κάθε ενότητα.",
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                style = MaterialTheme.typography.bodySmall,
                color = CinemaOnDarkMuted,
            )
        }

        item {
            OutlinedTextField(
                value = state.categorySearchQuery,
                onValueChange = viewModel::onCategorySearchChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                placeholder = { Text("Αναζήτηση κατηγορίας…") },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = settingsFieldColors(),
            )
        }

        item {
            TabRow(
                selectedTabIndex = selectedIndex,
                containerColor = CinemaSurface,
                contentColor = CinemaPrimary,
            ) {
                sections.forEachIndexed { index, section ->
                    Tab(
                        selected = index == selectedIndex,
                        onClick = { viewModel.selectSection(section) },
                        selectedContentColor = CinemaPrimary,
                        unselectedContentColor = CinemaOnDarkMuted,
                        text = {
                            Text(
                                text = when (section) {
                                    ContentSection.LIVE -> "Live TV"
                                    ContentSection.MOVIES -> "Ταινίες"
                                    ContentSection.SERIES -> "Σειρές"
                                },
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        },
                    )
                }
            }
        }

        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "${viewModel.visibleCategoryCount(allItems)}/${allItems.size} εμφανίζονται",
                    style = MaterialTheme.typography.labelMedium,
                    color = CinemaOnDarkMuted,
                )
                Row {
                    TextButton(onClick = viewModel::showAllInSection) {
                        Text("Όλα", color = CinemaPrimary)
                    }
                    TextButton(onClick = viewModel::hideAllInSection) {
                        Text("Κανένα", color = CinemaPrimary)
                    }
                }
            }
        }

        when {
            state.isLoading -> item { LoadingScreenSkeleton(showChipRow = false) }
            state.errorMessage != null -> item {
                ErrorState(message = state.errorMessage.orEmpty(), onRetry = viewModel::reload)
            }
            filteredItems.isEmpty() -> item {
                EmptyState(
                    message = if (state.categorySearchQuery.isBlank()) {
                        "Δεν βρέθηκαν κατηγορίες."
                    } else {
                        "Δεν βρέθηκαν κατηγορίες για «${state.categorySearchQuery}»."
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            else -> items(filteredItems, key = { it.id }) { item ->
                CategoryVisibilityRow(
                    item = item,
                    onToggle = { visible -> viewModel.setCategoryVisible(item.id, visible) },
                )
            }
        }
    }
}

@Composable
private fun SettingsSectionHeader(title: String) {
    Text(
        text = title.uppercase(),
        modifier = Modifier.padding(start = 20.dp, top = 20.dp, bottom = 8.dp),
        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
        color = CinemaOnDarkMuted,
    )
}

@Composable
private fun AccountSection(
    email: String?,
    lastSyncLabel: String,
    isSyncing: Boolean,
    isBusy: Boolean,
    isLoggingOut: Boolean,
    onChangePassword: () -> Unit,
    onPushToCloud: () -> Unit,
    onPullFromCloud: () -> Unit,
) {
    var showAdvanced by remember { mutableStateOf(false) }
    val initial = email?.firstOrNull()?.uppercaseChar()?.toString() ?: "?"

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        colors = CardDefaults.cardColors(containerColor = CinemaSurface),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(52.dp)
                        .clip(CircleShape)
                        .background(CinemaPrimary.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = initial,
                        style = MaterialTheme.typography.titleLarge,
                        color = CinemaPrimary,
                    )
                }
                Column(modifier = Modifier.padding(start = 14.dp)) {
                    Text(
                        text = "Signed in",
                        style = MaterialTheme.typography.labelSmall,
                        color = CinemaOnDarkMuted,
                    )
                    Text(
                        text = email ?: "—",
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }

            Row(
                modifier = Modifier.padding(top = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (isSyncing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = CinemaPrimary,
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.CloudSync,
                        contentDescription = null,
                        tint = CinemaPrimary,
                        modifier = Modifier.size(18.dp),
                    )
                }
                Text(
                    text = lastSyncLabel,
                    style = MaterialTheme.typography.bodySmall,
                    color = CinemaOnDarkMuted,
                )
            }

            Text(
                text = "Ιστορικό, αγαπημένα και ρυθμίσεις συγχρονίζονται αυτόματα.",
                style = MaterialTheme.typography.bodySmall,
                color = CinemaOnDarkMuted,
                modifier = Modifier.padding(top = 8.dp),
            )

            OutlinedButton(
                onClick = onChangePassword,
                enabled = !isBusy && !isLoggingOut && email != null,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 14.dp),
            ) {
                Text("Αλλαγή κωδικού")
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp)
                    .clickable { showAdvanced = !showAdvanced },
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Για προχωρημένους",
                    style = MaterialTheme.typography.labelMedium,
                    color = CinemaOnDarkMuted,
                )
                Icon(
                    imageVector = if (showAdvanced) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = null,
                    tint = CinemaOnDarkMuted,
                )
            }

            AnimatedVisibility(visible = showAdvanced) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    TextButton(
                        onClick = onPushToCloud,
                        enabled = !isBusy && !isLoggingOut && email != null,
                    ) {
                        Text("Ανέβασμα", color = CinemaPrimary)
                    }
                    TextButton(
                        onClick = onPullFromCloud,
                        enabled = !isBusy && !isLoggingOut && email != null,
                    ) {
                        Text("Λήψη", color = CinemaPrimary)
                    }
                }
            }
        }
    }
}

@Composable
private fun PlaylistsSection(
    playlists: List<PlaylistSettingItem>,
    isLoading: Boolean,
    isBusy: Boolean,
    onAdd: () -> Unit,
    onActivate: (String) -> Unit,
    onEdit: (String) -> Unit,
    onDelete: (String) -> Unit,
    onTestConnection: (String) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        when {
            isLoading -> repeat(2) {
                SkeletonBox(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp),
                    cornerRadius = 14.dp,
                )
            }
            playlists.isEmpty() -> {
                Card(colors = CardDefaults.cardColors(containerColor = CinemaSurface)) {
                    EmptyState(
                        message = "Δεν υπάρχει playlist. Πρόσθεσε μία για σύνδεση.",
                        modifier = Modifier.padding(vertical = 8.dp),
                    )
                }
            }
            else -> {
                playlists.forEach { playlist ->
                    PlaylistCard(
                        playlist = playlist,
                        isBusy = isBusy,
                        onActivate = { onActivate(playlist.id) },
                        onEdit = { onEdit(playlist.id) },
                        onDelete = { onDelete(playlist.id) },
                        onTestConnection = { onTestConnection(playlist.id) },
                    )
                }
            }
        }

        OutlinedButton(
            onClick = onAdd,
            enabled = !isBusy,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Icon(Icons.Default.Add, contentDescription = null, tint = CinemaPrimary)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Προσθήκη playlist", color = CinemaPrimary)
        }
    }
}

@Composable
private fun PlaylistCard(
    playlist: PlaylistSettingItem,
    isBusy: Boolean,
    onActivate: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onTestConnection: () -> Unit,
) {
    var menuExpanded by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .focusScale(),
        colors = CardDefaults.cardColors(containerColor = CinemaSurface),
        shape = RoundedCornerShape(14.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(IntrinsicSize.Min),
        ) {
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .fillMaxHeight()
                    .background(
                        if (playlist.isActive) CinemaPrimary else CinemaSurfaceBorder,
                    ),
            )
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(14.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = playlist.name,
                        style = MaterialTheme.typography.titleSmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        ExpiryChip(urgency = playlist.expiryUrgency, label = playlist.expiryLabel)
                        Box {
                            IconButton(onClick = { menuExpanded = true }, enabled = !isBusy) {
                                Icon(Icons.Default.MoreVert, contentDescription = "Ενέργειες")
                            }
                            DropdownMenu(
                                expanded = menuExpanded,
                                onDismissRequest = { menuExpanded = false },
                            ) {
                                if (!playlist.isActive) {
                                    DropdownMenuItem(
                                        text = { Text("Ενεργοποίηση") },
                                        onClick = {
                                            menuExpanded = false
                                            onActivate()
                                        },
                                        leadingIcon = {
                                            Icon(Icons.Default.PlayArrow, contentDescription = null)
                                        },
                                    )
                                }
                                DropdownMenuItem(
                                    text = { Text("Έλεγχος σύνδεσης") },
                                    onClick = {
                                        menuExpanded = false
                                        onTestConnection()
                                    },
                                    leadingIcon = {
                                        Icon(Icons.Default.WifiTethering, contentDescription = null)
                                    },
                                )
                                DropdownMenuItem(
                                    text = { Text("Επεξεργασία") },
                                    onClick = {
                                        menuExpanded = false
                                        onEdit()
                                    },
                                    leadingIcon = {
                                        Icon(Icons.Default.Edit, contentDescription = null)
                                    },
                                )
                                DropdownMenuItem(
                                    text = { Text("Διαγραφή", color = CinemaError) },
                                    onClick = {
                                        menuExpanded = false
                                        onDelete()
                                    },
                                    leadingIcon = {
                                        Icon(Icons.Default.Delete, contentDescription = null, tint = CinemaError)
                                    },
                                )
                            }
                        }
                    }
                }
                if (playlist.isActive) {
                    Text(
                        text = "Ενεργή",
                        style = MaterialTheme.typography.labelSmall,
                        color = CinemaPrimary,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Text(
                    text = playlist.username,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 6.dp),
                )
                Text(
                    text = playlist.serverUrl,
                    style = MaterialTheme.typography.bodySmall,
                    color = CinemaOnDarkMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun ExpiryChip(urgency: ExpiryUrgency, label: String?) {
    val text = when (urgency) {
        ExpiryUrgency.UNLIMITED -> "Απεριόριστη"
        ExpiryUrgency.HEALTHY -> label ?: "Ενεργή"
        ExpiryUrgency.WARNING -> "Λήγει σύντομα"
        ExpiryUrgency.CRITICAL -> "Λήγει σήμερα"
        ExpiryUrgency.EXPIRED -> "Έληξε"
    }
    val color = when (urgency) {
        ExpiryUrgency.UNLIMITED, ExpiryUrgency.HEALTHY -> CinemaSuccess
        ExpiryUrgency.WARNING -> CinemaWarning
        ExpiryUrgency.CRITICAL, ExpiryUrgency.EXPIRED -> CinemaError
    }
    Text(
        text = text,
        modifier = Modifier
            .padding(end = 4.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(color.copy(alpha = 0.15f))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        style = MaterialTheme.typography.labelSmall,
        color = color,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
}

@Composable
private fun ContentSettingsSection(
    visibleLive: Int,
    totalLive: Int,
    visibleMovies: Int,
    totalMovies: Int,
    visibleSeries: Int,
    totalSeries: Int,
    onOpenCategories: () -> Unit,
    onClearCache: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        colors = CardDefaults.cardColors(containerColor = CinemaSurface),
    ) {
        Column {
            SettingsNavRow(
                icon = { Icon(Icons.Default.Tune, contentDescription = null, tint = CinemaPrimary) },
                title = "Κατηγορίες περιεχομένου",
                subtitle = "Live $visibleLive/$totalLive · Ταινίες $visibleMovies/$totalMovies · Σειρές $visibleSeries/$totalSeries",
                onClick = onOpenCategories,
            )
            HorizontalDivider(color = CinemaSurfaceBorder.copy(alpha = 0.5f))
            SettingsNavRow(
                icon = { Icon(Icons.Default.Storage, contentDescription = null, tint = CinemaPrimary) },
                title = "Καθαρισμός cache",
                subtitle = "Ανανέωση λιστών περιεχομένου από τον server",
                onClick = onClearCache,
            )
        }
    }
}

@Composable
private fun SettingsNavRow(
    icon: @Composable () -> Unit,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .focusScale()
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        icon()
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 14.dp),
        ) {
            Text(text = title, style = MaterialTheme.typography.titleSmall)
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = CinemaOnDarkMuted,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        Icon(
            imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
            tint = CinemaOnDarkMuted,
        )
    }
}

@Composable
private fun DangerZoneSection(
    isLoggingOut: Boolean,
    onLogout: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .border(1.dp, CinemaError.copy(alpha = 0.35f), RoundedCornerShape(14.dp)),
        colors = CardDefaults.cardColors(containerColor = CinemaSurface.copy(alpha = 0.6f)),
        shape = RoundedCornerShape(14.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Αποσύνδεση",
                style = MaterialTheme.typography.titleSmall,
                color = CinemaError,
            )
            Text(
                text = "Θα αποσυνδεθείς από τον cloud λογαριασμό και θα διαγραφούν τα τοπικά δεδομένα.",
                style = MaterialTheme.typography.bodySmall,
                color = CinemaOnDarkMuted,
                modifier = Modifier.padding(top = 6.dp),
            )
            Button(
                onClick = onLogout,
                enabled = !isLoggingOut,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = CinemaError.copy(alpha = 0.85f),
                ),
            ) {
                Text(if (isLoggingOut) "Αποσύνδεση…" else "Αποσύνδεση")
            }
        }
    }
}

@Composable
private fun PlaylistEditorDialog(
    title: String,
    isBusy: Boolean,
    initialName: String = "",
    initialCredentials: XtreamCredentials? = null,
    onDismiss: () -> Unit,
    onConfirm: (name: String, serverUrl: String, username: String, password: String) -> Unit,
) {
    var name by remember(initialName) { mutableStateOf(initialName) }
    var serverUrl by remember(initialCredentials?.serverUrl) {
        mutableStateOf(initialCredentials?.serverUrl.orEmpty())
    }
    var username by remember(initialCredentials?.username) {
        mutableStateOf(initialCredentials?.username.orEmpty())
    }
    var password by remember(initialCredentials?.password) {
        mutableStateOf(initialCredentials?.password.orEmpty())
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Όνομα playlist") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    colors = settingsFieldColors(),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = serverUrl,
                    onValueChange = { serverUrl = it },
                    label = { Text("Server URL") },
                    placeholder = { Text("http://host:port") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                    shape = RoundedCornerShape(12.dp),
                    colors = settingsFieldColors(),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("Username") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    colors = settingsFieldColors(),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    shape = RoundedCornerShape(12.dp),
                    colors = settingsFieldColors(),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(name, serverUrl.trim(), username.trim(), password) },
                enabled = !isBusy,
            ) {
                Text("Αποθήκευση", color = CinemaPrimary)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Ακύρωση", color = CinemaOnDarkMuted)
            }
        },
    )
}

@Composable
private fun ChangePasswordDialog(
    isBusy: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (String, String) -> Unit,
) {
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Νέος κωδικός") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = newPassword,
                    onValueChange = { newPassword = it },
                    label = { Text("Νέος κωδικός") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    shape = RoundedCornerShape(12.dp),
                    colors = settingsFieldColors(),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it },
                    label = { Text("Επιβεβαίωση") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    shape = RoundedCornerShape(12.dp),
                    colors = settingsFieldColors(),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(newPassword, confirmPassword) },
                enabled = !isBusy,
            ) {
                Text("Αποθήκευση", color = CinemaPrimary)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Ακύρωση", color = CinemaOnDarkMuted)
            }
        },
    )
}

@Composable
private fun CategoryVisibilityRow(
    item: CategorySettingItem,
    onToggle: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .focusScale()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = item.name,
            modifier = Modifier.weight(1f).padding(end = 12.dp),
            style = MaterialTheme.typography.bodyLarge,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Switch(
            checked = item.visible,
            onCheckedChange = onToggle,
            colors = SwitchDefaults.colors(
                checkedThumbColor = MaterialTheme.colorScheme.onPrimary,
                checkedTrackColor = CinemaPrimary,
            ),
        )
    }
}

@Composable
private fun settingsFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = CinemaPrimary,
    unfocusedBorderColor = CinemaSurfaceBorder,
    focusedContainerColor = CinemaSurface.copy(alpha = 0.6f),
    unfocusedContainerColor = CinemaSurface.copy(alpha = 0.35f),
    cursorColor = CinemaPrimary,
)
