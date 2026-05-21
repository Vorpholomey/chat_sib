export type AudioWaveformData = {
  peaks: number[];
  durationSeconds: number;
};

const waveformCache = new Map<string, Promise<AudioWaveformData | null>>();

export function getCachedAudioWaveform(
  url: string,
  sampleCount = 48
): Promise<AudioWaveformData | null> {
  if (!url) return Promise.resolve(null);
  const cacheKey = `${url}::${sampleCount}`;
  const cached = waveformCache.get(cacheKey);
  if (cached) return cached;
  const pending = computeWaveform(url, sampleCount).catch(() => null);
  waveformCache.set(cacheKey, pending);
  return pending;
}

async function computeWaveform(
  url: string,
  sampleCount: number
): Promise<AudioWaveformData | null> {
  if (typeof window === "undefined") return null;
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) return null;
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new window.AudioContext();
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const peaks = extractPeaks(audioBuffer, sampleCount);
    return {
      peaks,
      durationSeconds: Number.isFinite(audioBuffer.duration)
        ? audioBuffer.duration
        : 0,
    };
  } finally {
    void audioContext.close();
  }
}

function extractPeaks(buffer: AudioBuffer, sampleCount: number): number[] {
  const channels = buffer.numberOfChannels;
  if (!channels || sampleCount <= 0) return [];
  const length = buffer.length;
  if (!length) return [];
  const blockSize = Math.max(1, Math.floor(length / sampleCount));
  const peaks = new Array<number>(sampleCount).fill(0);
  let maxPeak = 0;

  for (let i = 0; i < sampleCount; i += 1) {
    const start = i * blockSize;
    const end = Math.min(length, start + blockSize);
    let sumSquares = 0;
    let total = 0;
    for (let c = 0; c < channels; c += 1) {
      const channelData = buffer.getChannelData(c);
      for (let idx = start; idx < end; idx += 1) {
        const sample = channelData[idx] ?? 0;
        sumSquares += sample * sample;
        total += 1;
      }
    }
    const rms = total > 0 ? Math.sqrt(sumSquares / total) : 0;
    peaks[i] = rms;
    if (rms > maxPeak) maxPeak = rms;
  }

  if (maxPeak <= 0) return peaks.map(() => 0.12);
  return peaks.map((value) => {
    const normalized = value / maxPeak;
    // Keep silent blocks visible so the waveform does not collapse.
    return Math.max(0.1, Math.min(1, normalized));
  });
}
