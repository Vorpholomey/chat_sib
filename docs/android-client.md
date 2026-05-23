# Chat Sib — Android client (implemented functionality)

This document describes what the **Android application** in `android/` implements today. It is intended for onboarding, QA, and parity checks against the web SPA. For setup commands and phase-by-phase manual tests, see [`android/README.md`](../android/README.md). For monorepo-wide architecture, see [`architecture.mdc`](../architecture.mdc) §7.

**Package:** `com.chatsib.app` · **Min SDK:** 26 · **Target/compile SDK:** 35 · **Version:** 0.1.0

---

## 1. Purpose and backend contract

The Android client is a **native Kotlin + Jetpack Compose** app that talks to the same **chat_sib** backend as the React web client:

- **REST** (Retrofit + OkHttp) for auth, uploads, history, search, moderation, read state, and message edits.
- **WebSocket** (`/ws/chat?token=…`) for realtime messages, reactions, pins, and deletes.
- **No separate mobile API** — payloads and routes mirror the web (`useChatSocket`, `messageMap`, OpenAPI).

The app does **not** implement push notifications (FCM) or offline-first sync beyond local caches (tokens, read cursors, waveform peaks).

---

## 2. Technology stack

| Layer | Technology |
|-------|------------|
| UI | Jetpack Compose, Material 3 |
| DI | Hilt |
| HTTP | Retrofit 2, OkHttp 4, kotlinx.serialization |
| Realtime | OkHttp WebSocket |
| JWT storage | AndroidX Security **EncryptedSharedPreferences** |
| Images | Coil |
| Video / audio playback | Media3 ExoPlayer (+ OkHttp `DataSource` for authenticated streams) |
| Audio waveform | `MediaExtractor` / `MediaCodec` peak decode, in-memory cache |
| Read-state cache | DataStore Preferences |
| Rich text (display) | WebView (`RichTextBody`), JS disabled |
| Rich text (compose) | WebView `contentEditable` (`RichTextEditor`) + formatting toolbar |
| CI | `.github/workflows/android-ci.yml` — `assembleDebug`, unit tests |

---

## 3. Application structure

```
android/app/src/main/java/com/chatsib/app/
├── MainActivity.kt              # Single-activity host
├── ChatSibApplication.kt        # Hilt application
├── core/                        # Shared utilities (no UI)
├── data/                        # Repositories, APIs, WebSocket, DTOs
├── data/chat/                   # WS parsing, message mapping
├── data/local/                  # TokenStore, ApiSettingsStore
├── data/read/                   # ReadStateRepository
├── data/remote/                 # Retrofit service interfaces
├── data/session/                # SessionManager
├── di/                          # Hilt modules (Network, Audio entry points)
├── domain/model/                # ChatLine, scopes, reactions
└── ui/
    ├── auth/                    # Login, register, forgot/change password
    ├── chat/                    # Main chat UI and ViewModel
    ├── navigation/              # AppNavHost, routes
    └── theme/                   # Material theme
```

### Navigation flow

| Screen | Route | When shown |
|--------|-------|------------|
| Login | `login` | Start; after logout / permanent ban |
| Register | `register` | From login |
| Forgot password | `forgot_password` | From login |
| Change password | `change_password` | After login with temporary password, or session event `PASSWORD_CHANGE_REQUIRED` |
| Main chat | `main_chat` | Authenticated session ready |

`SessionManager` emits session events (logout, permanent ban, password change required) that `AppNavHost` handles by navigating and clearing state.

---

## 4. Authentication and session

### Implemented flows

- **Register** — `POST /auth/register`; stores access + refresh tokens.
- **Login** — `POST /auth/login`; handles:
  - `must_change_password` → navigate to change-password screen.
  - `TEMPORARY_PASSWORD_EXPIRED` — user-visible error (aligned with `auth_constants.py` / web `authErrors.ts`).
  - `ACCOUNT_PERMANENTLY_BANNED` — blocked with stable error string.
