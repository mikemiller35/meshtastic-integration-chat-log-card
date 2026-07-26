import type { ChatMessage } from './types';

// Trim the oldest messages so that the buffer never exceeds `limit`.
// Returns the same array reference when no work is needed so callers can use
// strict equality checks to detect changes.
export const trimMessages = (msgs: ChatMessage[], limit: number): ChatMessage[] => {
  if (limit <= 0) return [];
  if (msgs.length <= limit) return msgs;
  return msgs.slice(msgs.length - limit);
};

export interface AppendUniqueResult {
  messages: ChatMessage[];
  appended: boolean;
}

// Append `next` to `msgs` if it isn't already present (by id), then trim to
// `limit`. Returns the resulting array and whether `next` was added.
export const appendUnique = (msgs: ChatMessage[], next: ChatMessage, limit: number): AppendUniqueResult => {
  if (msgs.some((m) => m.id === next.id)) {
    return { messages: msgs, appended: false };
  }
  return { messages: trimMessages([...msgs, next], limit), appended: true };
};

// Drop the message with `id`, if present. Returns the same array reference when
// there is nothing to remove.
export const removeMessage = (msgs: ChatMessage[], id: string): ChatMessage[] => {
  const idx = msgs.findIndex((m) => m.id === id);
  if (idx === -1) return msgs;
  return [...msgs.slice(0, idx), ...msgs.slice(idx + 1)];
};

// Re-key an optimistic row to the id the backend gave it, so that the same
// message arriving over the live event stream — or from the logbook after a
// reload — de-dupes against it by id.
//
// If the authoritative row already arrived, drop the optimistic one instead:
// the backend's version is the better of the two.
export const reconcilePending = (msgs: ChatMessage[], pendingId: string, nextId: string): ChatMessage[] => {
  const idx = msgs.findIndex((m) => m.id === pendingId);
  if (idx === -1) return msgs;
  if (msgs.some((m) => m.id === nextId)) return removeMessage(msgs, pendingId);

  const next = [...msgs];
  next[idx] = { ...next[idx], id: nextId, pending: false };
  return next;
};
