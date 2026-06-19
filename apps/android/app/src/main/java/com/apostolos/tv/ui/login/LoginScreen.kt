package com.apostolos.tv.ui.login

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlaylistPlay
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.res.stringResource
import com.apostolos.tv.R
import com.apostolos.tv.ui.common.BrandLockup
import com.apostolos.tv.ui.common.CinemaBackground
import com.apostolos.tv.ui.common.focusScale
import com.apostolos.tv.ui.common.rememberIsTvFormFactor
import com.apostolos.tv.ui.common.SkeletonBox
import com.apostolos.tv.ui.theme.CinemaBlack
import com.apostolos.tv.ui.theme.CinemaDimens
import com.apostolos.tv.ui.theme.CinemaError
import com.apostolos.tv.ui.theme.CinemaOnDark
import com.apostolos.tv.ui.theme.CinemaOnDarkMuted
import com.apostolos.tv.ui.theme.CinemaPrimary
import com.apostolos.tv.ui.theme.CinemaSurface
import com.apostolos.tv.ui.theme.CinemaSurfaceBorder

@Composable
fun LoginScreen(
    viewModel: LoginViewModel,
    onLoggedIn: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val isRestoringSession = state.isLoading &&
        state.step == LoginStep.ACCOUNT &&
        state.accountEmail != null
    val isTv = rememberIsTvFormFactor()

    LaunchedEffect(state.isLoggedIn) {
        if (state.isLoggedIn) onLoggedIn()
    }

    CinemaBackground {
        if (isRestoringSession) {
            SessionRestoreOverlay(email = state.accountEmail.orEmpty())
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp, vertical = 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                LoginHero()
                Spacer(modifier = Modifier.height(28.dp))
                LoginStepIndicator(currentStep = state.step)
                Spacer(modifier = Modifier.height(16.dp))

                LoginFormCard {
                    when (state.step) {
                        LoginStep.ACCOUNT -> AccountStep(state = state, viewModel = viewModel)
                        LoginStep.XTREAM -> XtreamStep(state = state, viewModel = viewModel)
                    }
                }

                if (isTv) {
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "TV: Χρησιμοποίησε Bluetooth πληκτρολόγιο ή το app Companion για login. " +
                            "Μετά την πρώτη σύνδεση, η συνεδρία αποθηκεύεται αυτόματα.",
                        style = MaterialTheme.typography.bodySmall,
                        color = CinemaOnDarkMuted,
                        textAlign = TextAlign.Center,
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))
                Text(
                    text = stringResource(R.string.brand_full_name),
                    style = MaterialTheme.typography.labelSmall,
                    color = CinemaOnDarkMuted.copy(alpha = 0.7f),
                )
            }
        }
    }
}

@Composable
private fun LoginHero() {
    BrandLockup(
        wordmarkHeight = 52.dp,
        showTagline = true,
        showDescription = true,
    )
}

@Composable
private fun LoginStepIndicator(currentStep: LoginStep) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StepPill(
            number = 1,
            label = "Λογαριασμός",
            isActive = currentStep == LoginStep.ACCOUNT,
            isCompleted = currentStep == LoginStep.XTREAM,
        )
        Box(
            modifier = Modifier
                .width(24.dp)
                .height(2.dp)
                .background(
                    if (currentStep == LoginStep.XTREAM) {
                        CinemaPrimary.copy(alpha = 0.6f)
                    } else {
                        CinemaSurfaceBorder
                    },
                ),
        )
        StepPill(
            number = 2,
            label = "IPTV",
            isActive = currentStep == LoginStep.XTREAM,
            isCompleted = false,
        )
    }
}

@Composable
private fun StepPill(
    number: Int,
    label: String,
    isActive: Boolean,
    isCompleted: Boolean,
) {
    val background = when {
        isActive -> CinemaPrimary.copy(alpha = 0.18f)
        isCompleted -> CinemaPrimary.copy(alpha = 0.12f)
        else -> CinemaSurface.copy(alpha = 0.5f)
    }
    val borderColor = when {
        isActive -> CinemaPrimary.copy(alpha = 0.55f)
        isCompleted -> CinemaPrimary.copy(alpha = 0.35f)
        else -> CinemaSurfaceBorder.copy(alpha = 0.5f)
    }
    val textColor = when {
        isActive || isCompleted -> CinemaPrimary
        else -> CinemaOnDarkMuted
    }

    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(background)
            .border(1.dp, borderColor, RoundedCornerShape(20.dp))
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            modifier = Modifier
                .size(20.dp)
                .clip(CircleShape)
                .background(if (isActive || isCompleted) CinemaPrimary else CinemaSurfaceBorder),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = number.toString(),
                style = MaterialTheme.typography.labelSmall,
                color = if (isActive || isCompleted) CinemaBlack else CinemaOnDarkMuted,
            )
        }
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = textColor,
        )
    }
}

