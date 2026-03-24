import { useState, useRef, type DragEvent } from "react";
import { Send, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { assetUrl } from "../lib/config";
import type { ContentType } from "../types/chat";

type Props = {
  onSendText: (text: string, type: ContentType) => void;
  disabled?: boolean;
};

export function MessageInput({ onSendText, disabled }: Props) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadAndSend = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isGif = ext === "gif";
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post<{ url: string }>("/upload", fd);
      const full = assetUrl(data.url);
      onSendText(full, isGif ? "gif" : "image");
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

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSendText(t, "text");
    setText("");
  };

  return (
    <div className="shrink-0 space-y-2 border-t border-slate-800 pt-3">
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
          disabled={disabled}
          className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          title="Upload image"
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="h-5 w-5" />
        </button>
        <input
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          placeholder="Type a message…"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          disabled={disabled || !text.trim()}
          className="flex items-center gap-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          onClick={submit}
        >
          <Send className="h-4 w-4" />
          Send
        </button>
      </div>
      <p className="text-xs text-slate-600">Drag & drop an image to attach</p>
    </div>
  );
}
