package com.chatsib.app.ui.theme

import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb

@Composable
fun ChatSibTheme(
    @Suppress("UNUSED_PARAMETER") darkTheme: Boolean = true,
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = chatSibDarkColorScheme(),
        content = content,
    )
}

@Composable
fun chatSibOutlinedTextFieldColors() = TextFieldDefaults.colors(
    focusedContainerColor = ElementColors.InputDefault.background,
    unfocusedContainerColor = ElementColors.InputDefault.background,
    disabledContainerColor = ElementColors.InputDefault.background,
    focusedTextColor = ElementColors.InputDefault.foreground,
    unfocusedTextColor = ElementColors.InputDefault.foreground,
    focusedLabelColor = ElementColors.InputDefault.placeholder,
    unfocusedLabelColor = ElementColors.InputDefault.placeholder,
    focusedPlaceholderColor = ElementColors.InputDefault.placeholder,
    unfocusedPlaceholderColor = ElementColors.InputDefault.placeholder,
    cursorColor = ElementColors.InputDefault.foreground,
    focusedIndicatorColor = ElementColors.InputDefault.border,
    unfocusedIndicatorColor = ElementColors.InputDefault.border,
    errorIndicatorColor = ElementColors.StatusMessageError.foreground,
    errorCursorColor = ElementColors.StatusMessageError.foreground,
    errorLabelColor = ElementColors.StatusMessageError.foreground,
)

@Composable
fun chatSibPrimaryButtonColors() = ButtonDefaults.buttonColors(
    containerColor = ElementColors.ButtonPrimary.background,
    contentColor = ElementColors.ButtonPrimary.foreground,
    disabledContainerColor = ElementColors.ButtonPrimary.background.copy(alpha = 0.5f),
    disabledContentColor = ElementColors.ButtonPrimary.foreground.copy(alpha = 0.5f),
)

@Composable
fun chatSibTextButtonColors() = ButtonDefaults.textButtonColors(
    contentColor = ElementColors.ButtonGhost.foreground,
)

@Composable
fun chatSibSecondaryButtonColors() = ButtonDefaults.outlinedButtonColors(
    contentColor = ElementColors.ButtonSecondary.foreground,
)

@Composable
fun chatSibReactionChipColors(
    isOwn: Boolean,
    active: Boolean,
) = FilterChipDefaults.filterChipColors(
    containerColor = when {
        isOwn && active -> ElementColors.MessageReactionChipOwn.backgroundActive
        isOwn -> ElementColors.MessageReactionChipOwn.backgroundInactive
        active -> ElementColors.MessageReactionChipOther.backgroundActive
        else -> ElementColors.MessageReactionChipOther.backgroundInactive
    },
    labelColor = when {
        isOwn && active -> ElementColors.MessageReactionChipOwn.foregroundActive
        isOwn -> ElementColors.MessageReactionChipOwn.foregroundInactive
        else -> ElementColors.MessageReactionChipOther.foreground
    },
    selectedContainerColor = when {
        isOwn -> ElementColors.MessageReactionChipOwn.backgroundActive
        else -> ElementColors.MessageReactionChipOther.backgroundActive
    },
    selectedLabelColor = when {
        isOwn -> ElementColors.MessageReactionChipOwn.foregroundActive
        else -> ElementColors.MessageReactionChipOther.foreground
    },
)

fun Color.toRgbHex(): String = String.format("#%06X", 0xFFFFFF and toArgb())
