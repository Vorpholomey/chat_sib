# Chat Sib — Android client

Kotlin + Jetpack Compose client for the **chat_sib** backend.

**Full feature documentation:** [`docs/android-client.md`](../docs/android-client.md) Phase 0–6 covers auth (including **forgot password**), encrypted token storage, **global chat**, **private DMs**, **media + voice messages** (with **waveform visualization** for audio), scroll-up history, **pinned messages**, **read receipts**, **reactions**, **replies**, **edit/delete**, **in-chat search**, **moderation**, and debug API override.

## Prerequisites

- JDK **17**
- Android Studio Ladybug (or newer) with Android SDK **35**
- Backend running at `http://127.0.0.1:8000` (see repo root `README.md`)

## API base URL

| Build type | `BuildConfig.API_BASE_URL` | Notes |
|------------|---------------------------|--------|
| **debug** | `http://10.0.2.2:8000` | Android emulator → host machine `localhost:8000` |
| **release** | placeholder HTTPS URL | Set your production API before shipping |

**Physical device**: use your machine’s LAN IP, e.g. `http://192.168.1.10:8000`, in `app/build.gradle.kts` `debug` `buildConfigField`, and add that host to `res/xml/network_security_config.xml` if using HTTP.

## Run locally

1. Start Postgres + API (from repo root):

   ```bash
   cd backend
   source .venv/bin/activate
   alembic upgrade head
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. Open `android/` in Android Studio → **Run** on an emulator (API 26+).

3. Register or sign in; the app opens **Main chat** with a drawer (**Global | Dialogues | People**) and connects to `ws://10.0.2.2:8000/ws/chat?token=…`.

## Command line

```bash
cd android
./gradlew :app:assembleDebug
./gradlew :app:testDebugUnitTest
```

## Package layout

- `com.chatsib.app.ui.theme` — `AppColors`, `ElementColors` (mirrors `frontend/src/ui/tokens/`), `ChatSibTheme`
- `com.chatsib.app.core` — `AssetUrlResolver`, `MediaKindDetector`, `RichTextSanitizer`, `UsernameColor`
- `com.chatsib.app.data` — Retrofit APIs, `ChatRepository`, `UploadRepository`, encrypted `TokenStore`, `ChatWebSocket`
- `com.chatsib.app.data.chat` — `IncomingMessageParser`, `MessageMapper` (mirrors web `useChatSocket` / `messageMap`)
- `com.chatsib.app.ui.chat` — `MainChatScreen`, `ChatThread`, `MessageLineContent`, `RichTextBody`, `MainChatViewModel`

## Phase 2 (implemented)

- **WebSocket** (`ChatWebSocket`): global + per-peer private message maps; send/receive/update/delete
- **REST**: `GET /api/users`, `GET /api/private/conversations`, `GET /api/private/messages/{user_id}`
- **UI**: `ModalNavigationDrawer` with Global / Dialogues / People; switch global ↔ private threads

## Phase 3 (implemented)

- **Upload**: `POST /upload` via Retrofit multipart (`UploadApi` / `UploadRepository`)
- **WebSocket media**: `sendGlobalMedia` / `sendPrivateMedia` with `text` = resolved URL, `content_type`, optional plain-text `caption`
- **Asset URLs**: `AssetUrlResolver` (mirrors web `assetUrl`; rejects unsafe schemes)
- **Display**: Coil for image/gif; Media3 ExoPlayer for video/audio; `RichTextBody` (sanitized HTML in a JS-disabled WebView)
- **Composer**: attach → system document picker (`OpenDocument` for image/video/audio); upload progress; optional **rich-text caption** (bold/italic/link via long-press on selection) while uploading; main message composer uses the same WYSIWYG editor

### Media testing notes

1. Start the backend with uploads enabled (`uploads/` directory writable).
2. Emulator debug build uses `http://10.0.2.2:8000` — uploaded paths resolve to that host automatically.
3. **Attach** (paperclip) → pick PNG/JPG/GIF, MP4/WebM, or MP3/WAV → wait for “Uploading…” → message appears in thread.
4. Add an optional **Caption** while the upload runs (plain text in Phase 3).
5. Cross-check with the web client: send an image from web, confirm it renders in Android (and vice versa).
6. Physical device: set `API_BASE_URL` to your LAN IP and allow cleartext in `network_security_config.xml` if using HTTP.