- **Token refresh** — `AuthInterceptor` on 401 retries with refresh token (separate OkHttp client without auth interceptor to avoid loops).
- **Forgot password** — `POST /auth/forgot-password`; generic success message (no account enumeration).
- **Change password after temporary** — `POST /auth/change-password-after-temporary`; new token pair; clears temporary-password gate.
- **Logout** — clears encrypted token store and disconnects WebSocket.

### Token storage

- Access and refresh JWT in **EncryptedSharedPreferences** (`TokenStore`).
- WebSocket connects with `?token=` query param (same as web).

### Session gates (server-enforced; client reflects)

- **Permanent public ban** — login/refresh blocked; WS close `4003`; HTTP 403 `ACCOUNT_PERMANENTLY_BANNED`.
- **Temporary password** — must change password before full chat access; WS close `4403` `PASSWORD_CHANGE_REQUIRED`.

---

## 5. Main chat shell

### Layout (`MainChatScreen` + `ChatThread`)

- **Top bar** — thread title (Global or `@username`), connection/status, search controls when active.
- **Drawer** (`ModalNavigationDrawer`):
  - **Global** — public room.
  - **Dialogues** — private conversation list (`GET /api/private/conversations`).
  - **People** — user list (`GET /api/users`), long-press moderation actions.
  - **Debug only** — footer row **API: {url}** opens dialog to override base URL (DataStore); Retrofit/WS use `DynamicBaseUrlInterceptor` + `ApiBaseUrlProvider`.
- **Message list** — `LazyColumn` with scroll-up pagination, unread divider, pinned bar (global).
- **Composer** — attach, rich-text editor, send or hold-to-record mic; reply/edit banners.

### Chat scopes

| Scope | `chat_id` for read API | Messages source |
|-------|------------------------|-----------------|
| Global | `"global"` | `ChatWebSocket.globalMessages` + history REST |
| Private DM | peer user id (decimal string) | Per-peer map in `ChatWebSocket.privateMessages` + `GET /api/private/messages/{user_id}` |

Switching scope reloads private history when needed and resets read-state tracking for that chat.

---

## 6. Realtime messaging (WebSocket)

`ChatWebSocket` maintains connection lifecycle and parses inbound JSON using `IncomingMessageParser` / `MessageMapper` (aligned with web `messageMap.ts`).

### Inbound event types (handled)

- `message` — new global or private message (text or media).
- `message_updated` — edit broadcast.
- `message_deleted` — remove from local list.
- `reactions_updated` — reaction counts on a message.
- `pin_changed` — global pinned message list (ordered by message `created_at`, newest first).
- `global_history_ready` — initial global snapshot after connect (last N messages, not full history).

### Outbound (send)

- **Text** — `sendGlobalText` / `sendPrivateText` with optional `reply_to_id`.
- **Media** — after `POST /upload`, `sendGlobalMedia` / `sendPrivateMedia` with URL in `text`, `content_type`, optional HTML `caption`, optional `reply_to_id`.
- **Reactions** — `reaction_toggle` with message id and kind.

Composer is **disabled** when WebSocket is not connected; snackbar shows **Not connected** on send attempts.

---

## 7. Message types and rendering

`ChatLine` supports content types: **text**, **image**, **gif**, **video**, **audio**.

| Type | Body field | Caption | Display |
|------|------------|---------|---------|
| text | HTML (sanitized subset) | — | `RichTextBody` or plain highlight |
| image / gif | Media URL | Optional HTML | Coil + optional caption below |
| video | Media URL | Optional HTML | ExoPlayer `PlayerView` + caption |
| audio | Media URL | Optional HTML | `AudioWaveformPlayer` + caption |

### Asset URLs (`AssetUrlResolver`)

- Relative paths (`/uploads/…`) joined to current API base.
- Absolute `http`/`https` preserved; unsafe schemes rejected.
- **Dev rebasing** — URLs from web Vite (`localhost`, `127.0.0.1`, port `5173`) rewritten to the app API base (e.g. `http://10.0.2.2:8000` on emulator) so media and waveforms load correctly.

### Rich text

