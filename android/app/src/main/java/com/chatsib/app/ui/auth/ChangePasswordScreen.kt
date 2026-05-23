package com.chatsib.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import com.chatsib.app.ui.theme.ElementColors
import com.chatsib.app.ui.theme.chatSibOutlinedTextFieldColors
import com.chatsib.app.ui.theme.chatSibPrimaryButtonColors
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

@Composable
fun ChangePasswordScreen(
    uiState: AuthUiState,
    onSubmit: (newPassword: String, confirmPassword: String) -> Unit,
) {
    var newPassword by rememberSaveable { mutableStateOf("") }
    var confirmPassword by rememberSaveable { mutableStateOf("") }
    val passwordsMatch = newPassword == confirmPassword
    val valid = newPassword.length >= 6 && passwordsMatch

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ElementColors.AppBackground.background)
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Set a new password", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        Text(
            "Your account uses a temporary password. Choose a permanent password to continue.",
            style = MaterialTheme.typography.bodyMedium,
        )
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = newPassword,
            onValueChange = { newPassword = it },
            label = { Text("New password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
            colors = chatSibOutlinedTextFieldColors(),
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = confirmPassword,
            onValueChange = { confirmPassword = it },
            label = { Text("Confirm password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
            isError = confirmPassword.isNotEmpty() && !passwordsMatch,
            colors = chatSibOutlinedTextFieldColors(),
        )
        if (confirmPassword.isNotEmpty() && !passwordsMatch) {
            Text("Passwords do not match", color = ElementColors.StatusMessageError.foreground)
        }
        uiState.error?.let { msg ->
            Spacer(Modifier.height(8.dp))
            Text(msg, color = ElementColors.StatusMessageError.foreground)
        }
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = { onSubmit(newPassword, confirmPassword) },
            enabled = !uiState.loading && valid,
            modifier = Modifier.fillMaxWidth(),
            colors = chatSibPrimaryButtonColors(),
        ) {
            if (uiState.loading) {
                CircularProgressIndicator(modifier = Modifier.height(20.dp))
            } else {
                Text("Save password")
            }
        }
    }
}
