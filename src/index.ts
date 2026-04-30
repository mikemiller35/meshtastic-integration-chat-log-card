import { LitElement, html, nothing, type TemplateResult, type CSSResultGroup, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { type HomeAssistant } from 'custom-card-helpers';
import { type HassEntity } from 'home-assistant-js-websocket';

import styles from './styles';
import editStyles from './styles-edit';
import { version } from '../package.json';

import { DEFAULT_LIMIT, type ChatCardConfig, type ChatMessage } from './types';
import { loadHistory } from './history';
import { subscribeMessageLog, type Unsubscribe } from './live';
import { pickDefaultChannelEntity } from './discovery';

// Use this if you want both the dev and prod versions installed in the same instance.
// For local development use true, but change it to false whenever building a new release.
const DEV = false as boolean;

const cardId = 'meshtastic-chat-card';
const cardName = 'Meshtastic Chat';
const cardDescription = 'Display Meshtastic channel messages recorded by the meshtastic Home Assistant integration.';
const cardUrl = 'https://github.com/mmiller/meshtastic-integration-chat-log-card';

declare global {
  interface Window {
    loadCardHelpers?: () => Promise<unknown>;
    customCards?: { type: string; name: string; preview?: boolean; description?: string; documentationURL?: string }[];
  }
}

const loadHaForm = async () => {
  if (customElements.get('ha-form')) return;
  if (!window.loadCardHelpers) return;
  const helpers = (await window.loadCardHelpers()) as { createCardElement?: (cfg: unknown) => unknown } | undefined;
  if (!helpers?.createCardElement) return;
  const card = helpers.createCardElement({ type: 'entities', entities: [] }) as
    | { constructor: { getConfigElement?: () => void } }
    | undefined;
  card?.constructor.getConfigElement?.();
};

// eslint-disable-next-line no-console
console.info(
  `%c ${cardName}${DEV ? ' DEV' : ''} \n%c Version v${version}`,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

window.customCards = window.customCards ?? [];
window.customCards.push({
  type: `${cardId}${DEV ? '-dev' : ''}`,
  name: `${cardName}${DEV ? ' DEV' : ''}`,
  preview: false,
  description: cardDescription,
  documentationURL: cardUrl,
});

@customElement(`${cardId}${DEV ? '-dev' : ''}`)
export class MeshtasticChatCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _config?: ChatCardConfig;
  @state() private _messages: ChatMessage[] = [];
  @state() private _error?: string;
  @state() private _loading = false;

  private _unsubscribe?: Unsubscribe;
  private _subscribedEntity?: string;
  private _autoStick = true;
  private _scrollEl?: HTMLElement | null;
  private _flashIds = new Set<string>();

  static getConfigElement() {
    return document.createElement(`${cardId}-editor${DEV ? '-dev' : ''}`);
  }

  static getStubConfig(hass: HomeAssistant): Partial<ChatCardConfig> {
    const channel_entity = pickDefaultChannelEntity(hass);
    return {
      channel_entity: channel_entity ?? '',
      limit: DEFAULT_LIMIT,
      show_timestamps: true,
      show_pki_badge: true,
    };
  }

  public setConfig(config?: ChatCardConfig) {
    if (!config) {
      throw new Error('Invalid configuration.');
    }
    if (!config.channel_entity || typeof config.channel_entity !== 'string') {
      throw new Error('You need to set `channel_entity` (a meshtastic channel entity).');
    }
    if (config.limit !== undefined && (typeof config.limit !== 'number' || config.limit <= 0)) {
      throw new Error('`limit` must be a positive number.');
    }
    this._config = {
      limit: DEFAULT_LIMIT,
      show_timestamps: true,
      show_pki_badge: true,
      ...config,
    };
  }

  public getCardSize() {
    return 6;
  }

  static get styles(): CSSResultGroup {
    return styles;
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this._maybeStart();
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    this._teardown();
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('hass') || changed.has('_config')) {
      this._maybeStart();
    }
  }

  private _maybeStart(): void {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!this.isConnected || !this.hass || !this._config) return;
    const target = this._config.channel_entity;
    if (!target) return;
    if (this._subscribedEntity === target) return;
    void this._restart(target);
  }

  private async _restart(entityId: string): Promise<void> {
    this._teardown();
    this._subscribedEntity = entityId;
    this._error = undefined;
    this._messages = [];
    this._loading = true;
    try {
      const [history, unsub] = await Promise.all([
        loadHistory(this.hass, entityId),
        subscribeMessageLog(this.hass, entityId, (msg) => { this._appendMessage(msg); }),
      ]);
      // Guard against teardown/restart while we awaited.
      if (this._subscribedEntity !== entityId) {
        unsub();
        return;
      }
      this._unsubscribe = unsub;
      this._messages = this._trim(history);
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
    } finally {
      if (this._subscribedEntity === entityId) this._loading = false;
    }
  }

  private _teardown(): void {
    if (this._unsubscribe) {
      try {
        this._unsubscribe();
      } catch {
        // ignore
      }
      this._unsubscribe = undefined;
    }
    this._subscribedEntity = undefined;
  }

  private _trim(messages: ChatMessage[]): ChatMessage[] {
    const limit = this._config?.limit ?? DEFAULT_LIMIT;
    if (messages.length <= limit) return messages;
    return messages.slice(messages.length - limit);
  }

  private _appendMessage(msg: ChatMessage): void {
    if (this._messages.some((m) => m.id === msg.id)) return;
    this._flashIds.add(msg.id);
    this._messages = this._trim([...this._messages, msg]);
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('_messages') && this._autoStick) {
      this._scrollToBottom();
    }
  }

  private _onScroll = (ev: Event): void => {
    const el = ev.currentTarget as HTMLElement;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    this._autoStick = distance < 24;
  };

  private _scrollToBottom(): void {
    const el = this._scrollEl ?? this.renderRoot.querySelector<HTMLElement>('.messages');
    this._scrollEl = el;
    if (!el) return;
    // Defer to after the DOM has actually rendered the new row.
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }

  private _formatTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  private _renderRow(msg: ChatMessage): TemplateResult {
    const showTime = this._config?.show_timestamps !== false;
    const showPki = this._config?.show_pki_badge !== false;
    const flash = this._flashIds.has(msg.id);
    if (flash) {
      // Clear the flash flag once it's been consumed in a render pass.
      queueMicrotask(() => this._flashIds.delete(msg.id));
    }
    return html`
      <div class="row ${flash ? 'live-flash' : ''}" title=${new Date(msg.time).toLocaleString()}>
        <span class="time">${showTime ? this._formatTime(msg.time) : nothing}</span>
        <span class="body">
          <span class="from">${msg.fromName}</span>
          <span class="text">${msg.message}</span>
          ${showPki && msg.pki ? html`<span class="pki" title="PKI / direct">🔒</span>` : nothing}
        </span>
      </div>
    `;
  }

  protected render(): TemplateResult {
    if (!this._config) {
      return html`<ha-card><div class="error">Card not configured.</div></ha-card>`;
    }
    const stateObj = this.hass.states[this._config.channel_entity] as HassEntity | undefined;
    const channelLabel =
      this._config.title ??
      stateObj?.attributes.friendly_name ??
      this._config.channel_entity;

    return html`
      <ha-card>
        <div class="header">
          <div class="title">${channelLabel}</div>
          <div class="meta">
            ${this._loading
              ? 'Loading…'
              : `${String(this._messages.length)} message${this._messages.length === 1 ? '' : 's'}`}
          </div>
        </div>
        ${this._error ? html`<div class="error">${this._error}</div>` : nothing}
        ${!stateObj && !this._error
          ? html`<div class="error">Channel entity not found: ${this._config.channel_entity}</div>`
          : nothing}
        <div class="messages" @scroll=${this._onScroll}>
          ${this._messages.length === 0 && !this._loading && !this._error
            ? html`<div class="empty">No messages yet.</div>`
            : nothing}
          ${repeat(
            this._messages,
            (m) => m.id,
            (m) => this._renderRow(m),
          )}
        </div>
      </ha-card>
    `;
  }
}


