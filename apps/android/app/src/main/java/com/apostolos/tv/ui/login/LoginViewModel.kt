package com.apostolos.tv.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.apostolos.tv.data.CredentialsStore
import com.apostolos.tv.data.XtreamApi
import com.apostolos.tv.data.XtreamApiException
import com.apostolos.tv.data.model.XtreamCredentials
import com.apostolos.tv.data.sync.CloudSyncException
import com.apostolos.tv.data.sync.SupabaseAuthApi
import com.apostolos.tv.data.sync.SupabaseAuthException
import com.apostolos.tv.data.sync.UserSyncManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class LoginStep {
    ACCOUNT,
    XTREAM,
}

data class LoginUiState(
    val step: LoginStep = LoginStep.ACCOUNT,
    val isRegister: Boolean = false,
    val email: String = "",
    val accountPassword: String = "",
    val serverUrl: String = "",
    val username: String = "",
    val password: String = "",
    val playlistName: String = "Κύρια playlist",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val isLoggedIn: Boolean = false,
    val accountEmail: String? = null,
)

class LoginViewModel(
    private val api: XtreamApi,
    private val credentialsStore: CredentialsStore,
    private val authApi: SupabaseAuthApi,
    private val userSyncManager: UserSyncManager,
) : ViewModel() {
    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    private var autoLoginAttempted = false

    init {
        viewModelScope.launch {
            if (autoLoginAttempted) return@launch
            autoLoginAttempted = true

            val session = userSyncManager.resolveSession() ?: return@launch
            _uiState.update {
                it.copy(
                    isLoading = true,
                    email = session.email,
                    accountEmail = session.email,
                    errorMessage = null,
                )
            }

            try {
                val payload = userSyncManager.syncAfterAccountLogin(session)
                completeXtreamOrPrompt(
                    payload.playlists.activeCredentials ?: credentialsStore.credentialsFlow.value,
                )
            } catch (error: CloudSyncException) {
                completeXtreamOrPrompt(credentialsStore.credentialsFlow.value)
                if (credentialsStore.credentialsFlow.value == null) {
                    _uiState.update {
                        it.copy(isLoading = false, errorMessage = error.message)
                    }
                }
            } catch (_: Exception) {
                completeXtreamOrPrompt(credentialsStore.credentialsFlow.value)
                if (credentialsStore.credentialsFlow.value == null) {
                    _uiState.update {
                        it.copy(isLoading = false, errorMessage = "Sync failed. Try again.")
                    }
                }
            }
        }
    }

    fun onEmailChange(value: String) {
        _uiState.update { it.copy(email = value, errorMessage = null) }
    }

    fun onAccountPasswordChange(value: String) {
        _uiState.update { it.copy(accountPassword = value, errorMessage = null) }
    }

    fun onServerUrlChange(value: String) {
        _uiState.update { it.copy(serverUrl = value, errorMessage = null) }
    }

    fun onUsernameChange(value: String) {
        _uiState.update { it.copy(username = value, errorMessage = null) }
    }

    fun onPasswordChange(value: String) {
        _uiState.update { it.copy(password = value, errorMessage = null) }
    }

    fun onPlaylistNameChange(value: String) {
        _uiState.update { it.copy(playlistName = value, errorMessage = null) }
    }

    fun toggleRegisterMode() {
        _uiState.update {
            it.copy(isRegister = !it.isRegister, errorMessage = null)
        }
    }

    fun submitAccount() {
        val current = _uiState.value
        val email = current.email.trim()
        val password = current.accountPassword

        if (email.isBlank() || password.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Συμπλήρωσε email και κωδικό.") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val session = withContext(Dispatchers.IO) {
                    if (current.isRegister) {
                        authApi.signUp(email, password)
                    } else {
                        authApi.signIn(email, password)
                    }
                }
                val payload = userSyncManager.syncAfterAccountLogin(session)
                _uiState.update {
                    it.copy(
                        accountEmail = session.email,
                        isLoading = false,
                    )
                }
                completeXtreamOrPrompt(
                    payload.playlists.activeCredentials ?: credentialsStore.credentialsFlow.value,
                )
            } catch (error: SupabaseAuthException) {
                _uiState.update {
                    it.copy(isLoading = false, errorMessage = error.message)
                }
            } catch (error: CloudSyncException) {
                _uiState.update {
                    it.copy(isLoading = false, errorMessage = error.message)
                }
            } catch (error: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = error.message?.takeIf { it.isNotBlank() }
                            ?: "Unexpected error. Try again.",
                    )
                }
            }
        }
    }

    fun connectXtream() {
        val current = _uiState.value
        val credentials = XtreamCredentials(
            serverUrl = current.serverUrl.trim(),
            username = current.username.trim(),
            password = current.password,
        )

        if (credentials.serverUrl.isBlank() ||
            credentials.username.isBlank() ||
            credentials.password.isBlank()
        ) {
            _uiState.update { it.copy(errorMessage = "Συμπλήρωσε όλα τα πεδία IPTV.") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                withContext(Dispatchers.IO) {
                    api.authenticate(credentials)
                    val name = current.playlistName.trim().ifBlank { credentials.username }
                    credentialsStore.addPlaylist(name, credentials)
                    userSyncManager.pushNow()
                }
                _uiState.update { it.copy(isLoading = false, isLoggedIn = true) }
            } catch (error: XtreamApiException) {
                _uiState.update {
                    it.copy(isLoading = false, errorMessage = error.message)
                }
            } catch (_: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, errorMessage = "Unexpected error. Try again.")
                }
            }
        }
    }

    private suspend fun completeXtreamOrPrompt(credentials: XtreamCredentials?) {
        if (credentials == null ||
            credentials.serverUrl.isBlank() ||
            credentials.username.isBlank() ||
            credentials.password.isBlank()
        ) {
            _uiState.update {
                it.copy(
                    step = LoginStep.XTREAM,
                    isLoading = false,
                    serverUrl = credentials?.serverUrl.orEmpty(),
                    username = credentials?.username.orEmpty(),
                    password = credentials?.password.orEmpty(),
                )
            }
            return
        }

        try {
            withContext(Dispatchers.IO) {
                api.authenticate(credentials)
            }
            _uiState.update {
                it.copy(
                    isLoading = false,
                    isLoggedIn = true,
                    serverUrl = credentials.serverUrl,
                    username = credentials.username,
                    password = credentials.password,
                )
            }
        } catch (error: XtreamApiException) {
            _uiState.update {
                it.copy(
                    step = LoginStep.XTREAM,
                    isLoading = false,
                    errorMessage = error.message,
                    serverUrl = credentials.serverUrl,
                    username = credentials.username,
                    password = credentials.password,
                )
            }
        } catch (_: Exception) {
            _uiState.update {
                it.copy(
                    step = LoginStep.XTREAM,
                    isLoading = false,
                    errorMessage = "Saved IPTV credentials are invalid.",
                    serverUrl = credentials.serverUrl,
                    username = credentials.username,
                    password = credentials.password,
                )
            }
        }
    }
}
