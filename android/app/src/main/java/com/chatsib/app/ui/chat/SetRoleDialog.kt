package com.chatsib.app.ui.chat

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import com.chatsib.app.ui.theme.ElementColors
import com.chatsib.app.ui.theme.chatSibTextButtonColors

@Composable
fun SetRoleDialog(
    username: String,
    currentRole: String,
    onDismiss: () -> Unit,
    onConfirm: (role: String) -> Unit,
) {
    val nextRole = if (currentRole == "moderator") "user" else "moderator"
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = ElementColors.ModalPanel.background,
        title = { Text("Set role for @$username") },
        text = { Text("Current role: $currentRole. Set to $nextRole?") },
        confirmButton = {
            TextButton(onClick = { onConfirm(nextRole) }, colors = chatSibTextButtonColors()) {
                Text("Set $nextRole")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, colors = chatSibTextButtonColors()) {
                Text("Cancel")
            }
        },
    )
}
