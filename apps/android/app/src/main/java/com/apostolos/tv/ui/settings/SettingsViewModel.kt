package com.apostolos.tv.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.apostolos.tv.BuildConfig
import com.apostolos.tv.data.CategoryVisibilityStore
import com.apostolos.tv.data.ContentRepository
import com.apostolos.tv.data.CredentialsStore
import com.apostolos.tv.data.XtreamApi
import com.apostolos.tv.data.XtreamApiException
import com.apostolos.tv.data.sync.AccountSessionStore
import com.apostolos.tv.data.sync.CloudSyncException
import com.apostolos.tv.data.sync.SupabaseAuthException
import com.apostolos.tv.data.sync.UserSyncManager
import com.apostolos.tv.data.model.ContentSection
import com.apostolos.tv.data.model.XtreamCredentials
import com.apostolos.tv.data.model.normalizeCategoryId
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

enum class ExpiryUrgency {
    UNLIMITED,
    HEALTHY,
    WARNING,
    CRITICAL,
    EXPIRED,
}

data class SnackbarMessage(
    val text: String,
    val isError: Boolean = false,
)

data class CategorySettingItem(
    val id: String,
    val name: String,
    val visible: Boolean,
)

data class PlaylistSettingItem(
    val id: String,
    val name: String,
    val username: String,
    val serverUrl: String,
    val expiryLabel: String?,
    val expiryUrgency: ExpiryUrgency = ExpiryUrgency.UNLIMITED,
    val isActive: Boolean,
)

data class SettingsUiState(
    val isLoading: Boolean = false,
    val isLoggingOut: Boolean = false,
    val isAccountBusy: Boolean = false,
    val isPlaylistsLoading: Boolean = false,
    val isSyncing: Boolean = false,
    val lastSyncLabel: String = "Δεν έχει συγχρονιστεί ακόμα",
    val snackbarMessage: SnackbarMessage? = null,
    val errorMessage: String? = null,
    val selectedSection: ContentSection = ContentSection.LIVE,
    val categorySearchQuery: String = "",
    val cloudEmail: String? = null,
    val playlists: List<PlaylistSettingItem> = emptyList(),
    val liveCategories: List<CategorySettingItem> = emptyList(),
    val movieCategories: List<CategorySettingItem> = emptyList(),
    val seriesCategories: List<CategorySettingItem> = emptyList(),
    val appVersion: String = BuildConfig.VERSION_NAME,
)

