import { useState, useRef, useEffect, type DragEvent } from "react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { Send, ImagePlus, X, Smile } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { assetUrl } from "../lib/config";
import { isRichTextEmpty } from "../lib/richText";
import type { ChatLine, ContentType } from "../types/chat";
import { messagePlainPreview } from "../lib/richText";
import { RichTextEditor, type RichTextEditorHandle } from "./RichTextEditor";

type Props = {
  onSendText: (text: string, type: ContentType, replyToId?: number | null) => void;
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
  const richRef = useRef<RichTextEditorHandle>(null);
  const [draftHtml, setDraftHtml] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const emojiAnchorRef = useRef<HTMLDivElement>(null);

  const isEditing = Boolean(editingLine);
  const initialHtml =
    editingLine?.contentType === "text" ? editingLine.body : "";

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

  const uploadAndSend = async (file: File) => {
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    const isGif = ext === "gif";
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post<{ url: string }>("/upload", fd);
      const full = assetUrl(data.url);
      onSendText(full, isGif ? "gif" : "image", replyTo?.id != null ? Number(replyTo.id) : undefined);
      setPreview(null);
      setPreviewFile(null);
    } catch {
      toast.error("Upload failed");
    }
  };

  const onPickFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setPreviewFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onPickFile(f);
  };

  const submit = async () => {
    const html = richRef.current?.getHtml() ?? "";
    if (isRichTextEmpty(html)) return;
    if (isEditing && editingLine && onSubmitEdit) {
      await onSubmitEdit(editingLine.id, html);
      onCancelEdit?.();
      return;
    }
    onSendText(html, "text", replyTo?.id != null ? Number(replyTo.id) : undefined);
    richRef.current?.clear();
    onClearReply?.();
  };

  const canSend = !isRichTextEmpty(draftHtml);

  return (
    <div className="shrink-0 space-y-2 border-t border-slate-800 pt-3">
      {replyTo && !isEditing && (
        <div className="flex items-start gap-2 rounded border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
          <div className="min-w-0 flex-1">
            <span className="font-medium text-violet-300">Replying to {replyTo.author}</span>
            <p className="line-clamp-2 text-slate-500">
              {replyTo.contentType === "text"
                ? messagePlainPreview(replyTo.body, 500)
                : "[image]"}
            </p>
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
          <span>Editing message</span>
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
      {preview && (
        <div className="flex items-start gap-2 rounded border border-slate-700 bg-slate-900/80 p-2">
          <img src={preview} alt="" className="h-20 w-20 rounded object-cover" />
          <div className="flex flex-1 flex-col gap-2">
            <button
              type="button"
              className="self-start text-xs text-slate-400 hover:text-white"
              onClick={() => {
                setPreview(null);
                setPreviewFile(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={disabled || !previewFile}
              className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              onClick={() => previewFile && uploadAndSend(previewFile)}
            >
              Send image
            </button>
          </div>
        </div>
      )}
      <div
        className="flex gap-2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          disabled={disabled || isEditing}
          className="h-[40px] shrink-0 self-end rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          title="Upload image"
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
          disabled={disabled || Boolean(preview)}
          placeholder={isEditing ? "Edit message…" : "Type a message…"}
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
          className="flex h-[40px] shrink-0 items-center gap-1 self-end rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          onClick={() => void submit()}
        >
          <Send className="h-4 w-4" />
          {isEditing ? "Save" : "Send"}
        </button>
      </div>
      <p className="text-xs text-slate-600">
        Drag & drop an image to attach · Shift+Enter for a new line · Right-click
        selected text to format
      </p>
    </div>
  );
}
