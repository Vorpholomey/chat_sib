export type AudioMeta = {
  fileName?: string;
  title?: string;
  artist?: string;
  coverUrl?: string;
};

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
    return { fileName: fileName || undefined, title, artist, coverUrl };
  } catch {
    const base = decodePathTail(raw.split("?")[0] ?? raw);
    return { fileName: base || undefined };
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
