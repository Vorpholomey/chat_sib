/** Fixed palette of message reactions. */
export const REACTION_KINDS = [
  "thumbs_up",
  "thumbs_down",
  "heart",
  "fire",
  "joy",
] as const;

export type ReactionKind = (typeof REACTION_KINDS)[number];

/** Per message: each kind holds distinct user IDs who added that reaction. */
export type MessageReactionState = Record<ReactionKind, number[]>;

export type MessageReactionsByMessageId = Record<string, MessageReactionState>;

export function emptyMessageReactions(): MessageReactionState {
  return {
    thumbs_up: [],
    thumbs_down: [],
    heart: [],
    fire: [],
    joy: [],
  };
}

export function normalizeReactions(
  partial: Partial<MessageReactionState> | undefined
): MessageReactionState {
  const base = emptyMessageReactions();
  if (!partial) return base;
  for (const kind of REACTION_KINDS) {
    const u = partial[kind];
    base[kind] = u ? [...new Set(u)] : [];
  }
  return base;
}

export function hasAnyReactions(state: MessageReactionState): boolean {
  return REACTION_KINDS.some((k) => (state[k]?.length ?? 0) > 0);
}
