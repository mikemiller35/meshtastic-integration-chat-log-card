import { LitElement, html, nothing, type TemplateResult, type CSSResultGroup, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { type HassEntity } from 'home-assistant-js-websocket';

import styles from './styles';
import packageJson from '../package.json' with { type: 'json' };

const version = packageJson.version;

import { type HomeAssistant } from './ha-types';
import { DEFAULT_LIMIT, type ChatCardConfig, type ChatMessage } from './types';
import { loadHistory } from './history';
import { subscribeMessageLog, type Unsubscribe } from './live';
import { pickDefaultChannelEntity } from './discovery';
import { appendUnique, trimMessages } from './messages';

// `__MESHTASTIC_CARD_DEV__` is replaced at build time by @rollup/plugin-replace
// (true for the dev rollup config, false for the production build). Declaring
// it lets us reference the constant without depending on a runtime env var.
declare const __MESHTASTIC_CARD_DEV__: boolean;
const DEV: boolean = typeof __MESHTASTIC_CARD_DEV__ !== 'undefined' ? __MESHTASTIC_CARD_DEV__ : false;

const cardId = 'meshtastic-chat-card';
const cardName = 'Meshtastic Chat';
const cardDescription = 'Display Meshtastic channel messages recorded by the meshtastic Home Assistant integration.';
const cardUrl = 'https://github.com/ch0ppy35/meshtastic-integration-chat-log-card';

declare global {
  interface Window {
    customCards?: { type: string; name: string; preview?: boolean; description?: string; documentationURL?: string }[];
  }
}

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
  @state() private _sortOverride?: 'asc' | 'desc';

  private _unsubscribe?: Unsubscribe;
  private _subscribedEntity?: string;
  private _autoStick = true;
  private _scrollEl?: HTMLElement | null;
  private _flashIds = new Set<string>();

  // Use the built-in form editor (https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card#using-the-built-in-form-editor).
  // No bespoke editor element is needed.
  static getConfigForm() {
    return {
      schema: [
        {
          name: 'channel_entity',
          required: true,
          selector: { entity: { domain: 'meshtastic', device_class: 'channel' } },
        },
        { name: 'title', selector: { text: {} } },
        {
          name: 'limit',
          selector: { number: { min: 10, max: 1000, step: 10, mode: 'box' } },
        },
        { name: 'show_timestamps', selector: { boolean: {} } },
        { name: 'show_pki_badge', selector: { boolean: {} } },
        {
          name: 'sort_order',
          selector: {
            select: {
              mode: 'dropdown',
              options: [
                { value: 'asc', label: 'Oldest first' },
                { value: 'desc', label: 'Newest first' },
              ],
            },
          },
        },
      ],
      assertConfig: (config: ChatCardConfig) => {
        if (!config.channel_entity || typeof config.channel_entity !== 'string') {
          throw new Error('channel_entity is required');
        }
        if (config.limit !== undefined && (typeof config.limit !== 'number' || config.limit <= 0)) {
          throw new Error('limit must be a positive number');
        }
      },
    };
  }

  static getStubConfig(hass: HomeAssistant): Partial<ChatCardConfig> {
    const channel_entity = pickDefaultChannelEntity(hass);
    return {
      channel_entity: channel_entity ?? '',
      limit: DEFAULT_LIMIT,
      show_timestamps: true,
      show_pki_badge: true,
      sort_order: 'desc',
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
      sort_order: 'desc',
      ...config,
    };
  }

  // Masonry view sizing: roughly 50px per unit, so 6 ≈ 300px.
  public getCardSize() {
    return 6;
  }

  // Sections view sizing
  // (https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card#sizing-in-sections-view).
  public getGridOptions() {
    return { rows: 4, columns: 6, min_rows: 3, min_columns: 6 };
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
    this._sortOverride = undefined;
    try {
      const [history, unsub] = await Promise.all([
        loadHistory(this.hass, entityId),
        subscribeMessageLog(this.hass, entityId, (msg) => {
          this._appendMessage(msg);
        }),
      ]);
      // Guard against teardown/restart while we awaited.
      if (this._subscribedEntity !== entityId) {
        unsub();
        return;
      }
      this._unsubscribe = unsub;
      this._messages = trimMessages(history, this._config?.limit ?? DEFAULT_LIMIT);
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

  private _appendMessage(msg: ChatMessage): void {
    const limit = this._config?.limit ?? DEFAULT_LIMIT;
    const result = appendUnique(this._messages, msg, limit);
    if (!result.appended) return;
    this._flashIds.add(msg.id);
    this._messages = result.messages;
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('_messages')) {
      if (this._autoStick) this._scrollToNewest();
      // Deterministically clear flash ids after the animation completes,
      // rather than racing the render with a microtask. The 1300ms is a
      // little longer than the 1.2s `flash` keyframe in styles.ts.
      if (this._flashIds.size > 0) {
        const ids = [...this._flashIds];
        setTimeout(() => {
          let cleared = false;
          for (const id of ids) {
            if (this._flashIds.delete(id)) cleared = true;
          }
          if (cleared) this.requestUpdate();
        }, 1300);
      }
    }
  }

  private _onScroll = (ev: Event): void => {
    const el = ev.currentTarget as HTMLElement;
    const distance = this._sortOrder() === 'desc' ? el.scrollTop : el.scrollHeight - el.scrollTop - el.clientHeight;
    this._autoStick = distance < 24;
  };

  private _scrollToNewest(): void {
    const el = this._scrollEl ?? this.renderRoot.querySelector<HTMLElement>('.messages');
    this._scrollEl = el;
    if (!el) return;
    const desc = this._sortOrder() === 'desc';
    // Defer to after the DOM has actually rendered the new row.
    requestAnimationFrame(() => {
      el.scrollTop = desc ? 0 : el.scrollHeight;
    });
  }

  private _sortOrder(): 'asc' | 'desc' {
    return this._sortOverride ?? this._config?.sort_order ?? 'desc';
  }

  private _toggleSortOrder = (): void => {
    this._sortOverride = this._sortOrder() === 'asc' ? 'desc' : 'asc';
    this._autoStick = true;
    this._scrollToNewest();
  };

  private _formatTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private _renderRow(msg: ChatMessage): TemplateResult {
    const showTime = this._config?.show_timestamps !== false;
    const showPki = this._config?.show_pki_badge !== false;
    const flash = this._flashIds.has(msg.id);
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
    const channelLabel = this._config.title ?? stateObj?.attributes.friendly_name ?? this._config.channel_entity;

    return html`
      <ha-card>
        <div class="header">
          <div class="title">${channelLabel}</div>
          <div class="meta">
            ${this._loading
              ? 'Loading…'
              : `${String(this._messages.length)} message${this._messages.length === 1 ? '' : 's'}`}
            <button
              class="sort-toggle"
              type="button"
              title=${this._sortOrder() === 'desc' ? 'Newest first (click to flip)' : 'Oldest first (click to flip)'}
              aria-label=${this._sortOrder() === 'desc' ? 'Sort oldest first' : 'Sort newest first'}
              @click=${this._toggleSortOrder}
            >
              ${this._sortOrder() === 'desc' ? '↓' : '↑'}
            </button>
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
            this._sortOrder() === 'desc' ? [...this._messages].reverse() : this._messages,
            (m) => m.id,
            (m) => this._renderRow(m),
          )}
        </div>
      </ha-card>
    `;
  }
}
