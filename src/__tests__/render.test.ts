// Lit + jsdom render test for MeshtasticChatCard. This is intentionally a
// minimal smoke test: we mount the card with a stubbed `hass`, fire a fake
// `meshtastic_message_log` event through our stub `subscribeEvents`, and
// assert that a row appears in the rendered output.

import { beforeAll, describe, expect, it, vi, type Mock } from 'vitest';

import type { HomeAssistant, ServiceCallResult } from '../ha-types.js';
import type { MeshtasticMessageLogEvent } from '../types.js';

type CardElement = HTMLElement & {
  hass: HomeAssistant;
  setConfig: (cfg: Record<string, unknown>) => void;
  updateComplete: Promise<boolean>;
};

type SubscribeEventsFn = (cb: (event: MeshtasticMessageLogEvent) => void, eventType: string) => Promise<() => void>;

interface FakeConnection {
  subscribeEvents: Mock<SubscribeEventsFn>;
  emit: (event: MeshtasticMessageLogEvent) => void;
}

const makeConnection = (): FakeConnection => {
  let listener: ((event: MeshtasticMessageLogEvent) => void) | undefined;
  const subscribeEvents = vi.fn<SubscribeEventsFn>().mockImplementation((cb) => {
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
  callWS: vi.fn(() => Promise.resolve([])) as unknown as HomeAssistant['callWS'],
  callService: vi.fn(),
  connection: conn as unknown as HomeAssistant['connection'],
});

const flush = async (): Promise<void> => {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
};

// Mount the card with the composer enabled and wait for the initial subscribe +
// history load to settle, then hand back the composer bits the send tests drive.
const mountWithComposer = async (
  hass: HomeAssistant,
): Promise<{ el: CardElement; input: HTMLInputElement; button: HTMLButtonElement }> => {
  const el = document.createElement('meshtastic-chat-card') as CardElement;
  el.setConfig({ channel_entity: 'meshtastic.ch', enable_send: true });
  el.hass = hass;
  document.body.appendChild(el);

  await el.updateComplete;
  await flush();
  await el.updateComplete;

  const input = el.shadowRoot?.querySelector<HTMLInputElement>('.composer-input');
  const button = el.shadowRoot?.querySelector<HTMLButtonElement>('.composer-send');
  if (!input || !button) throw new Error('composer not found');
  return { el, input, button };
};

const typeAndSend = async (el: CardElement, input: HTMLInputElement, button: HTMLButtonElement, text: string) => {
  input.value = text;
  input.dispatchEvent(new Event('input'));
  await el.updateComplete;
  button.click();
  await flush();
  await el.updateComplete;
};

const rowsOf = (el: CardElement): Element[] => [...(el.shadowRoot?.querySelectorAll('.row') ?? [])];

// The event the integration fires for a message this instance sent.
const sentEvent = (message: string, contextId: string): MeshtasticMessageLogEvent => ({
  event_type: 'meshtastic_message_log',
  data: {
    entity_id: 'meshtastic.ch',
    from_name: 'Home Gateway (!0000006f)',
    message,
    pki: false,
    direction: 'out',
    to_name: 'Channel Primary',
  },
  time_fired: '2023-05-01T12:00:00.000Z',
  context: { id: contextId, user_id: null, parent_id: null },
});

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

  it('always renders the lock badge when a message has pki: true', async () => {
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
    await flush();

    conn.emit({
      event_type: 'meshtastic_message_log',
      data: {
        entity_id: 'meshtastic.ch',
        from_name: 'Bob',
        message: 'secret',
        pki: true,
      },
      time_fired: '2023-05-01T12:01:00.000Z',
      context: { id: 'ctx-2', user_id: null, parent_id: null },
    });

    await flush();
    await el.updateComplete;

    const lock = el.shadowRoot?.querySelector('.row .pki');
    expect(lock).toBeTruthy();
    expect(lock?.textContent).toContain('🔒');

    document.body.removeChild(el);
  });

  it('does not render the composer by default', async () => {
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

    expect(el.shadowRoot?.querySelector('.composer')).toBeNull();

    document.body.removeChild(el);
  });

  it('renders the composer when enable_send is true', async () => {
    const conn = makeConnection();
    const hass = makeHass(conn);

    const el = document.createElement('meshtastic-chat-card') as HTMLElement & {
      hass: HomeAssistant;
      setConfig: (cfg: Record<string, unknown>) => void;
      updateComplete: Promise<boolean>;
    };
    el.setConfig({ channel_entity: 'meshtastic.ch', enable_send: true });
    el.hass = hass;
    document.body.appendChild(el);

    await el.updateComplete;
    await flush();
    await el.updateComplete;

    const composer = el.shadowRoot?.querySelector('.composer');
    expect(composer).toBeTruthy();
    expect(composer?.querySelector('.composer-input')).toBeTruthy();
    expect(composer?.querySelector('.composer-send')).toBeTruthy();

    document.body.removeChild(el);
  });

  it('sends a broadcast_channel_message and clears the input on success', async () => {
    const conn = makeConnection();
    const hass = makeHass(conn);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const callService = hass.callService as unknown as Mock;
    callService.mockReturnValue(Promise.resolve());

    const el = document.createElement('meshtastic-chat-card') as HTMLElement & {
      hass: HomeAssistant;
      setConfig: (cfg: Record<string, unknown>) => void;
      updateComplete: Promise<boolean>;
    };
    el.setConfig({ channel_entity: 'meshtastic.ch', enable_send: true });
    el.hass = hass;
    document.body.appendChild(el);

    await el.updateComplete;
    await flush();
    await el.updateComplete;

    const input = el.shadowRoot?.querySelector<HTMLInputElement>('.composer-input');
    const button = el.shadowRoot?.querySelector<HTMLButtonElement>('.composer-send');
    expect(input).toBeTruthy();
    expect(button).toBeTruthy();

    if (!input || !button) throw new Error('composer not found');

    input.value = 'hello world';
    input.dispatchEvent(new Event('input'));
    await el.updateComplete;

    expect(button.disabled).toBe(false);

    button.click();
    await flush();
    await el.updateComplete;

    expect(callService).toHaveBeenCalledWith('meshtastic', 'broadcast_channel_message', {
      channel: 'meshtastic.ch',
      message: 'hello world',
      ack: true,
    });

    const inputAfter = el.shadowRoot?.querySelector<HTMLInputElement>('.composer-input');
    expect(inputAfter?.value).toBe('');

    document.body.removeChild(el);
  });

  it('appends an optimistic "You" row in the chat log after a successful send', async () => {
    const conn = makeConnection();
    const hass = makeHass(conn);
    (hass.callService as unknown as Mock).mockReturnValue(Promise.resolve());

    const el = document.createElement('meshtastic-chat-card') as HTMLElement & {
      hass: HomeAssistant;
      setConfig: (cfg: Record<string, unknown>) => void;
      updateComplete: Promise<boolean>;
    };
    el.setConfig({ channel_entity: 'meshtastic.ch', enable_send: true });
    el.hass = hass;
    document.body.appendChild(el);

    await el.updateComplete;
    await flush();
    await el.updateComplete;

    const input = el.shadowRoot?.querySelector<HTMLInputElement>('.composer-input');
    const button = el.shadowRoot?.querySelector<HTMLButtonElement>('.composer-send');
    if (!input || !button) throw new Error('composer not found');

    input.value = 'optimistic hi';
    input.dispatchEvent(new Event('input'));
    await el.updateComplete;

    button.click();
    await flush();
    await el.updateComplete;

    const rows = el.shadowRoot?.querySelectorAll('.row') ?? [];
    expect(rows.length).toBe(1);
    expect(rows[0]?.textContent).toContain('You');
    expect(rows[0]?.textContent).toContain('optimistic hi');

    document.body.removeChild(el);
  });

  it('leaves no row behind and hands the draft back when the send fails', async () => {
    const conn = makeConnection();
    const hass = makeHass(conn);
    (hass.callService as unknown as Mock).mockImplementation(() => Promise.reject(new Error('boom')));

    const { el, input, button } = await mountWithComposer(hass);
    await typeAndSend(el, input, button, 'will fail');

    expect(rowsOf(el).length).toBe(0);
    // The text comes back so it can be corrected and retried.
    expect(el.shadowRoot?.querySelector<HTMLInputElement>('.composer-input')?.value).toBe('will fail');
    expect(el.shadowRoot?.querySelector('.send-error')).toBeTruthy();

    document.body.removeChild(el);
  });

  it('shows the sent message before the service call resolves', async () => {
    const conn = makeConnection();
    const hass = makeHass(conn);
    // Sending with ack enabled blocks until the mesh answers, so the row must not
    // wait on the service call.
    (hass.callService as unknown as Mock).mockImplementation(() => new Promise<ServiceCallResult>(() => undefined));

    const { el, input, button } = await mountWithComposer(hass);
    await typeAndSend(el, input, button, 'no waiting');

    const rows = rowsOf(el);
    expect(rows.length).toBe(1);
    expect(rows[0]?.textContent).toContain('You');
    expect(rows[0]?.textContent).toContain('no waiting');
    expect(rows[0]?.classList.contains('own')).toBe(true);
    expect(rows[0]?.classList.contains('pending')).toBe(true);

    document.body.removeChild(el);
  });

  it('keeps one row when the live event arrives before the service call resolves', async () => {
    const conn = makeConnection();
    const hass = makeHass(conn);
    let resolveSend: ((result: ServiceCallResult) => void) | undefined;
    (hass.callService as unknown as Mock).mockImplementation(
      () =>
        new Promise<ServiceCallResult>((resolve) => {
          resolveSend = resolve;
        }),
    );

    const { el, input, button } = await mountWithComposer(hass);
    await typeAndSend(el, input, button, 'echo me');

    // The integration logs the message and fires the event while the service
    // call is still in flight, which is the usual ordering with ack enabled.
    conn.emit(sentEvent('echo me', 'ctx-send'));
    await flush();
    await el.updateComplete;

    resolveSend?.({ context: { id: 'ctx-send' } });
    await flush();
    await el.updateComplete;

    const rows = rowsOf(el);
    expect(rows.length).toBe(1);
    expect(rows[0]?.textContent).toContain('You');
    expect(rows[0]?.classList.contains('pending')).toBe(false);

    document.body.removeChild(el);
  });

  it('keeps one row when the live event arrives after the service call resolves', async () => {
    const conn = makeConnection();
    const hass = makeHass(conn);
    (hass.callService as unknown as Mock).mockImplementation(() =>
      Promise.resolve<ServiceCallResult>({ context: { id: 'ctx-send' } }),
    );

    const { el, input, button } = await mountWithComposer(hass);
    await typeAndSend(el, input, button, 'echo me');

    // The optimistic row has been re-keyed to the context id by now, so the
    // event de-dupes against it.
    conn.emit(sentEvent('echo me', 'ctx-send'));
    await flush();
    await el.updateComplete;

    const rows = rowsOf(el);
    expect(rows.length).toBe(1);
    expect(rows[0]?.textContent).toContain('echo me');

    document.body.removeChild(el);
  });

  it('marks messages this instance sent as own, and received ones as not', async () => {
    const conn = makeConnection();
    const hass = makeHass(conn);

    const { el } = await mountWithComposer(hass);

    conn.emit(sentEvent('mine', 'ctx-out'));
    conn.emit({
      event_type: 'meshtastic_message_log',
      data: { entity_id: 'meshtastic.ch', from_name: 'Alice', message: 'theirs', pki: false, direction: 'in' },
      time_fired: '2023-05-01T12:01:00.000Z',
      context: { id: 'ctx-in', user_id: null, parent_id: null },
    });
    await flush();
    await el.updateComplete;

    // Newest first by default, so the received message leads.
    const rows = rowsOf(el);
    expect(rows.length).toBe(2);
    expect(rows[0]?.textContent).toContain('Alice');
    expect(rows[0]?.classList.contains('own')).toBe(false);
    expect(rows[1]?.textContent).toContain('You');
    expect(rows[1]?.classList.contains('own')).toBe(true);

    document.body.removeChild(el);
  });

  it('does not send when the input is empty or only whitespace', async () => {
    const conn = makeConnection();
    const hass = makeHass(conn);
    (hass.callService as unknown as Mock).mockReturnValue(Promise.resolve());

    const el = document.createElement('meshtastic-chat-card') as HTMLElement & {
      hass: HomeAssistant;
      setConfig: (cfg: Record<string, unknown>) => void;
      updateComplete: Promise<boolean>;
    };
    el.setConfig({ channel_entity: 'meshtastic.ch', enable_send: true });
    el.hass = hass;
    document.body.appendChild(el);

    await el.updateComplete;
    await flush();
    await el.updateComplete;

    const input = el.shadowRoot?.querySelector<HTMLInputElement>('.composer-input');
    const button = el.shadowRoot?.querySelector<HTMLButtonElement>('.composer-send');
    if (!input || !button) throw new Error('composer not found');

    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    await el.updateComplete;

    expect(button.disabled).toBe(true);

    document.body.removeChild(el);
  });
});
