import { useState, useRef, useEffect, type DragEvent } from "react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { Send, ImagePlus, X, Smile } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { assetUrl } from "../lib/config";
import { isRichTextEmpty } from "../lib/richText";
import type { ChatLine, ContentType } from "../types/chat";
import { RichTextEditor, type RichTextEditorHandle } from "./RichTextEditor";
import { ReplyQuotePreview } from "./ReplyQuotePreview";

type Props = {
  onSendText: (
    text: string,
    type: ContentType,
    replyToId?: number | null,
    caption?: string | null
  ) => void;
  disabled?: boolean;
  /** When set, sending includes reply_to_id */
  replyTo?: ChatLine | null;
  onClearReply?: () => void;
  /** Inline edit: prefill and submit updates instead of send */
  editingLine?: ChatLine | null;
  onCancelEdit?: () => void;
  onSubmitEdit?: (messageId: string | number, text: string) => void | Promise<void>;
};

export function MessageInput({
  onSendText,
  disabled,
  replyTo,
  onClearReply,
  editingLine,
  onCancelEdit,
  onSubmitEdit,
}: Props) {
  type MediaKind = Extract<ContentType, "image" | "gif" | "video" | "audio">;

  const richRef = useRef<RichTextEditorHandle>(null);
  const [draftHtml, setDraftHtml] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewKind, setPreviewKind] = useState<MediaKind | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const emojiAnchorRef = useRef<HTMLDivElement>(null);

  const isEditing = Boolean(editingLine);
  const initialHtml = (() => {
    if (!editingLine) return "";
    if (editingLine.contentType === "text") return editingLine.body;
    return editingLine.caption ?? "";
  })();
  const editingMedia =
    isEditing &&
    editingLine &&
    (editingLine.contentType === "image" ||
      editingLine.contentType === "gif" ||
      editingLine.contentType === "video" ||
      editingLine.contentType === "audio");

  useEffect(() => {
    if (!emojiPickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (emojiAnchorRef.current?.contains(e.target as Node)) return;
      setEmojiPickerOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [emojiPickerOpen]);

  const insertEmojiAtCaret = (emoji: string) => {
    richRef.current?.insertText(emoji);
  };

  const resolveMediaKind = (file: File): MediaKind | null => {
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (ext === "gif") return "gif";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    if (file.type.startsWith("image/")) return "image";
    // Fallback for cases where browser mime types are missing/odd.
    if (["mp4", "webm"].includes(ext)) return "video";
    if (["mp3", "wav"].includes(ext)) return "audio";
    if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image";
    return null;
  };

  const uploadAndSend = async (file: File) => {
    const kind = resolveMediaKind(file);
    if (!kind) {
      toast.error("Please choose a supported media file");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post<{ url: string }>("/upload", fd);
      const full = assetUrl(data.url);
      const captionHtml = richRef.current?.getHtml() ?? "";
      const cap = !isRichTextEmpty(captionHtml) ? captionHtml : undefined;
      onSendText(
        full,
        kind,
        replyTo?.id != null ? Number(replyTo.id) : undefined,
        cap
      );
      richRef.current?.clear();
      setPreview(null);
      setPreviewFile(null);
      setPreviewKind(null);
      setDraftHtml("");
      onClearReply?.();
    } catch {
      toast.error("Upload failed");
    }
  };

  const onPickFile = (f: File | null) => {
    if (!f) return;
    const kind = resolveMediaKind(f);
    if (!kind) {
      toast.error("Please choose an image, video, gif, or audio file");
      return;
    }
    setPreviewFile(f);
    setPreviewKind(kind);
    setPreview(URL.createObjectURL(f));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onPickFile(f);
  };

  const submit = async () => {
    if (preview && previewFile && previewKind) {
      await uploadAndSend(previewFile);
      return;
    }
    const html = richRef.current?.getHtml() ?? "";
    if (isEditing && editingLine && onSubmitEdit) {
      if (editingLine.contentType === "text" && isRichTextEmpty(html)) return;
      await onSubmitEdit(editingLine.id, html);
      onCancelEdit?.();
      return;
    }
    if (isRichTextEmpty(html)) return;
    onSendText(html, "text", replyTo?.id != null ? Number(replyTo.id) : undefined);
    richRef.current?.clear();
    onClearReply?.();
  };

  const canSend =
    isEditing && editingLine && editingLine.contentType !== "text"
      ? true
      : !isRichTextEmpty(draftHtml);

  return (
    <div className="shrink-0 space-y-2 border-t border-slate-800 pt-3">
      {replyTo && !isEditing && (
        <div className="flex items-start gap-2 rounded border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
          <div className="min-w-0 flex-1">
            <span className="font-medium text-violet-300">Replying to {replyTo.author}</span>
            <div className="text-slate-500">
              <ReplyQuotePreview
                contentType={replyTo.contentType}
                text={replyTo.body}
              />
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Cancel reply"
            onClick={() => onClearReply?.()}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {isEditing && editingLine && (
        <div className="flex items-center justify-between gap-2 rounded border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
          <span>
            {editingMedia ? "Editing media (caption)" : "Editing message"}
          </span>
          <button
            type="button"
            className="rounded px-2 py-1 hover:bg-amber-900/50"
            onClick={() => {
              onCancelEdit?.();
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {editingMedia && editingLine && (
        <div className="flex items-start gap-3 rounded border border-slate-700 bg-slate-900/80 p-2">
          {editingLine.contentType === "image" || editingLine.contentType === "gif" ? (
            <img
              src={assetUrl(editingLine.body)}
              alt=""
              className="h-20 w-20 shrink-0 rounded border border-slate-700 object-cover"
            />
          ) : editingLine.contentType === "video" ? (
            <video
              src={assetUrl(editingLine.body)}
              muted
              preload="metadata"
              className="h-20 w-20 shrink-0 rounded border border-slate-700 object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-800/60 text-xs text-slate-300">
              Audio
            </div>
          )}
          <p className="pt-0.5 text-xs leading-snug text-slate-500">
            You can change the caption below. To replace the media, delete this message and send a
            new one.
          </p>
        </div>
      )}
      {preview && (
        <div className="flex items-start gap-2 rounded border border-slate-700 bg-slate-900/80 p-2">
          {previewKind === "image" || previewKind === "gif" ? (
            <img src={preview} alt="" className="h-20 w-20 shrink-0 rounded object-cover" />
          ) : previewKind === "video" ? (
            <video
              src={preview}
              muted
              preload="metadata"
              className="h-20 w-20 shrink-0 rounded border border-slate-700 object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-800/60 text-xs text-slate-300">
              Audio
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <button
              type="button"
              className="self-start text-xs text-slate-400 hover:text-white"
              onClick={() => {
                setPreview(null);
                setPreviewFile(null);
                setPreviewKind(null);
              }}
            >
              Remove media
            </button>
            <p className="text-xs text-slate-500">
              Type an optional caption in the box below, then send.
            </p>
            <button
              type="button"
              disabled={disabled || !previewFile}
              className="self-start rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              onClick={() => previewFile && uploadAndSend(previewFile)}
            >
              Send media
            </button>
          </div>
        </div>
      )}
      <div
        className="flex gap-2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={isEditing ? (e) => e.preventDefault() : onDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,audio/*"
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          disabled={disabled || isEditing}
          className="h-[40px] shrink-0 self-end rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          title="Upload media"
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="h-5 w-5" />
        </button>
        <div className="relative shrink-0 self-end" ref={emojiAnchorRef}>
          <button
            type="button"
            disabled={disabled}
            className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            title="Emoji"
            aria-expanded={emojiPickerOpen}
            aria-haspopup="dialog"
            aria-label="Open emoji picker"
            onClick={() => setEmojiPickerOpen((o) => !o)}
          >
            <Smile className="h-5 w-5" />
          </button>
          {emojiPickerOpen && (
            <div
              className="absolute bottom-full left-0 z-50 mb-2 overflow-hidden rounded-lg shadow-xl ring-1 ring-slate-700"
              role="dialog"
              aria-label="Emoji picker"
            >
              <Picker
                data={data}
                theme="dark"
                onEmojiSelect={(emoji: { native: string }) => {
                  insertEmojiAtCaret(emoji.native);
                }}
              />
            </div>
          )}
        </div>
        <RichTextEditor
          ref={richRef}
          disabled={disabled}
          placeholder={
            editingMedia
              ? "Edit caption…"
              : isEditing
                ? "Edit message…"
                : preview
                  ? "Add a caption (optional)…"
                  : "Type a message…"
          }
          initialHtml={initialHtml}
          className="min-w-0 flex-1"
          aria-label={isEditing ? "Edit message" : "Message text"}
          onHtmlChange={setDraftHtml}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <button
          type="button"
          disabled={disabled || Boolean(preview) || !canSend}
          title={preview ? "Send text message (clear image preview to use)" : undefined}
          className="flex h-[40px] shrink-0 items-center gap-1 self-end rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          onClick={() => void submit()}
        >
          <Send className="h-4 w-4" />
          {isEditing ? "Save" : "Send"}
        </button>
      </div>
      <p className="hidden text-xs text-slate-600 sm:block">
        Drag & drop a media file to attach (optional caption) · Shift+Enter for a new line ·
        Right-click selected text to format
      </p>
    </div>
  );
}
