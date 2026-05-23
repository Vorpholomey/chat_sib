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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

@Composable
fun RegisterScreen(
    uiState: AuthUiState,
    onRegister: (username: String, email: String, password: String) -> Unit,
    onNavigateLogin: () -> Unit,
) {
    var username by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ElementColors.AppBackground.background)
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Create account", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = username,
            onValueChange = { username = it },
            label = { Text("Username") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = chatSibOutlinedTextFieldColors(),
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = chatSibOutlinedTextFieldColors(),
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
            colors = chatSibOutlinedTextFieldColors(),
        )
        uiState.error?.let { msg ->
            Spacer(Modifier.height(8.dp))
            Text(msg, color = ElementColors.StatusMessageError.foreground)
        }
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = { onRegister(username, email, password) },
            enabled = !uiState.loading &&
                username.isNotBlank() &&
                email.isNotBlank() &&
                password.length >= 6,
            modifier = Modifier.fillMaxWidth(),
            colors = chatSibPrimaryButtonColors(),
        ) {
            if (uiState.loading) {
                CircularProgressIndicator(modifier = Modifier.height(20.dp))
            } else {
                Text("Register")
            }
        }
        TextButton(onClick = onNavigateLogin, colors = chatSibTextButtonColors()) {
            Text("Already have an account? Sign in")
        }
    }
}
