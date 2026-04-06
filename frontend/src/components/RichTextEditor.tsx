import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Bold, Italic, Link2 } from "lucide-react";
import {
  isRichTextEmpty,
  plainTextToEditableHtml,
  sanitizeMessageHtml,
} from "../lib/richText";

const CTX_MENU_MIN_W = 120;
const CTX_MENU_EST_H = 40;
const VIEW_PAD = 8;

function clampCtxPosition(clientX: number, clientY: number) {
  let left = clientX;
  let top = clientY + 4;
  if (left + CTX_MENU_MIN_W > window.innerWidth - VIEW_PAD) {
    left = window.innerWidth - CTX_MENU_MIN_W - VIEW_PAD;
  }
  if (top + CTX_MENU_EST_H > window.innerHeight - VIEW_PAD) {
    top = clientY - CTX_MENU_EST_H - 4;
  }
  if (left < VIEW_PAD) left = VIEW_PAD;
  if (top < VIEW_PAD) top = VIEW_PAD;
  return { left, top };
}

type FormatToolbarProps = {
  disabled?: boolean;
  onBold: () => void;
  onItalic: () => void;
  onLink: () => void;
};

function FormatToolbar({
  disabled,
  onBold,
  onItalic,
  onLink,
}: FormatToolbarProps) {
  return (
    <div
      className="flex gap-0.5 rounded-lg border border-slate-600 bg-slate-900 p-1 shadow-lg ring-1 ring-slate-700/80"
      role="toolbar"
      aria-label="Text formatting"
      data-rich-format-ctx-toolbar
    >
      <button
        type="button"
        disabled={disabled}
        className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
        title="Bold"
        aria-label="Bold"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onBold}
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={disabled}
        className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
        title="Italic"
        aria-label="Italic"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onItalic}
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={disabled}
        className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
        title="Link"
        aria-label="Insert link"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onLink}
      >
        <Link2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export type RichTextEditorHandle = {
  insertText: (s: string) => void;
  getHtml: () => string;
  focus: () => void;
  clear: () => void;
};