## Phase 4 (implemented)

- **Scroll-up pagination**: `GET /api/messages/global/history` and private `before_id` pages (size **20**); preserves scroll position when prepending older rows
- **Pinned messages (global)**: WebSocket `pin_changed` → sticky `PinnedMessageBar`; jump loads `GET /api/messages/global/context` when needed; optional **Unpin** for moderators/admins
- **Read receipts**: `GET/POST /api/chats/{chat_id}/read-status`, `mark-all-read`; DataStore cache per user+chat (server wins on GET); debounced POST (~2.5s); **New messages** divider and jump-to-latest FAB

### Phase 4 manual test

1. Sign in on emulator; open **Global** with ≥20 messages in history.
2. Scroll to the top — older page loads; list should not jump wildly (position preserved).
3. With unread messages below the cursor, confirm **New messages** divider and FAB badge; tap FAB → scroll to bottom and mark read.
4. Pin a message from web (mod/admin); Android shows **Pinned** bar — tap to jump; tap **Unpin** if your role allows.
5. Open a private chat, repeat scroll-up pagination and read cursor behavior (`chat_id` = peer user id).

## Phase 5 (implemented)

- **Reactions**: chips on messages; heart picker (5 kinds); WebSocket `reaction_toggle` / `reactions_updated`
- **Replies**: quote preview above composer; `reply_to_id` on WS send (global + private)
- **Edit / delete**: long-press menu for own messages; REST `PUT/DELETE /api/messages/{id}?scope=global|private` (plain text edit for Phase 5)
- **Moderation**: mod delete + pin (global); ban user from message or People drawer (1h / 24h / forever); admin **Set role** on People (long-press)
- **Permissions**: aligned with web (`RolePermissions` — public ban blocks own edit/delete in global; mod vs admin ban rules)

### Phase 5 manual test

1. Sign in as a normal user: long-press a message → **Reply** → send; confirm quote preview and reply snippet on the new message.
2. Long-press your text message → **Edit** → change text → **Save**; confirm “edited” label and updated body.
3. **Delete** your message; confirm it disappears (WS `message_deleted`).
4. Tap reaction chips / heart picker; confirm counts update live (`reactions_updated`).
5. As **moderator/admin** in global: long-press another user’s message → **Pin**, **Delete (mod)**, **Ban** (if allowed).
6. Open **People** → long-press user → **Ban** or **Set role** (admin only for role).
7. While **public-banned**, confirm global composer disabled and own edit/delete hidden in global thread.

## Phase 6 (implemented)

- **Forgot password**: `POST /auth/forgot-password`, dedicated screen, link from login; generic success message
- **Login polish**: `TEMPORARY_PASSWORD_EXPIRED` and permanent-ban messages; temp-password login → change-password flow
- **In-chat search**: global/private `GET …/search?q=`; top-bar search with prev/next, highlight, context load
- **Voice messages**: hold mic when draft empty (`.m4a`, `tag=Voice message` on URL); inline waveform player with play/seek
- **UX**: snackbars for disconnect/upload/search errors; composer disabled when WS not connected
- **Debug**: drawer footer **API: {url}** dialog (debug builds only) — DataStore override + dynamic Retrofit base URL

### Phase 6 manual test

1. Login → **Forgot password?** → submit email → success on login screen.
2. Expired temp password login shows recovery hint; valid temp password routes to **Change password**.
3. Global/private: **Search** icon → query → prev/next jumps; Escape closes; banned user cannot search global.
4. Empty composer: hold **mic** → release after ~0.5s → voice message with **VOICE MESSAGE** label and **waveform** play/seek UI.
5. Audio message: tap play → waveform progress; tap another message → first pauses; tap waveform to seek; if decode fails, fallback bar + hint still plays.
6. Disconnect backend → send shows **Not connected** snackbar; composer stays disabled until reconnected.
7. Debug build: drawer **API:** row → set LAN URL → reconnect.

## Audio waveform (implemented)

- **48-bar** waveform from the real audio file (RMS peaks, cached per URL); play/pause, seek by tap, keyboard ±5s when focused.
- **Single active player** per thread; fallback progress bar if analysis fails (`docs/voice-messaging-requirements.md` W-1..W-8, P-1..P-2).

## Later phases (not implemented)

Push notifications (FCM).
