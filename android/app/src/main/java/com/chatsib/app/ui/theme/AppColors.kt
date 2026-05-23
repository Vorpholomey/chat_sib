package com.chatsib.app.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Raw palette + semantic tokens aligned with `frontend/src/index.css` `@theme`.
 */
object AppColors {
    // Slate
    val Slate950 = Color(0xFF020617)
    val Slate900 = Color(0xFF0F172A)
    val Slate800 = Color(0xFF1E293B)
    val Slate700 = Color(0xFF334155)
    val Slate600 = Color(0xFF475569)
    val Slate500 = Color(0xFF64748B)
    val Slate400 = Color(0xFF94A3B8)
    val Slate300 = Color(0xFFCBD5E1)
    val Slate200 = Color(0xFFE2E8F0)
    val Slate100 = Color(0xFFF1F5F9)

    // Violet
    val Violet950 = Color(0xFF2E1065)
    val Violet800 = Color(0xFF5B21B6)
    val Violet600 = Color(0xFF7C3AED)
    val Violet500 = Color(0xFF8B5CF6)
    val Violet400 = Color(0xFFA78BFA)
    val Violet300 = Color(0xFFC4B5FD)

    // Sky
    val Sky900 = Color(0xFF0C4A6E)
    val Sky500 = Color(0xFF0EA5E9)
    val Sky400 = Color(0xFF38BDF8)

    // Amber accents (search / highlights)
    val Amber500 = Color(0xFFF59E0B)
    val Amber400 = Color(0xFFFBBF24)

    val Violet100 = Color(0xFFEDE9FE)

    // Amber
    val Amber950 = Color(0xFF451A03)
    val Amber900 = Color(0xFF78350F)
    val Amber700 = Color(0xFFB45309)
    val Amber200 = Color(0xFFFDE68A)
    val Amber100 = Color(0xFFFEF3C7)

    // Rose / red / emerald
    val Rose900 = Color(0xFF881337)
    val Rose200 = Color(0xFFFECDD3)
    val Red300 = Color(0xFFFCA5A5)
    val Emerald400 = Color(0xFF34D399)

    val Black = Color(0xFF000000)
    val White = Color(0xFFFFFFFF)

    // Semantic (@theme in index.css)
    val Background = Slate950
    val Surface = Slate900
    val SurfaceElevated = Slate800
    val Foreground = Slate100
    val ForegroundMuted = Slate400
    val ForegroundOnPrimary = White
    val Border = Slate800
    val BorderStrong = Slate700
    val Primary = Violet600
    val PrimaryHover = Violet500
    val Accent = Violet300
    val Link = Violet400
    val Warning = Amber100
    val WarningSurface = Amber950.copy(alpha = 0.4f)
    val Unread = Sky400
    val Danger = Red300
    val Success = Emerald400

    val RoleUser = Slate700.copy(alpha = 0.8f)
    val RoleUserFg = Slate200
    val RoleMod = Amber900.copy(alpha = 0.6f)
    val RoleModFg = Amber200
    val RoleAdmin = Rose900.copy(alpha = 0.5f)
    val RoleAdminFg = Rose200

    /** violet-500 @ 50% — focus rings */
    val PrimaryFocusRing = Violet500.copy(alpha = 0.5f)

    /** sky-500 @ 40% — unread divider line */
    val UnreadLine = Sky500.copy(alpha = 0.4f)

    /** Modal overlay */
    val ModalOverlay = Black.copy(alpha = 0.6f)

    /** surface @ 80% */
    val Surface80 = Surface.copy(alpha = 0.8f)

    /** amber-700 @ 50% */
    val WarningBorder50 = Amber700.copy(alpha = 0.5f)

    /** amber-100 @ 90% */
    val WarningForeground90 = Amber100.copy(alpha = 0.9f)

    /** violet-950 @ 35% */
    val MessageBubbleOwnBg = Violet950.copy(alpha = 0.35f)

    /** violet-800 @ 35% */
    val MessageBubbleOwnBorder = Violet800.copy(alpha = 0.35f)

    /** slate-800 @ 75% */
    val MessageBubbleOtherBg = Slate800.copy(alpha = 0.75f)

    /** slate-700 @ 80% */
    val MessageBubbleOtherBorder = Slate700.copy(alpha = 0.8f)

    /** slate-800 @ 95% */
    val SurfaceElevated95 = Slate800.copy(alpha = 0.95f)

    /** slate-900 @ 50% — reply quote in bubble */
    val Surface50 = Surface.copy(alpha = 0.5f)

    /** slate-600 @ 80% */
    val Slate600_80 = Slate600.copy(alpha = 0.8f)

    /** slate-800 @ 60% */
    val Slate800_60 = Slate800.copy(alpha = 0.6f)

    /** slate-900 @ 40% */
    val Slate900_40 = Slate900.copy(alpha = 0.4f)

    /** slate-900 @ 50% */
    val Slate900_50 = Slate900.copy(alpha = 0.5f)

    /** amber-400 @ 85% — in-chat search active ring */
    val Amber400_85 = Amber400.copy(alpha = 0.85f)

    /** amber-500 @ 35% — inline search <mark> */
    val Amber500_35 = Amber500.copy(alpha = 0.35f)

    /** violet-500 @ 50% */
    val Violet500_50 = Violet500.copy(alpha = 0.5f)

    /** violet-600 @ 25% */
    val Violet600_25 = Violet600.copy(alpha = 0.25f)

    /** violet-800 @ 30% */
    val Violet800_30 = Violet800.copy(alpha = 0.3f)

    /** sky-500 @ 45% */
    val Sky500_45 = Sky500.copy(alpha = 0.45f)

    /** sky-900 @ 35% */
    val Sky900_35 = Sky900.copy(alpha = 0.35f)

    /** slate-600 @ 60% */
    val Slate600_60 = Slate600.copy(alpha = 0.6f)
}