- **Allowed HTML** (server + client): `p`, `br`, `strong`, `b`, `em`, `i`, `a` (http/https only).
- **Sanitization** — `RichTextSanitizer` on send and before display.
- **Composer** — `RichTextEditor`: WYSIWYG WebView with **bold**, **italic**, **link** toolbar; used for main messages, media captions, and caption edit.
- **Display** — `RichTextBody`: read-only WebView; plain text uses `HighlightedPlainText` for search highlights.

---

## 8. Media upload and voice messages

### File attach

1. User taps attach → system picker (`image/*`, `video/*`, `audio/*`).
2. `UploadRepository` multipart `POST /upload`.
3. While uploading: progress row + optional **rich-text caption** field.
4. On success: WebSocket media send with resolved URL; caption sent as sanitized HTML if non-empty.

### Voice messages (hold-to-record)

- Shown only when composer draft is **empty** and not editing (mic replaces send).
- **Pointer down** starts `VoiceRecorder` (`.m4a`, AAC in MPEG-4 container).
- **Pointer up** after ≥ ~500 ms uploads and sends; cancel on pointer leave/cancel.
- URL tagged with `?tag=Voice message` (`AudioMeta`, synced with web).
- UI label **VOICE MESSAGE** on playback row (not raw filename).

### Audio playback and waveform

Implemented per [`voice-messaging-requirements.md`](voice-messaging-requirements.md):

- **48-bar waveform** from decoded file (RMS peaks, cached per URL).
- **Play / pause**, tap-to-seek, keyboard ±5 s when focused.
- **Single active player** per thread (`InlineAudioPlaybackCoordinator`).
- **Fallback** linear progress + hint if peak analysis fails; playback still works via ExoPlayer.
- Streams use OkHttp-backed Media3 data source (auth headers); attribution tags declared in manifest (`audioPlayback`, `voiceRecord`).

---

## 9. History pagination

- Page size **20** (aligned with backend defaults).
- **Global** — `GET /api/messages/global/history?before_id=`.
- **Private** — `GET /api/private/messages/{user_id}?before_id=`.
- Triggered when user scrolls near the top (`firstVisibleItemIndex <= 2`).
- **Scroll position preserved** when prepending older items (index adjustment + loading slot).

### Jump to pinned message

- `PinnedMessageBar` shows cycling preview of pinned globals.
- Tap loads `GET /api/messages/global/context?message_id=` if message not in memory, merges into WS state, scrolls and highlights.

---

## 10. Read receipts and “new messages” UX

`ReadStateRepository` wraps canonical chat read API:

- `GET / POST /api/chats/{chat_id}/read-status`
- `POST /api/chats/{chat_id}/mark-all-read`

### Behavior

- **DataStore cache** per user + chat; server wins after GET.
- **Debounced POST** (~2.5 s) when visible messages change.
- **“New messages” divider** in list when cursor is above unread range.
- **Jump to latest FAB** when not at bottom or unread count > 0; tap scrolls to bottom via `scrollToBottomNonce` and calls `markAllRead`.
- Visibility tracking via `LazyColumn` visible items and bottom proximity (`distanceFromEnd <= 1`).

---

## 11. Reactions, replies, edit, delete

### Reactions

- Row of chips under each message (`MessageReactionsRow`).
- Heart control opens picker (five kinds).
- Toggle sends WS `reaction_toggle`; updates from `reactions_updated`.

### Replies

- Long-press → **Reply** sets `replyTo` in ViewModel.
- Composer shows `ReplyComposerBar` with quote preview.
- Sends include `reply_to_id`; incoming messages show `ReplyQuoteInBubble` / snippet.

### Edit / delete (own messages)

- Long-press menu (permissions via `RolePermissions` + `MessageMenuFlags`).
- **Edit** — REST `PUT /api/messages/{id}?scope=global|private`:
  - Text messages: body HTML updated.
  - Image/gif: **caption only** (media URL unchanged); rich-text editor prefill.
- **Delete** — REST `DELETE`; local removal via WS `message_deleted`.
- **Edited** label when `editedAt` present.

