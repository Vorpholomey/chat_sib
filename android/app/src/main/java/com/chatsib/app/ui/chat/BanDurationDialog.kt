package com.chatsib.app.ui.chat

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import com.chatsib.app.ui.theme.ElementColors
import com.chatsib.app.ui.theme.chatSibTextButtonColors

@Composable
fun BanDurationDialog(
    username: String,
    locked: Boolean = false,
    onDismiss: () -> Unit,
    onConfirm: (duration: String) -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = ElementColors.ModalPanel.background,
        title = { Text(if (locked) "Cannot ban" else "Ban @$username") },
        text = {
            if (locked) {
                Text("Moderators cannot ban admins or other moderators.")
            } else {
                Column {
                    Text("Choose ban duration:")
                    TextButton(onClick = { onConfirm("1h") }, colors = chatSibTextButtonColors()) {
                        Text("1 hour")
                    }
                    TextButton(onClick = { onConfirm("24h") }, colors = chatSibTextButtonColors()) {
                        Text("24 hours")
                    }
                    TextButton(onClick = { onConfirm("forever") }, colors = chatSibTextButtonColors()) {
                        Text("Forever")
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss, colors = chatSibTextButtonColors()) {
                Text(if (locked) "OK" else "Cancel")
            }
        },
    )
}
