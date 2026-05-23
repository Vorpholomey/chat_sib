package com.chatsib.app.core

/** Keep in sync with `backend/app/core/auth_constants.py` and `frontend/src/lib/authErrors.ts`. */
object AuthConstants {
    const val ACCOUNT_PERMANENTLY_BANNED = "Your account has been permanently banned."
    const val PASSWORD_CHANGE_REQUIRED = "PASSWORD_CHANGE_REQUIRED"
    const val TEMPORARY_PASSWORD_EXPIRED = "TEMPORARY_PASSWORD_EXPIRED"
}