### Moderation (global + People drawer)

| Action | Who | API / WS |
|--------|-----|----------|
| Mod delete | Moderator+ | REST delete (not own message) |
| Pin / unpin | Moderator+ | REST + `pin_changed` |
| Ban user | Moderator+ (rules by role) | Moderation API; durations 1h / 24h / forever |
| Set role | Admin | Moderation API |

**Public chat ban** — own edit/delete hidden in global; composer disabled in global room when banned.

Ban/set-role dialogs: `BanDurationDialog`, `SetRoleDialog`.

---

## 12. In-chat search

- Top-bar search mode (global and private; disabled for public-banned users in global).
- `GET …/search?q=` returns match ids; **prev/next** navigates active match.
- **Highlight** in thread (`HighlightedPlainText` / sanitized HTML with query).
- **Context load** — if match not loaded, fetches context/history and scrolls (`scrollToMessageId`).
- Search UI closes on cancel; state cleared in ViewModel.

---

## 13. Configuration and networking

### API base URL

| Build | Default | Notes |
|-------|---------|--------|
| Debug | `http://10.0.2.2:8000` | Emulator → host `localhost:8000` |
| Release | Configurable in `build.gradle.kts` | Set production URL before release |

**Physical device:** set LAN IP in debug `buildConfigField` and/or debug drawer override; allow cleartext in `res/xml/network_security_config.xml` for HTTP.

### Interceptors

- `AuthInterceptor` — Bearer token, refresh on 401, 403 session events.
- `DynamicBaseUrlInterceptor` — applies `ApiBaseUrlProvider.current()` (supports debug override).
- Logging — BASIC level in debug.

### Permissions (`AndroidManifest.xml`)

- `INTERNET`
- `RECORD_AUDIO` (voice messages; runtime request on first mic use)

---

## 14. Testing and quality

### Unit tests (`app/src/test/`)

Examples of covered areas:

- `AssetUrlResolver` (including Vite localhost rebase)
- `RichTextHelper` / sanitizer-related helpers
- `IncomingMessageParser`, `MessageMapper`
- `ReadStateLogic`
- `ReactionLogic`
- `WaveformPeakExtractor`, `InlineAudioPlaybackCoordinator`

### Manual QA

Phase checklists live in [`android/README.md`](../android/README.md) (Phases 2–6, waveform, rich text).

---

## 15. Parity matrix (web SPA)

| Feature | Web | Android |
|---------|-----|---------|
| Auth + temp password + forgot password | Yes | Yes |
| Global + private chat | Yes | Yes |
| Media upload + caption | Yes | Yes (rich-text caption) |
| Voice + waveform player | Yes | Yes |
| Reactions / replies | Yes | Yes |
| Edit / delete / mod actions | Yes | Yes |
| Pins + context jump | Yes | Yes |
| Read receipts + FAB | Yes | Yes |
| In-chat search | Yes | Yes |
| Rich-text compose (bold/italic/link) | Yes | Yes |
| Emoji picker in composer | Yes | No |
| Responsive mobile shell (overlay sidebars) | Yes | Drawer (mobile-like) |
| Push notifications | No | No |

---

## 16. Not implemented (planned / out of scope)

- **FCM / push notifications** for new messages.
- **Emoji picker** in Android composer (web has emoji-mart).
- **Server-generated waveform peaks** (client decodes audio locally).
- **Offline queue** for sends when disconnected (composer blocks send instead).

---

## 17. Related documentation

| Document | Content |
|----------|---------|
| [`android/README.md`](../android/README.md) | Build, run, emulator networking, manual test steps |
| [`architecture.mdc`](../architecture.mdc) | Full monorepo architecture (§7 Android) |
| [`voice-messaging-requirements.md`](voice-messaging-requirements.md) | Voice + waveform requirements (W-*, P-*, C-*) |
| [`README.md`](../README.md) | Monorepo quick start (backend + web + Docker) |

---

*Last aligned with the codebase at implementation phases 0–6, waveform audio, rich-text WYSIWYG editor, and jump-to-latest fix.*
