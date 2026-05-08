import { describe, expect, it } from '@jest/globals';

import { appendUnique, trimMessages } from '../messages.js';
import type { ChatMessage } from '../types.js';

const makeMsg = (id: string, message = 'hi'): ChatMessage => ({
  id,
  time: new Date(0).toISOString(),
  fromName: 'Tester',
  message,
  pki: false,
  source: 'live',
});

describe('trimMessages', () => {
  it('returns the same array reference when under the limit', () => {
    const msgs = [makeMsg('a'), makeMsg('b')];
    const trimmed = trimMessages(msgs, 10);
    expect(trimmed).toBe(msgs);
  });

  it('returns the same array reference when exactly at the limit', () => {
    const msgs = [makeMsg('a'), makeMsg('b')];
    const trimmed = trimMessages(msgs, 2);
    expect(trimmed).toBe(msgs);
  });

  it('drops oldest messages when over the limit', () => {
    const msgs = [makeMsg('a'), makeMsg('b'), makeMsg('c'), makeMsg('d')];
    const trimmed = trimMessages(msgs, 2);
    expect(trimmed).not.toBe(msgs);
    expect(trimmed.map((m) => m.id)).toEqual(['c', 'd']);
  });

  it('returns empty array when limit is 0 or negative', () => {
    expect(trimMessages([makeMsg('a')], 0)).toEqual([]);
    expect(trimMessages([makeMsg('a')], -1)).toEqual([]);
  });
});

describe('appendUnique', () => {
  it('appends a new message and reports appended=true', () => {
    const msgs = [makeMsg('a')];
    const result = appendUnique(msgs, makeMsg('b'), 10);
    expect(result.appended).toBe(true);
    expect(result.messages.map((m) => m.id)).toEqual(['a', 'b']);
    // Original array is not mutated.
    expect(msgs.map((m) => m.id)).toEqual(['a']);
  });

  it('skips duplicates by id and returns appended=false', () => {
    const msgs = [makeMsg('a'), makeMsg('b')];
    const result = appendUnique(msgs, makeMsg('a'), 10);
    expect(result.appended).toBe(false);
    expect(result.messages).toBe(msgs);
  });

  it('trims to limit when appending past capacity', () => {
    const msgs = [makeMsg('a'), makeMsg('b'), makeMsg('c')];
    const result = appendUnique(msgs, makeMsg('d'), 2);
    expect(result.appended).toBe(true);
    expect(result.messages.map((m) => m.id)).toEqual(['c', 'd']);
  });
});
