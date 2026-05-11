export type AudioMeta = {
  fileName?: string;
  title?: string;
  artist?: string;
  coverUrl?: string;
  tag?: string;
};

export const VOICE_MESSAGE_TAG = "Voice message";

export function parseAudioMetaFromUrl(raw: string): AudioMeta {
  if (!raw) return {};
  try {
    const parsed = new URL(raw, window.location.origin);
    const fileName =
      parsed.searchParams.get("name")?.trim() ||
      decodePathTail(parsed.pathname);
    const title = parsed.searchParams.get("title")?.trim() || undefined;
    const artist = parsed.searchParams.get("artist")?.trim() || undefined;
    const coverRaw = parsed.searchParams.get("cover")?.trim();
    const coverUrl = coverRaw ? new URL(coverRaw, window.location.origin).href : undefined;
    const tag = parsed.searchParams.get("tag")?.trim() || undefined;
    return { fileName: fileName || undefined, title, artist, coverUrl, tag };
  } catch {
    const base = decodePathTail(raw.split("?")[0] ?? raw);
    return { fileName: base || undefined };
  }
}

export function appendAudioMetaToUrl(
  rawUrl: string,
  meta: { tag?: string }
): string {
  if (!rawUrl) return rawUrl;
  const tag = meta.tag?.trim();
  if (!tag) return rawUrl;
  try {
    const parsed = new URL(rawUrl, window.location.origin);
    parsed.searchParams.set("tag", tag);
    return parsed.href;
  } catch {
    return rawUrl;
  }
}

function decodePathTail(pathname: string): string {
  const base = pathname.split("/").pop();
  if (!base) return "";
  try {
    return decodeURIComponent(base);
  } catch {
    return base;
  }
}