@Composable
private fun LoginFormCard(content: @Composable () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = 1.dp,
                brush = Brush.verticalGradient(
                    colors = listOf(
                        CinemaPrimary.copy(alpha = 0.25f),
                        CinemaSurfaceBorder.copy(alpha = 0.3f),
                    ),
                ),
                shape = RoundedCornerShape(20.dp),
            ),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = CinemaSurface.copy(alpha = 0.72f),
        ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(CinemaDimens.screenPadding),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            content()
        }
    }
}

@Composable
private fun AccountStep(
    state: LoginUiState,
    viewModel: LoginViewModel,
) {
    Text(
        text = if (state.isRegister) "Δημιουργία λογαριασμού" else "Καλώς ήρθες",
        style = MaterialTheme.typography.titleLarge,
        color = CinemaOnDark,
    )
    Text(
        text = "Συγχρονισμός ιστορικού, αγαπημένων και ρυθμίσεων σε όλες τις συσκευές.",
        style = MaterialTheme.typography.bodySmall,
        color = CinemaOnDarkMuted,
    )

    FeatureRow(icon = Icons.Default.CloudSync, text = "Συγχρονισμός cloud")
    FeatureRow(icon = Icons.Default.History, text = "Συνέχεια παρακολούθησης")
    FeatureRow(icon = Icons.Default.Star, text = "Αγαπημένα")

    Spacer(modifier = Modifier.height(4.dp))

    LoginTextField(
        value = state.email,
        onValueChange = viewModel::onEmailChange,
        label = "Email",
        icon = Icons.Default.Email,
        keyboardType = KeyboardType.Email,
    )
    PasswordField(
        value = state.accountPassword,
        onValueChange = viewModel::onAccountPasswordChange,
        label = "Κωδικός",
    )

    Text(
        text = if (state.isRegister) {
            "Έχεις ήδη λογαριασμό; Σύνδεση"
        } else {
            "Δεν έχεις λογαριασμό; Εγγραφή"
        },
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .clickable(enabled = !state.isLoading, onClick = viewModel::toggleRegisterMode)
            .padding(vertical = 8.dp),
        style = MaterialTheme.typography.bodyMedium,
        color = CinemaPrimary,
        textAlign = TextAlign.Center,
    )

    LoginErrorBanner(message = state.errorMessage)
    LoginButton(
        label = if (state.isRegister) "Εγγραφή" else "Σύνδεση",
        isLoading = state.isLoading,
        onClick = viewModel::submitAccount,
    )
}

@Composable
private fun XtreamStep(
    state: LoginUiState,
    viewModel: LoginViewModel,
) {
    Text(
        text = "Σύνδεση IPTV",
        style = MaterialTheme.typography.titleLarge,
        color = CinemaOnDark,
    )
    Text(
        text = "Σύνδεσε τον Xtream server σου. Αποθηκεύεται στον cloud λογαριασμό σου.",
        style = MaterialTheme.typography.bodySmall,
        color = CinemaOnDarkMuted,
    )

    state.accountEmail?.let { email ->
        AccountChip(email = email)
    }

    LoginTextField(
        value = state.playlistName,
        onValueChange = viewModel::onPlaylistNameChange,
        label = "Όνομα playlist",
        icon = Icons.Default.PlaylistPlay,
        placeholder = "π.χ. Κύρια, Backup",
    )
    LoginTextField(
        value = state.serverUrl,
        onValueChange = viewModel::onServerUrlChange,
        label = "Server URL",
        icon = Icons.Default.Link,
        placeholder = "http://host:port",
        keyboardType = KeyboardType.Uri,
    )
    LoginTextField(
        value = state.username,
        onValueChange = viewModel::onUsernameChange,
        label = "Username",
        icon = Icons.Default.Person,
    )
    PasswordField(
        value = state.password,
        onValueChange = viewModel::onPasswordChange,
        label = "Password",
    )

    LoginErrorBanner(message = state.errorMessage)
    LoginButton(
        label = "Συνέχεια",
        isLoading = state.isLoading,
        onClick = viewModel::connectXtream,
    )
}