type Props = {
  disabled?: boolean;
  placeholder?: string;
  /** Set when opening edit mode or remounting; plain text or HTML from server */
  initialHtml?: string;
  className?: string;
  "aria-label"?: string;
  onHtmlChange?: (html: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
};

function applyInitial(el: HTMLDivElement, initial: string) {
  if (!initial) {
    el.innerHTML = "";
    return;
  }
  if (!initial.includes("<")) {
    el.innerHTML = plainTextToEditableHtml(initial);
  } else {
    el.innerHTML = sanitizeMessageHtml(initial);
  }
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(
  function RichTextEditor(
    {
      disabled,
      placeholder = "Type a message…",
      initialHtml = "",
      className,
      "aria-label": ariaLabel,
      onHtmlChange,
      onKeyDown,
    },
    ref
  ) {
    const divRef = useRef<HTMLDivElement>(null);
    const linkInputRef = useRef<HTMLInputElement>(null);
    const savedRangeRef = useRef<Range | null>(null);
    const [empty, setEmpty] = useState(true);
    const [linkOpen, setLinkOpen] = useState(false);
    const [linkDraft, setLinkDraft] = useState("");
    const [ctxMenu, setCtxMenu] = useState<{ left: number; top: number } | null>(
      null
    );

    const syncEmpty = useCallback(() => {
      const el = divRef.current;
      if (!el) return;
      const html = el.innerHTML;
      const nextEmpty = isRichTextEmpty(html);
      setEmpty(nextEmpty);
      onHtmlChange?.(sanitizeMessageHtml(html));
    }, [onHtmlChange]);

    useEffect(() => {
      const el = divRef.current;
      if (!el) return;
      applyInitial(el, initialHtml);
      const html = el.innerHTML;
      setEmpty(isRichTextEmpty(html));
      onHtmlChange?.(sanitizeMessageHtml(html));
      // Only re-apply when the initial document changes (e.g. opening edit mode).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialHtml]);

    useImperativeHandle(
      ref,
      () => ({
        insertText: (s: string) => {
          const el = divRef.current;
          if (!el || disabled) return;
          el.focus();
          document.execCommand("insertText", false, s);
          syncEmpty();
        },
        getHtml: () => sanitizeMessageHtml(divRef.current?.innerHTML ?? ""),
        focus: () => divRef.current?.focus(),
        clear: () => {
          const el = divRef.current;
          if (!el) return;
          el.innerHTML = "";
          setEmpty(true);
          onHtmlChange?.("");
        },
      }),
      [disabled, onHtmlChange, syncEmpty]
    );

    const captureSelectionFromEditor = useCallback(() => {
      const el = divRef.current;
      const sel = window.getSelection();
      savedRangeRef.current = null;
      if (el && sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        if (el.contains(r.commonAncestorContainer)) {
          savedRangeRef.current = r.cloneRange();
        }
      }
    }, []);

    const openLinkDialog = (opts?: { keepExistingRange?: boolean }) => {
      if (disabled) return;
      if (!opts?.keepExistingRange) {
        captureSelectionFromEditor();
      } else if (!savedRangeRef.current) {
        captureSelectionFromEditor();
      }
      setLinkDraft("");
      setLinkOpen(true);
    };

    const closeCtxMenu = useCallback(() => {
      setCtxMenu(null);
      savedRangeRef.current = null;
    }, []);

    const runCtxFormat = useCallback(
      (cmd: "bold" | "italic") => {
        if (disabled) return;
        const el = divRef.current;
        if (!el) return;
        el.focus();
        const sel = window.getSelection();
        if (savedRangeRef.current && sel) {
          sel.removeAllRanges();
          try {
            sel.addRange(savedRangeRef.current);
          } catch {
            /* range invalid */
          }
        }
        document.execCommand(cmd, false);
        syncEmpty();
        closeCtxMenu();
      },
      [closeCtxMenu, disabled, syncEmpty]
    );

    useEffect(() => {
      if (!linkOpen) return;
      const id = window.setTimeout(() => linkInputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }, [linkOpen]);

    useEffect(() => {
      if (!linkOpen) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setLinkOpen(false);
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [linkOpen]);

    useEffect(() => {
      if (ctxMenu === null) return;
      const onDocDown = (e: MouseEvent) => {
        const el = e.target as HTMLElement | null;
        if (el?.closest("[data-rich-format-ctx]")) return;
        closeCtxMenu();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          closeCtxMenu();
        }
      };
      document.addEventListener("mousedown", onDocDown);
      window.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("mousedown", onDocDown);
        window.removeEventListener("keydown", onKey);
      };
    }, [ctxMenu, closeCtxMenu]);

    const confirmLink = () => {
      const raw = linkDraft.trim();
      setLinkOpen(false);
      if (!raw) return;
      let u = raw;
      if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
      let href: string;
      try {
        const parsed = new URL(u);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
        href = parsed.href;
      } catch {
        return;
      }
      const el = divRef.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (savedRangeRef.current && sel) {
        sel.removeAllRanges();
        try {
          sel.addRange(savedRangeRef.current);
        } catch {
          /* selection no longer valid */
        }
      }
      document.execCommand("createLink", false, href);
      syncEmpty();
    };

    return (
      <div className={className}>
        <div className="relative min-w-0 flex-1">
          {empty && (
            <div className="pointer-events-none absolute left-3 top-2 z-0 text-sm text-slate-500">
              {placeholder}
            </div>
          )}
          <div
            ref={divRef}
            contentEditable={!disabled}
            role="textbox"
            aria-multiline="true"
            aria-label={ariaLabel}
            className={`relative z-10 min-h-[40px] max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-violet-500 focus:outline-none [&_a]:text-violet-400 [&_a]:underline`}
            suppressContentEditableWarning
            onInput={syncEmpty}
            onKeyDown={onKeyDown}
            onContextMenu={(e) => {
              if (disabled) return;
              const el = divRef.current;
              if (!el) return;
              const sel = window.getSelection();
              if (!sel || sel.rangeCount === 0) return;
              const r = sel.getRangeAt(0);
              if (r.collapsed) return;
              if (!el.contains(r.commonAncestorContainer)) return;
              e.preventDefault();
              savedRangeRef.current = r.cloneRange();
              const { left, top } = clampCtxPosition(e.clientX, e.clientY);
              setCtxMenu({ left, top });
            }}
          />
        </div>

        {ctxMenu &&
          createPortal(
            <div
              data-rich-format-ctx
              className="fixed z-[101]"
              style={{ left: ctxMenu.left, top: ctxMenu.top }}
              role="presentation"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <FormatToolbar
                disabled={disabled}
                onBold={() => runCtxFormat("bold")}
                onItalic={() => runCtxFormat("italic")}
                onLink={() => {
                  setCtxMenu(null);
                  openLinkDialog({ keepExistingRange: true });
                }}
              />
            </div>,
            document.body
          )}

        {linkOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setLinkOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-labelledby="rich-text-link-title"
                aria-modal="true"
                className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <h3
                  id="rich-text-link-title"
                  className="text-lg font-semibold text-white"
                >
                  Add link
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Paste or type a URL.{" "}
                  <span className="text-slate-500">https://</span> is added if
                  missing.
                </p>
                <label className="mt-3 block text-xs font-medium text-slate-400">
                  URL
                  <input
                    ref={linkInputRef}
                    type="url"
                    autoComplete="url"
                    placeholder="https://example.com"
                    value={linkDraft}
                    onChange={(e) => setLinkDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        confirmLink();
                      }
                    }}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-500 focus:outline-none"
                  />
                </label>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                    onClick={() => setLinkOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500"
                    onClick={() => confirmLink()}
                  >
                    Insert link
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    );
  }
);
