package com.apostolos.tv.data.sync

import com.apostolos.tv.data.CategoryVisibilityStore
import com.apostolos.tv.data.CredentialsStore
import com.apostolos.tv.data.FavoritesStore
import com.apostolos.tv.data.WatchHistoryStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class UserSyncManager(
    private val authApi: SupabaseAuthApi,
    private val cloudSync: CloudSyncRepository,
    private val accountSessionStore: AccountSessionStore,
    private val credentialsStore: CredentialsStore,
    private val watchHistoryStore: WatchHistoryStore,
    private val favoritesStore: FavoritesStore,
    private val categoryVisibilityStore: CategoryVisibilityStore,
) {
    data class SyncStatus(
        val lastSyncedAt: Long? = null,
        val isSyncing: Boolean = false,
        val lastError: String? = null,
    )

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _syncStatus = MutableStateFlow(SyncStatus())
    val syncStatus: StateFlow<SyncStatus> = _syncStatus.asStateFlow()
    private var pushJob: Job? = null
    private var suppressPush = false

    fun startAutoSync() {
        scope.launch {
            combine(
                credentialsStore.credentialsFlow,
                watchHistoryStore.entries,
                favoritesStore.items,
                categoryVisibilityStore.state,
            ) { _, _, _, _ -> Unit }
                .collect {
                    if (!suppressPush && accountSessionStore.session.value != null) {
                        schedulePush()
                    }
                }
        }
    }

    suspend fun resolveSession(): AccountSession? = withContext(Dispatchers.IO) {
        val current = accountSessionStore.session.value ?: return@withContext null
        if (!current.isExpired()) return@withContext current

        runCatching {
            val refreshed = authApi.refreshSession(current)
            accountSessionStore.save(refreshed)
            refreshed
        }.getOrElse {
            accountSessionStore.clear()
            null
        }
    }

    suspend fun syncAfterAccountLogin(session: AccountSession): UserSyncPayload = withContext(Dispatchers.IO) {
        accountSessionStore.save(session)
        val activeSession = resolveSession() ?: session
        val remote = runCatching { cloudSync.pull(activeSession) }.getOrNull()

        suppressPush = true
        try {
            if (remote != null) {
                applyPayload(remote)
                _syncStatus.update {
                    it.copy(lastSyncedAt = System.currentTimeMillis(), lastError = null)
                }
                remote
            } else {
                val local = collectPayload()
                cloudSync.push(activeSession, local)
                _syncStatus.update {
                    it.copy(lastSyncedAt = System.currentTimeMillis(), lastError = null)
                }
                local
            }
        } finally {
            suppressPush = false
        }
    }

    suspend fun pushNow() = withContext(Dispatchers.IO) {
        _syncStatus.update { it.copy(isSyncing = true, lastError = null) }
        try {
            val session = resolveSession() ?: throw CloudSyncException("Δεν είσαι συνδεδεμένος.")
            cloudSync.push(session, collectPayload())
            _syncStatus.update {
                it.copy(isSyncing = false, lastSyncedAt = System.currentTimeMillis(), lastError = null)
            }
        } catch (error: Exception) {
            _syncStatus.update { it.copy(isSyncing = false, lastError = error.message) }
            throw error
        }
    }

    suspend fun pullFromCloud() = withContext(Dispatchers.IO) {
        _syncStatus.update { it.copy(isSyncing = true, lastError = null) }
        try {
            val session = resolveSession() ?: throw CloudSyncException("Δεν είσαι συνδεδεμένος.")
            val remote = cloudSync.pull(session) ?: throw CloudSyncException("Δεν υπάρχουν δεδομένα στο cloud.")
            applyPayload(remote)
            _syncStatus.update {
                it.copy(isSyncing = false, lastSyncedAt = System.currentTimeMillis(), lastError = null)
            }
        } catch (error: Exception) {
            _syncStatus.update { it.copy(isSyncing = false, lastError = error.message) }
            throw error
        }
    }

    suspend fun changePassword(newPassword: String) = withContext(Dispatchers.IO) {
        val session = resolveSession() ?: throw SupabaseAuthException("Δεν είσαι συνδεδεμένος.")
        authApi.updatePassword(session, newPassword)
    }

    suspend fun applyPayload(payload: UserSyncPayload) {
        suppressPush = true
        try {
            watchHistoryStore.replaceAll(payload.watchHistory)
            favoritesStore.replaceAll(payload.favorites)
            categoryVisibilityStore.replaceAll(payload.categoryVisibility)
            credentialsStore.replaceAll(payload.playlists)
        } finally {
            suppressPush = false
        }
    }

    suspend fun clearLocalData() {
        suppressPush = true
        try {
            credentialsStore.clear()
            watchHistoryStore.clear()
            favoritesStore.clear()
            categoryVisibilityStore.clear()
        } finally {
            suppressPush = false
        }
    }

    suspend fun logout() = withContext(Dispatchers.IO) {
        runCatching { pushNow() }
        accountSessionStore.clear()
        clearLocalData()
    }

    fun collectPayload(): UserSyncPayload = UserSyncPayload(
        playlists = credentialsStore.playlistsState.value,
        watchHistory = watchHistoryStore.entries.value,
        favorites = favoritesStore.items.value,
        categoryVisibility = categoryVisibilityStore.state.value,
    )

    private fun schedulePush() {
        pushJob?.cancel()
        pushJob = scope.launch {
            delay(PUSH_DEBOUNCE_MS)
            _syncStatus.update { it.copy(isSyncing = true, lastError = null) }
            runCatching { pushNow() }
        }
    }

    companion object {
        private const val PUSH_DEBOUNCE_MS = 2_500L
    }
}
