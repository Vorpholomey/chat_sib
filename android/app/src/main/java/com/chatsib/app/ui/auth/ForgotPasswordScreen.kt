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
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import com.chatsib.app.ui.theme.ElementColors
import com.chatsib.app.ui.theme.chatSibOutlinedTextFieldColors
import com.chatsib.app.ui.theme.chatSibPrimaryButtonColors
import com.chatsib.app.ui.theme.chatSibTextButtonColors
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ForgotPasswordScreen(
    uiState: AuthUiState,
    onSubmit: (email: String) -> Unit,
    onNavigateBack: () -> Unit,
) {
    var email by rememberSaveable { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ElementColors.AppBackground.background)
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Forgot password", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Enter your email and we will send reset instructions if an account exists.",
            style = MaterialTheme.typography.bodyMedium,
            color = ElementColors.InputDefault.placeholder,
        )
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = chatSibOutlinedTextFieldColors(),
        )
        uiState.error?.let { msg ->
            Spacer(Modifier.height(8.dp))
            Text(msg, color = ElementColors.StatusMessageError.foreground)
        }
        uiState.successMessage?.let { msg ->
            Spacer(Modifier.height(8.dp))
            Text(msg, color = ElementColors.StatusMessageSuccess.foreground)
        }
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = { onSubmit(email) },
            enabled = !uiState.loading && email.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
            colors = chatSibPrimaryButtonColors(),
        ) {
            if (uiState.loading) {
                CircularProgressIndicator(modifier = Modifier.height(20.dp))
            } else {
                Text("Send reset email")
            }
        }
        TextButton(onClick = onNavigateBack, colors = chatSibTextButtonColors()) {
            Text("Back to sign in")
        }
    }
}
