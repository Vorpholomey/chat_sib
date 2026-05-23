package com.chatsib.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chatsib.app.ui.theme.ElementColors

@Composable
fun RoleBadge(
    role: String,
    modifier: Modifier = Modifier,
) {
    val (background, foreground, label) = when (role) {
        "admin" -> Triple(
            ElementColors.BadgeRoleAdmin.background,
            ElementColors.BadgeRoleAdmin.foreground,
            "Admin",
        )
        "moderator" -> Triple(
            ElementColors.BadgeRoleModerator.background,
            ElementColors.BadgeRoleModerator.foreground,
            "Mod",
        )
        else -> Triple(
            ElementColors.BadgeRoleUser.background,
            ElementColors.BadgeRoleUser.foreground,
            "User",
        )
    }
    Text(
        text = label,
        modifier = modifier
            .background(background, RoundedCornerShape(4.dp))
            .padding(horizontal = 6.dp, vertical = 2.dp),
        color = foreground,
        style = MaterialTheme.typography.labelSmall.copy(
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.5.sp,
        ),
    )
}
