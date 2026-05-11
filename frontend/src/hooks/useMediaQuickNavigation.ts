import { useCallback, useMemo } from "react";

type Options = {
  length: number;
  index: number;
  onChange: (nextIndex: number) => void;
};

type ReturnShape = {
  prev: () => void;
  next: () => void;
  goTo: (nextIndex: number) => void;
  indicator: string;
  onKeyDown: (event: KeyboardEvent) => void;
};

function clampWrap(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export function useMediaQuickNavigation({
  length,
  index,
  onChange,
}: Options): ReturnShape {
  const goTo = useCallback(
    (nextIndex: number) => {
      if (length <= 0) return;
      onChange(clampWrap(nextIndex, length));
    },
    [length, onChange]
  );

  const prev = useCallback(() => {
    goTo(index - 1);
  }, [goTo, index]);

  const next = useCallback(() => {
    goTo(index + 1);
  }, [goTo, index]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        prev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      }
    },
    [next, prev]
  );

  const indicator = useMemo(() => {
    if (length <= 0) return "0 of 0";
    return `${clampWrap(index, length) + 1} of ${length}`;
  }, [index, length]);

  return { prev, next, goTo, indicator, onKeyDown };
}
