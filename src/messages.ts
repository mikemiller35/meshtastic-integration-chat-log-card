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
