/**
 * @jest-environment jsdom
 */

// Lit + jsdom render test for MeshtasticChatCard. This is intentionally a
// minimal smoke test: we mount the card with a stubbed `hass`, fire a fake
// `meshtastic_message_log` event through our stub `subscribeEvents`, and
// assert that a row appears in the rendered output.

import { beforeAll, describe, expect, it, jest } from '@jest/globals';

import type { HomeAssistant } from '../ha-types.js';
import type { MeshtasticMessageLogEvent } from '../types.js';

type SubscribeEventsFn = (cb: (event: MeshtasticMessageLogEvent) => void, eventType: string) => Promise<() => void>;

interface FakeConnection {
  subscribeEvents: jest.Mock<SubscribeEventsFn>;
  emit: (event: MeshtasticMessageLogEvent) => void;
}

const makeConnection = (): FakeConnection => {
  let listener: ((event: MeshtasticMessageLogEvent) => void) | undefined;
  const subscribeEvents = jest.fn<SubscribeEventsFn>().mockImplementation((cb) => {
    listener = cb;
    return Promise.resolve(() => undefined);
  });
  return {
    subscribeEvents,
    emit: (event) => {
      listener?.(event);
    },
  };
};

const makeHass = (conn: FakeConnection): HomeAssistant => ({
  states: {
    'meshtastic.ch': {
      entity_id: 'meshtastic.ch',
      state: 'idle',
      attributes: { device_class: 'channel', friendly_name: 'My Channel' },
      last_changed: '',
      last_updated: '',
      context: { id: '', user_id: null, parent_id: null },
    },
  },
  callWS: jest.fn(() => Promise.resolve([])) as unknown as HomeAssistant['callWS'],
  callService: jest.fn() as unknown as HomeAssistant['callService'],
  connection: conn as unknown as HomeAssistant['connection'],
});

const flush = async (): Promise<void> => {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
};

describe('MeshtasticChatCard render', () => {
  beforeAll(async () => {
    // Importing the module registers the custom element with the global
    // customElements registry. We do this once for the whole file.
    await import('../index.js');
  });

  it('registers the meshtastic-chat-card custom element', () => {
    expect(customElements.get('meshtastic-chat-card')).toBeDefined();
  });

  it('renders the channel friendly_name as the header title', async () => {
    const conn = makeConnection();
    const hass = makeHass(conn);

    const el = document.createElement('meshtastic-chat-card') as HTMLElement & {
      hass: HomeAssistant;
      setConfig: (cfg: Record<string, unknown>) => void;
      updateComplete: Promise<boolean>;
    };
    el.setConfig({ channel_entity: 'meshtastic.ch' });
    el.hass = hass;
    document.body.appendChild(el);

    await el.updateComplete;
    await flush();
    await el.updateComplete;

    const title = el.shadowRoot?.querySelector('.title');
    expect(title?.textContent).toContain('My Channel');

    document.body.removeChild(el);
  });

  it('renders a row when a live meshtastic_message_log event arrives', async () => {
    const conn = makeConnection();
    const hass = makeHass(conn);

    const el = document.createElement('meshtastic-chat-card') as HTMLElement & {
      hass: HomeAssistant;
      setConfig: (cfg: Record<string, unknown>) => void;
      updateComplete: Promise<boolean>;
    };
    el.setConfig({ channel_entity: 'meshtastic.ch' });
    el.hass = hass;
    document.body.appendChild(el);

    // Wait for the initial subscribe + history call to settle.
    await el.updateComplete;
    await flush();
    await el.updateComplete;
    await flush();

    expect(conn.subscribeEvents).toHaveBeenCalled();

    conn.emit({
      event_type: 'meshtastic_message_log',
      data: {
        entity_id: 'meshtastic.ch',
        from_name: 'Alice',
        message: 'hello mesh',
        pki: false,
      },
      time_fired: '2023-05-01T12:00:00.000Z',
      context: { id: 'ctx-1', user_id: null, parent_id: null },
    });

    await flush();
    await el.updateComplete;

    const rows = el.shadowRoot?.querySelectorAll('.row') ?? [];
    expect(rows.length).toBe(1);
    expect(rows[0]?.textContent).toContain('Alice');
    expect(rows[0]?.textContent).toContain('hello mesh');

    document.body.removeChild(el);
  });
});