// ---------------------------------------------------------------------------
// Visual editor
// ---------------------------------------------------------------------------

@customElement(`${cardId}-editor${DEV ? '-dev' : ''}`)
export class MeshtasticChatCardEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _config?: ChatCardConfig;

  static get styles(): CSSResultGroup {
    return editStyles;
  }

  public connectedCallback(): void {
    super.connectedCallback();
    void loadHaForm();
  }

  public setConfig(config: ChatCardConfig): void {
    this._config = config;
  }

  private _computeLabel = (schema: { label?: string; name?: string }): string => {
    return schema.label ?? schema.name ?? '';
  };

  private _valueChanged = (ev: CustomEvent<{ value: ChatCardConfig }>): void => {
    const next = ev.detail.value;
    this._config = next;
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: next },
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected render(): TemplateResult {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!this.hass || !this._config) {
      return html``;
    }
    const schema = [
      {
        name: 'channel_entity',
        label: 'Channel entity',
        required: true,
        selector: { entity: { domain: 'meshtastic', device_class: 'channel' } },
      },
      { name: 'title', label: 'Title (optional)', selector: { text: {} } },
      {
        name: 'limit',
        label: 'Max rendered messages',
        selector: { number: { min: 10, max: 1000, step: 10, mode: 'box' } },
      },
      { name: 'show_timestamps', label: 'Show timestamps', selector: { boolean: {} } },
      { name: 'show_pki_badge', label: 'Show PKI/DM 🔒 badge', selector: { boolean: {} } },
    ];

    return html`
      <div class="card-config">
        <div class="box">
          <ha-form
            .hass=${this.hass}
            .data=${this._config}
            .schema=${schema}
            .computeLabel=${this._computeLabel}
            @value-changed=${this._valueChanged}
          ></ha-form>
          <p class="intro">
            Pick a Meshtastic channel entity. The card backfills history from the
            recorder and updates live via the <code>meshtastic_message_log</code> event.
          </p>
        </div>
      </div>
    `;
  }
}
