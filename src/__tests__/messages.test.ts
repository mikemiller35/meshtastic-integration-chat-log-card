import { describe, expect, it } from 'vitest';

import { appendUnique, reconcilePending, removeMessage, trimMessages } from '../messages.js';
import type { ChatMessage } from '../types.js';

const makeMsg = (id: string, message = 'hi'): ChatMessage => ({
  id,
  time: new Date(0).toISOString(),
  fromName: 'Tester',
  message,
  pki: false,
  own: false,
  source: 'live',
});

const makePending = (id: string, message = 'hi'): ChatMessage => ({
  ...makeMsg(id, message),
  fromName: 'You',
  own: true,
  pending: true,
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

describe('removeMessage', () => {
  it('drops the message with the given id', () => {
    const msgs = [makeMsg('a'), makeMsg('b'), makeMsg('c')];
    expect(removeMessage(msgs, 'b').map((m) => m.id)).toEqual(['a', 'c']);
    // Original array is not mutated.
    expect(msgs.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns the same array reference when the id is absent', () => {
    const msgs = [makeMsg('a')];
    expect(removeMessage(msgs, 'nope')).toBe(msgs);
  });
});

describe('reconcilePending', () => {
  it('re-keys the optimistic row to the backend id and clears pending', () => {
    const msgs = [makeMsg('a'), makePending('pending-1', 'on my way')];
    const result = reconcilePending(msgs, 'pending-1', 'ctx-1');

    expect(result.map((m) => m.id)).toEqual(['a', 'ctx-1']);
    expect(result[1].pending).toBe(false);
    // Everything else about the row survives.
    expect(result[1].message).toBe('on my way');
    expect(result[1].own).toBe(true);
    expect(result[1].fromName).toBe('You');
  });

  it('drops the optimistic row when the backend row already arrived', () => {
    // The live event beats the service call's response, which is the usual
    // ordering when sending with ack enabled.
    const msgs = [makePending('pending-1'), makeMsg('ctx-1')];
    const result = reconcilePending(msgs, 'pending-1', 'ctx-1');

    expect(result.map((m) => m.id)).toEqual(['ctx-1']);
  });

  it('returns the same array reference when the optimistic row is gone', () => {
    const msgs = [makeMsg('a')];
    expect(reconcilePending(msgs, 'pending-1', 'ctx-1')).toBe(msgs);
  });
});
