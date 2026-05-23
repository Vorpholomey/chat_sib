package com.chatsib.app.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * UI element → semantic color parts; mirrors `frontend/src/ui/tokens/elementColors.ts`.
 */
object ElementColors {
    object AppBackground {
        val background: Color = AppColors.Background
        val foreground: Color = AppColors.Foreground
    }

    object ButtonPrimary {
        val background: Color = AppColors.Primary
        val foreground: Color = AppColors.ForegroundOnPrimary
        val focusRing: Color = AppColors.PrimaryFocusRing
    }

    object ButtonSecondary {
        val border: Color = AppColors.BorderStrong
        val foreground: Color = AppColors.Foreground
        val backgroundHover: Color = AppColors.SurfaceElevated
    }

    object ButtonGhost {
        val foreground: Color = AppColors.Accent
        val backgroundHover: Color = AppColors.SurfaceElevated
    }

    object ButtonDanger {
        val foreground: Color = AppColors.Danger
        val backgroundHover: Color = AppColors.SurfaceElevated
    }

    object InputDefault {
        val background: Color = AppColors.Background
        val border: Color = AppColors.BorderStrong
        val foreground: Color = AppColors.Foreground
        val placeholder: Color = AppColors.ForegroundMuted
        val focusRing: Color = AppColors.PrimaryFocusRing
    }

    object CardDefault {
        val background: Color = AppColors.Surface80
        val border: Color = AppColors.Border
    }

    object ModalOverlay {
        val background: Color = AppColors.ModalOverlay
    }

    object ModalPanel {
        val background: Color = AppColors.Surface
        val border: Color = AppColors.Border
    }

    object LinkDefault {
        val foreground: Color = AppColors.Link
    }

    object BadgeRoleUser {
        val background: Color = AppColors.RoleUser
        val foreground: Color = AppColors.RoleUserFg
    }

    object BadgeRoleModerator {
        val background: Color = AppColors.RoleMod
        val foreground: Color = AppColors.RoleModFg
    }

    object BadgeRoleAdmin {
        val background: Color = AppColors.RoleAdmin
        val foreground: Color = AppColors.RoleAdminFg
    }

    object AlertWarning {
        val background: Color = AppColors.WarningSurface
        val border: Color = AppColors.WarningBorder50
        val foreground: Color = AppColors.Warning
    }

    object DividerUnread {
        val line: Color = AppColors.UnreadLine
        val label: Color = AppColors.Unread
    }

    object MessageBubbleOwn {
        val background: Color = AppColors.MessageBubbleOwnBg
        val border: Color = AppColors.MessageBubbleOwnBorder
    }

    object MessageBubbleOther {
        val background: Color = AppColors.MessageBubbleOtherBg
        val border: Color = AppColors.MessageBubbleOtherBorder
    }

    object PinnedBar {
        val background: Color = AppColors.WarningSurface
        val border: Color = AppColors.WarningBorder50
        val foreground: Color = AppColors.WarningForeground90
    }

    object ChatHeaderAction {
        val border: Color = AppColors.BorderStrong
        val foreground: Color = AppColors.Accent
        val backgroundHover: Color = AppColors.SurfaceElevated
    }

    object JumpToUnreadFab {
        val background: Color = AppColors.SurfaceElevated95
        val focusRing: Color = AppColors.Sky500
    }

    object ReplyQuoteInBubble {
        val border: Color = AppColors.Slate600_80
        val foreground: Color = AppColors.Slate500
        val background: Color = AppColors.Surface50
    }

    object MessageEditedLabel {
        val foreground: Color = AppColors.Slate500
    }

    object MessageSearchActive {
        val border: Color = AppColors.Amber400_85
    }

    object MessageSearchHighlight {
        val background: Color = AppColors.Amber500_35
    }

    object MessageReactionChipOwn {
        val borderActive: Color = AppColors.Violet500_50
        val backgroundActive: Color = AppColors.Violet600_25
        val borderInactive: Color = AppColors.Violet800_30
        val backgroundInactive: Color = AppColors.Slate900_40
        val foregroundActive: Color = AppColors.Violet100
        val foregroundInactive: Color = AppColors.Slate300
    }

    object MessageReactionChipOther {
        val borderActive: Color = AppColors.Sky500_45
        val backgroundActive: Color = AppColors.Sky900_35
        val borderInactive: Color = AppColors.Slate600_60
        val backgroundInactive: Color = AppColors.Slate900_50
        val foreground: Color = AppColors.Slate300
    }

    object ConnectionBadge {
        val connected: Color = AppColors.Primary
        val connecting: Color = AppColors.Accent
        val disconnected: Color = AppColors.Danger
    }

    object ComposerStatusError {
        val foreground: Color = AppColors.Danger
    }

    object StatusMessageSuccess {
        val foreground: Color = AppColors.Success
    }

    object StatusMessageError {
        val foreground: Color = AppColors.Danger
    }

    object RichTextFormatMenu {
        val background: Color = AppColors.SurfaceElevated
    }

    object DrawerSheet {
        val background: Color = AppColors.Surface
    }
}
