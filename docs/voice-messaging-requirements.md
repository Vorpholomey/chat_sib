# Voice messaging and audio display — requirements

This document captures functional and UX requirements implemented or specified during the chat workstream for voice messages and in-thread audio playback.

---

## 1. Composer: voice recording (push-to-talk)

| ID | Requirement |
|----|-------------|
| C-1 | When the message draft is **empty**, the primary action shows a **microphone** control; the **Send** control is **not** shown. |
| C-2 | When the user **enters non-empty text**, the microphone is **hidden** and **Send** is shown (existing text-send behavior preserved). |
| C-3 | **Recording starts** when the user **presses** the microphone (pointer down). |
| C-4 | **Recording stops** when the user **releases** the microphone (pointer up). |
| C-5 | **Cancel** recording on pointer cancel / pointer leave (or equivalent) so accidental drags do **not** send audio. |
| C-6 | Use **pointer capture** (or equivalent) so mouse and touch behave reliably. |
| C-7 | If the browser does not support recording APIs or permission is denied, show a clear **error** and do not crash the composer. |
| C-8 | Recorded audio is sent through the **existing upload + message** pipeline (no new backend contract required for basic flow). |

---

## 2. In-thread audio: waveform visualization

| ID | Requirement |
|----|-------------|
| W-1 | Messages with **audio** content display a **waveform** derived from the **actual audio file** (not a generic placeholder pattern). |
| W-2 | Provide **play** and **pause** for the inline audio player. |
| W-3 | Playback **progress** is reflected in the waveform (e.g. played vs unplayed segments). |
| W-4 | Users can **seek** by interacting with the waveform area (e.g. click-to-seek). |
| W-5 | **Keyboard** support for coarse seek while the waveform control is focused (e.g. step backward/forward). |
| W-6 | **Waveform analysis** is **cached per audio URL** (and analysis parameters) to avoid repeated decode work on re-renders and scroll. |
| W-7 | If waveform analysis **fails** (decode, network, CORS, unsupported codec, etc.), audio must **still play** with a **fallback** UI (e.g. progress bar) and an explanatory hint. |
| W-8 | Waveform **bar geometry** must stay **within the message bubble**: sufficiently **small** bar width/height, constrained track height, **overflow hidden**, and a **moderate** number of bars so the control does not clip or spill past layout bounds. |

---

## 3. Time display layout

| ID | Requirement |
|----|-------------|
| T-1 | The **current time / duration** label (e.g. `0:00 / 2:35`) is shown **below** the row that contains play and waveform controls, not inline at the end of that row (when waveform mode is active). |

---

## 4. Single active playback

| ID | Requirement |
|----|-------------|
| P-1 | At most **one** inline waveform/audio message may be **playing** at a time in the chat view. |
| P-2 | Starting playback on a **second** message **pauses** the first without requiring manual stop. |

---

## 5. Voice message identification and labeling

| ID | Requirement |
|----|-------------|
| V-1 | Audio sent from the **microphone hold-to-record** path must be distinguishable as a **voice message** in the UI (implementation may use URL metadata such as a `tag` query parameter, without changing core API schemas). |
| V-2 | **Manually uploaded** audio files must **not** automatically receive the voice-message label. |
| V-3 | For voice messages, the **primary title line** must show the **voice message** badge (e.g. uppercase pill **VOICE MESSAGE**) **instead of** the raw filename (e.g. `recording-….webm`). |
| V-4 | Non-voice audio keeps **normal** title/filename behavior; optional tags may still display when applicable. |

---

## 6. Non-functional expectations

| ID | Requirement |
|----|-------------|
| N-1 | **Accessibility:** controls expose appropriate **labels** and **states** (e.g. play/pause, progress slider role where used). |
| N-2 | **Performance:** avoid decoding full audio on every list render; cap bar count or analysis cost appropriately for long clips if needed. |
| N-3 | **Compatibility:** graceful degradation when `AudioContext` / `MediaRecorder` / `getUserMedia` are unavailable. |

---

## 7. Out of scope (explicit)

- Backend-persisted “tags” table or new WebSocket fields (optional future work).
- Server-generated waveform peaks (optional future optimization).
- Simultaneous playback of multiple inline audio messages.

---

*Generated from the product discussion in chat; align implementation with this list for regression checks and onboarding.*