@Composable
private fun AccountChip(email: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(CinemaPrimary.copy(alpha = 0.1f))
            .border(1.dp, CinemaPrimary.copy(alpha = 0.25f), RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(
            modifier = Modifier
                .size(28.dp)
                .clip(CircleShape)
                .background(CinemaPrimary.copy(alpha = 0.2f)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = email.firstOrNull()?.uppercaseChar()?.toString() ?: "?",
                style = MaterialTheme.typography.labelMedium,
                color = CinemaPrimary,
            )
        }
        Column {
            Text(
                text = "Συνδεδεμένος",
                style = MaterialTheme.typography.labelSmall,
                color = CinemaOnDarkMuted,
            )
            Text(
                text = email,
                style = MaterialTheme.typography.bodySmall,
                color = CinemaOnDark,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun FeatureRow(icon: ImageVector, text: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = CinemaPrimary.copy(alpha = 0.85f),
            modifier = Modifier.size(16.dp),
        )
        Text(
            text = text,
            style = MaterialTheme.typography.labelMedium,
            color = CinemaOnDarkMuted,
        )
    }
}

@Composable
private fun LoginTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    icon: ImageVector,
    placeholder: String = "",
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        placeholder = placeholder.takeIf { it.isNotBlank() }?.let { hint -> { Text(hint) } },
        leadingIcon = {
            Icon(imageVector = icon, contentDescription = null, tint = CinemaOnDarkMuted)
        },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        shape = RoundedCornerShape(12.dp),
        colors = loginFieldColors(),
    )
}

@Composable
private fun PasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
) {
    var visible by remember { mutableStateOf(false) }

    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        leadingIcon = {
            Icon(imageVector = Icons.Default.Lock, contentDescription = null, tint = CinemaOnDarkMuted)
        },
        trailingIcon = {
            IconButton(onClick = { visible = !visible }) {
                Icon(
                    imageVector = if (visible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                    contentDescription = if (visible) "Απόκρυψη" else "Εμφάνιση",
                    tint = CinemaOnDarkMuted,
                )
            }
        },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
        visualTransformation = if (visible) {
            VisualTransformation.None
        } else {
            PasswordVisualTransformation()
        },
        shape = RoundedCornerShape(12.dp),
        colors = loginFieldColors(),
    )
}

@Composable
private fun LoginErrorBanner(message: String?) {
    if (message.isNullOrBlank()) return
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(CinemaError.copy(alpha = 0.12f))
            .border(1.dp, CinemaError.copy(alpha = 0.35f), RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = message,
            color = CinemaError,
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
private fun LoginButton(
    label: String,
    isLoading: Boolean,
    onClick: () -> Unit,
) {
    Spacer(modifier = Modifier.height(4.dp))
    Button(
        onClick = onClick,
        enabled = !isLoading,
        modifier = Modifier
            .fillMaxWidth()
            .height(if (rememberIsTvFormFactor()) 58.dp else 52.dp)
            .focusScale(),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = CinemaPrimary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
        ),
    ) {
        if (isLoading) {
            SkeletonBox(
                modifier = Modifier
                    .fillMaxWidth(0.4f)
                    .height(14.dp),
                cornerRadius = 7.dp,
            )
        } else {
            Text(label, style = MaterialTheme.typography.labelLarge)
        }
    }
}

@Composable
private fun SessionRestoreOverlay(email: String) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(CinemaBlack),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            LoginHero()
            Spacer(modifier = Modifier.height(32.dp))
            CircularProgressIndicator(color = CinemaPrimary, strokeWidth = 2.dp)
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Επανασύνδεση…",
                style = MaterialTheme.typography.titleMedium,
                color = CinemaOnDark,
            )
            Text(
                text = email,
                style = MaterialTheme.typography.bodySmall,
                color = CinemaOnDarkMuted,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
private fun loginFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = CinemaPrimary,
    unfocusedBorderColor = CinemaSurfaceBorder,
    focusedContainerColor = CinemaSurface.copy(alpha = 0.6f),
    unfocusedContainerColor = CinemaSurface.copy(alpha = 0.35f),
    cursorColor = CinemaPrimary,
)