class SettingsViewModel(
    private val api: XtreamApi,
    private val credentialsStore: CredentialsStore,
    private val categoryVisibility: CategoryVisibilityStore,
    private val contentRepository: ContentRepository,
    private val accountSessionStore: AccountSessionStore,
    private val userSyncManager: UserSyncManager,
) : ViewModel() {
    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()
    private var settingsLoaded = false

    init {
        viewModelScope.launch {
            accountSessionStore.session.collect { session ->
                _uiState.update { it.copy(cloudEmail = session?.email) }
            }
        }
        viewModelScope.launch {
            userSyncManager.syncStatus.collect { status ->
                _uiState.update {
                    it.copy(
                        isSyncing = status.isSyncing,
                        lastSyncLabel = formatLastSync(status.lastSyncedAt, status.isSyncing),
                    )
                }
            }
        }
        viewModelScope.launch {
            credentialsStore.playlistsState.collect {
                if (settingsLoaded) {
                    refreshPlaylists()
                }
            }
        }
        viewModelScope.launch {
            categoryVisibility.state.collect {
                if (!settingsLoaded) return@collect
                _uiState.update { state ->
                    state.copy(
                        liveCategories = applyVisibility(state.liveCategories, ContentSection.LIVE),
                        movieCategories = applyVisibility(state.movieCategories, ContentSection.MOVIES),
                        seriesCategories = applyVisibility(state.seriesCategories, ContentSection.SERIES),
                    )
                }
            }
        }
    }

    fun ensureLoaded() {
        if (settingsLoaded) return
        settingsLoaded = true
        viewModelScope.launch {
            refreshPlaylists()
            val creds = credentialsStore.credentialsFlow.value
            if (creds != null) {
                loadCategories(creds)
            } else {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        liveCategories = emptyList(),
                        movieCategories = emptyList(),
                        seriesCategories = emptyList(),
                    )
                }
            }
        }
    }

    fun consumeSnackbar() {
        _uiState.update { it.copy(snackbarMessage = null) }
    }

    fun selectSection(section: ContentSection) {
        _uiState.update { it.copy(selectedSection = section, categorySearchQuery = "") }
    }

    fun onCategorySearchChange(query: String) {
        _uiState.update { it.copy(categorySearchQuery = query) }
    }

    fun filteredCategories(items: List<CategorySettingItem>): List<CategorySettingItem> {
        val query = _uiState.value.categorySearchQuery.trim().lowercase(Locale.getDefault())
        if (query.isBlank()) return items
        return items.filter { it.name.lowercase(Locale.getDefault()).contains(query) }
    }

    fun visibleCategoryCount(items: List<CategorySettingItem>): Int = items.count { it.visible }

    fun reload() {
        viewModelScope.launch {
            refreshPlaylists()
            credentialsStore.credentialsFlow.value?.let { loadCategories(it) }
        }
    }

    fun activatePlaylist(id: String) {
        runAccountAction(successMessage = "Ενεργή playlist άλλαξε.") {
            credentialsStore.setActivePlaylist(id)
            contentRepository.clearCache()
        }
    }

    fun testPlaylistConnection(id: String) {
        val credentials = playlistForEdit(id) ?: return
        runAccountAction(successMessage = "Η σύνδεση είναι ενεργή.") {
            api.authenticate(credentials)
        }
    }

    fun addPlaylist(name: String, credentials: XtreamCredentials) {
        if (name.isBlank() || credentials.serverUrl.isBlank() ||
            credentials.username.isBlank() || credentials.password.isBlank()
        ) {
            showSnackbar("Συμπλήρωσε όλα τα πεδία playlist.", isError = true)
            return
        }
        runAccountAction(successMessage = "Η playlist προστέθηκε.") {
            api.authenticate(credentials)
            credentialsStore.addPlaylist(name.trim(), credentials)
            userSyncManager.pushNow()
            contentRepository.clearCache()
        }
    }

    fun updatePlaylist(id: String, name: String, credentials: XtreamCredentials) {
        if (name.isBlank() || credentials.serverUrl.isBlank() ||
            credentials.username.isBlank() || credentials.password.isBlank()
        ) {
            showSnackbar("Συμπλήρωσε όλα τα πεδία playlist.", isError = true)
            return
        }
        runAccountAction(successMessage = "Η playlist ενημερώθηκε.") {
            api.authenticate(credentials)
            credentialsStore.updatePlaylist(id, name.trim(), credentials)
            userSyncManager.pushNow()
            contentRepository.clearCache()
        }
    }

    fun deletePlaylist(id: String) {
        runAccountAction(successMessage = "Η playlist διαγράφηκε.") {
            credentialsStore.removePlaylist(id)
            userSyncManager.pushNow()
            contentRepository.clearCache()
        }
    }

    fun clearContentCache() {
        contentRepository.clearCache()
        showSnackbar("Η cache περιεχομένου καθαρίστηκε.")
    }

    fun reloadProgramGuide() {
        contentRepository.clearEpgCache()
        showSnackbar("Το πρόγραμμα ανανεώθηκε. Άνοιξε ξανά ένα live κανάλι για ενημέρωση.")
    }

    fun logout(onLoggedOut: () -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoggingOut = true) }
            userSyncManager.logout()
            contentRepository.clearCache()
            _uiState.update { it.copy(isLoggingOut = false) }
            onLoggedOut()
        }
    }

    fun pushToCloud() {
        runAccountAction(successMessage = "Ανέβηκαν στο cloud.") {
            userSyncManager.pushNow()
        }
    }

    fun pullFromCloud() {
        runAccountAction(successMessage = "Φορτώθηκαν από cloud.") {
            userSyncManager.pullFromCloud()
            credentialsStore.credentialsFlow.value?.let { loadCategories(it) }
        }
    }

    fun changePassword(newPassword: String, confirmPassword: String) {
        if (newPassword.length < 6) {
            showSnackbar("Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.", isError = true)
            return
        }
        if (newPassword != confirmPassword) {
            showSnackbar("Οι κωδικοί δεν ταιριάζουν.", isError = true)
            return
        }
        runAccountAction(successMessage = "Ο κωδικός άλλαξε.") {
            userSyncManager.changePassword(newPassword)
        }
    }

    fun playlistForEdit(id: String): XtreamCredentials? =
        credentialsStore.playlistsState.value.playlists
            .find { it.id == id }
            ?.toCredentials()

    fun playlistNameForEdit(id: String): String? =
        credentialsStore.playlistsState.value.playlists
            .find { it.id == id }
            ?.name

    private fun showSnackbar(text: String, isError: Boolean = false) {
        _uiState.update { it.copy(snackbarMessage = SnackbarMessage(text, isError)) }
    }

    private fun runAccountAction(successMessage: String, block: suspend () -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isAccountBusy = true) }
            try {
                withContext(Dispatchers.IO) { block() }
                _uiState.update { it.copy(isAccountBusy = false) }
                showSnackbar(successMessage)
            } catch (error: SupabaseAuthException) {
                _uiState.update { it.copy(isAccountBusy = false) }
                showSnackbar(error.message ?: "Σφάλμα.", isError = true)
            } catch (error: CloudSyncException) {
                _uiState.update { it.copy(isAccountBusy = false) }
                showSnackbar(error.message ?: "Σφάλμα sync.", isError = true)
            } catch (error: XtreamApiException) {
                _uiState.update { it.copy(isAccountBusy = false) }
                showSnackbar(error.message ?: "Σφάλμα σύνδεσης.", isError = true)
            } catch (_: Exception) {
                _uiState.update { it.copy(isAccountBusy = false) }
                showSnackbar("Η ενέργεια απέτυχε.", isError = true)
            }
        }
    }

    fun setCategoryVisible(categoryId: String, visible: Boolean) {
        val section = _uiState.value.selectedSection
        val normalizedId = normalizeCategoryId(categoryId)
        categoryVisibility.setVisible(section, normalizedId, visible)
        updateSectionItems(section) { items ->
            items.map { item ->
                if (normalizeCategoryId(item.id) == normalizedId) {
                    item.copy(visible = visible)
                } else {
                    item
                }
            }
        }
    }

    fun showAllInSection() {
        val section = _uiState.value.selectedSection
        categoryVisibility.setAllVisible(section)
        updateSectionItems(section) { items ->
            items.map { it.copy(visible = true) }
        }
    }

    fun hideAllInSection() {
        val section = _uiState.value.selectedSection
        val items = currentItems(section)
        categoryVisibility.setAllHidden(section, items.map { it.id })
        updateSectionItems(section) { list ->
            list.map { it.copy(visible = false) }
        }
    }

    private suspend fun refreshPlaylists() {
        _uiState.update { it.copy(isPlaylistsLoading = true) }
        val state = credentialsStore.playlistsState.value
        val items = withContext(Dispatchers.IO) {
            state.playlists.map { playlist ->
                val expDate = if (playlist.id == state.activePlaylistId) {
                    runCatching {
                        api.authenticate(playlist.toCredentials()).expDate
                    }.getOrNull()
                } else {
                    null
                }
                PlaylistSettingItem(
                    id = playlist.id,
                    name = playlist.name,
                    username = playlist.username,
                    serverUrl = playlist.serverUrl,
                    expiryLabel = formatExpiry(expDate),
                    expiryUrgency = expiryUrgency(expDate),
                    isActive = playlist.id == state.activePlaylistId,
                )
            }
        }
        _uiState.update { it.copy(playlists = items, isPlaylistsLoading = false) }
    }

    private fun loadCategories(credentials: XtreamCredentials) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val live = contentRepository.loadLiveCategories(credentials).map { category ->
                    CategorySettingItem(
                        id = category.categoryId,
                        name = category.categoryName,
                        visible = categoryVisibility.isVisible(ContentSection.LIVE, category.categoryId),
                    )
                }
                val movies = contentRepository.loadVodCategories(credentials).map { category ->
                    CategorySettingItem(
                        id = category.categoryId,
                        name = category.categoryName,
                        visible = categoryVisibility.isVisible(ContentSection.MOVIES, category.categoryId),
                    )
                }
                val series = contentRepository.loadSeriesCategories(credentials).map { category ->
                    CategorySettingItem(
                        id = category.categoryId,
                        name = category.categoryName,
                        visible = categoryVisibility.isVisible(ContentSection.SERIES, category.categoryId),
                    )
                }
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        liveCategories = live,
                        movieCategories = movies,
                        seriesCategories = series,
                    )
                }
            } catch (error: XtreamApiException) {
                _uiState.update {
                    it.copy(isLoading = false, errorMessage = error.message)
                }
            } catch (_: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, errorMessage = "Αποτυχία φόρτωσης κατηγοριών.")
                }
            }
        }
    }

    private fun formatExpiry(expDate: String?): String {
        if (expDate.isNullOrBlank() || expDate == "0" || expDate.equals("null", ignoreCase = true)) {
            return "Απεριόριστη"
        }
        val timestamp = expDate.toLongOrNull() ?: return expDate
        if (timestamp <= 0L) return "Απεριόριστη"
        val formatter = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
        return formatter.format(Date(timestamp * 1000L))
    }

    private fun expiryUrgency(expDate: String?): ExpiryUrgency {
        if (expDate.isNullOrBlank() || expDate == "0" || expDate.equals("null", ignoreCase = true)) {
            return ExpiryUrgency.UNLIMITED
        }
        val timestamp = expDate.toLongOrNull() ?: return ExpiryUrgency.HEALTHY
        if (timestamp <= 0L) return ExpiryUrgency.UNLIMITED
        val expiryMs = timestamp * 1000L
        val now = System.currentTimeMillis()
        if (expiryMs <= now) return ExpiryUrgency.EXPIRED
        val days = TimeUnit.MILLISECONDS.toDays(expiryMs - now)
        return when {
            days <= 1 -> ExpiryUrgency.CRITICAL
            days <= 7 -> ExpiryUrgency.WARNING
            else -> ExpiryUrgency.HEALTHY
        }
    }

    private fun formatLastSync(timestamp: Long?, isSyncing: Boolean): String {
        if (isSyncing) return "Συγχρονισμός…"
        if (timestamp == null) return "Δεν έχει συγχρονιστεί ακόμα"
        val diff = System.currentTimeMillis() - timestamp
        return when {
            diff < TimeUnit.MINUTES.toMillis(1) -> "Τελευταίος συγχρονισμός: πριν λίγο"
            diff < TimeUnit.HOURS.toMillis(1) -> {
                val minutes = TimeUnit.MILLISECONDS.toMinutes(diff)
                "Τελευταίος συγχρονισμός: πριν $minutes λεπτά"
            }
            diff < TimeUnit.DAYS.toMillis(1) -> {
                val hours = TimeUnit.MILLISECONDS.toHours(diff)
                "Τελευταίος συγχρονισμός: πριν $hours ώρες"
            }
            else -> {
                val formatter = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
                "Τελευταίος συγχρονισμός: ${formatter.format(Date(timestamp))}"
            }
        }
    }

    private fun applyVisibility(
        items: List<CategorySettingItem>,
        section: ContentSection,
    ): List<CategorySettingItem> = items.map { item ->
        item.copy(visible = categoryVisibility.isVisible(section, item.id))
    }

    private fun currentItems(section: ContentSection): List<CategorySettingItem> =
        when (section) {
            ContentSection.LIVE -> _uiState.value.liveCategories
            ContentSection.MOVIES -> _uiState.value.movieCategories
            ContentSection.SERIES -> _uiState.value.seriesCategories
        }

    private fun updateSectionItems(
        section: ContentSection,
        transform: (List<CategorySettingItem>) -> List<CategorySettingItem>,
    ) {
        _uiState.update { state ->
            when (section) {
                ContentSection.LIVE -> state.copy(liveCategories = transform(state.liveCategories))
                ContentSection.MOVIES -> state.copy(movieCategories = transform(state.movieCategories))
                ContentSection.SERIES -> state.copy(seriesCategories = transform(state.seriesCategories))
            }
        }
    }
}
