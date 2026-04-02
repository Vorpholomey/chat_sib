import { useState, useRef, type DragEvent } from "react";
import { Send, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { assetUrl } from "../lib/config";
import type { ChatLine, ContentType } from "../types/chat";

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
  const [text, setText] = useState(() =>
    editingLine?.contentType === "text" ? editingLine.body : ""
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isEditing = Boolean(editingLine);

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
    const t = text.trim();
    if (!t) return;
    if (isEditing && editingLine && onSubmitEdit) {
      await onSubmitEdit(editingLine.id, t);
      setText("");
      onCancelEdit?.();
      return;
    }
    onSendText(t, "text", replyTo?.id != null ? Number(replyTo.id) : undefined);
    setText("");
    onClearReply?.();
  };

  return (
    <div className="shrink-0 space-y-2 border-t border-slate-800 pt-3">
      {replyTo && !isEditing && (
        <div className="flex items-start gap-2 rounded border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
          <div className="min-w-0 flex-1">
            <span className="font-medium text-violet-300">Replying to {replyTo.author}</span>
            <p className="line-clamp-2 text-slate-500">{replyTo.body}</p>
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
              setText("");
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
          className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          title="Upload image"
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="h-5 w-5" />
        </button>
        <input
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          placeholder={isEditing ? "Edit message…" : "Type a message…"}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <button
          type="button"
          disabled={disabled || !text.trim()}
          className="flex items-center gap-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          onClick={() => void submit()}
        >
          <Send className="h-4 w-4" />
          {isEditing ? "Save" : "Send"}
        </button>
      </div>
      <p className="text-xs text-slate-600">Drag & drop an image to attach</p>
    </div>
  );
}
