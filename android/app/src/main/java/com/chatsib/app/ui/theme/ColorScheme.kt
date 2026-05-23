package com.chatsib.app.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme

fun chatSibDarkColorScheme(): ColorScheme = darkColorScheme(
    primary = AppColors.Primary,
    onPrimary = AppColors.ForegroundOnPrimary,
    primaryContainer = AppColors.MessageBubbleOwnBg,
    onPrimaryContainer = AppColors.Foreground,
    secondary = AppColors.Accent,
    onSecondary = AppColors.Background,
    secondaryContainer = AppColors.SurfaceElevated,
    onSecondaryContainer = AppColors.Foreground,
    tertiary = AppColors.Link,
    onTertiary = AppColors.ForegroundOnPrimary,
    tertiaryContainer = AppColors.WarningSurface,
    onTertiaryContainer = AppColors.WarningForeground90,
    background = AppColors.Background,
    onBackground = AppColors.Foreground,
    surface = AppColors.Surface,
    onSurface = AppColors.Foreground,
    surfaceVariant = AppColors.SurfaceElevated,
    onSurfaceVariant = AppColors.ForegroundMuted,
    error = AppColors.Danger,
    onError = AppColors.Background,
    outline = AppColors.BorderStrong,
    outlineVariant = AppColors.Border,
    inverseSurface = AppColors.Foreground,
    inverseOnSurface = AppColors.Background,
    inversePrimary = AppColors.PrimaryHover,
)
