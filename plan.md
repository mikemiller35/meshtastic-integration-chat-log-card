# Meshtastic Chat Card — Build Plan

A standalone HACS Lovelace card that displays Meshtastic channel messages
already recorded by the existing `custom_components/meshtastic` integration.
**No backend changes required.**

Boilerplate: <https://github.com/tolnai/hacs_custom_card_boilerplate>
(TypeScript + Lit 2.8 + Rollup, yarn 4, ESLint, MIT.)

## 1. Goals

- Display received channel messages on a Lovelace dashboard.
- Per-card selection of **gateway** and **channel** (primary / secondary / named).
- Read-only (v1). Sending is out of scope.
- History persists across HA restarts and across browser sessions
  (uses HA's recorder/logbook — same place the integration already writes to).
- No external CDN dependencies; everything bundled by Rollup.

## 2. Data the integration already exposes (we consume only this)

From `custom_components/meshtastic/const.py` and `logbook.py`:

| Source | What it gives us | Used for |
|---|---|---|
| Channel entities (`device_class: "channel"`) with attrs `index`, `node`, `primary`, `secondary` | List of gateways + their channels | Populating dropdowns |
| Event `meshtastic_message_log` (`EVENT_MESHTASTIC_DOMAIN_MESSAGE_LOG`) with `entity_id`, `device_id`, `from_name`, `message`, `pki` | Display-ready messages already keyed to a channel entity | Live updates **and** history |
| HA `logbook/get_events` WS command filtered by `entity_ids: [<channel entity>]` | Persisted history (recorder retention, default 10 days) | Initial backfill |

We **do not** need: custom Python, custom WS commands, in-memory buffer.

## 3. Architecture

```
┌──────────────────────────────────────────────────────────┐
│ meshtastic-chat-card  (this repo, frontend only)         │
│                                                          │
│  setConfig() → pick (gateway entry / channel entity)     │
│  connectedCallback():                                    │
│    ① logbook/get_events  (entity_ids: [channel])  ⟶ list │
│    ② subscribe_events  (meshtastic_message_log)   ⟶ live │
│  render(): scrolling list (from_name • time • message)   │
└──────────────────────────────────────────────────────────┘
                ▲                          ▲
                │ WS                       │ WS
                │                          │
┌──────────────────────────────────────────────────────────┐
│ Home Assistant (logbook + recorder + event bus)          │
│   ← already populated by the meshtastic integration      │
└──────────────────────────────────────────────────────────┘
```

## 4. Repo bootstrap

4. Rename in `package.json`, `hacs.json`, `rollup.config.js`,
   `rollup.config.dev.js`, `src/index.ts`:
   - `hacs-boilerplate-card` → `meshtastic-chat-card`
   - `HACS Boilerplate Card` → `Meshtastic Chat`
   - `HacsBoilerplateCard` → `MeshtasticChatCard`
   - update `description`, `repository`, `author`, `keywords`.
5. Bump `package.json` to `1.0.0`, blank out `CHANGELOG.md`.
6. `yarn rollup` → confirm a clean build at `dist/meshtastic-chat-card.js`.

## 5. Files to write

| File | Purpose |
|---|---|
| `src/index.ts` | Card class + `customCards` registration + editor class. |
| `src/types.ts` | `ChatCardConfig`, `ChatMessage`, HA event payload types. |
| `src/discovery.ts` | Helpers to enumerate gateways/channels from `hass.states`. |
| `src/history.ts` | `loadHistory(hass, entityId)` → `logbook/get_events` wrapper. |
| `src/live.ts` | `subscribeMessageLog(hass, entityId, cb)` wrapper. |
| `src/styles.ts` | Lit `css` for the card. |
| `src/styles-edit.ts` | Lit `css` for the visual editor. |
| `README.md`, `hacs.json`, `CHANGELOG.md` | HACS metadata. |

## 6. Card config schema (YAML)

```yaml
type: custom:meshtastic-chat-card
title: LongFast               # optional, falls back to channel name
channel_entity: meshtastic.gateway_brig_channel_primary  # required if no picker
limit: 200                    # max rendered messages (default 200)
show_timestamps: true         # default true
show_pki_badge: true          # show 🔒 for PKI/DM messages (default true)
```

Stub config (`getStubConfig`): pick the first `device_class === "channel"`
state in `hass.states` and use its `entity_id`.

## 7. Implementation details

### 7.1 Discovery (`src/discovery.ts`)

```ts
// All channel entities exposed by the integration
const channels = Object.values(hass.states).filter(
  (s) => s.attributes.device_class === "channel" &&
         s.entity_id.startsWith("meshtastic.")
);
// attrs: index, node, primary (bool), secondary (bool)
```

Group by gateway (`attributes.node`). Use `hass.devices` (or
`area_registry`) to resolve gateway display names; fall back to the
channel's `friendly_name` prefix.

### 7.2 History (`src/history.ts`)

```ts
const events = await hass.callWS<LogbookEntry[]>({
  type: "logbook/get_events",
  start_time: new Date(Date.now() - 7 * 864e5).toISOString(),
  entity_ids: [config.channel_entity],
});
```

The integration's logbook describer formats the message as
`«<text>» by <from_name>`. Parse it back, **or** prefer the raw
`meshtastic_message_log` payload by also calling
`history/history_during_period` if needed. Easier path: just split on
`«…» by ` regex for v1.

### 7.3 Live updates (`src/live.ts`)

```ts
const unsub = await hass.connection.subscribeEvents<MessageLogEvent>(
  (e) => {
    if (e.data.entity_id === config.channel_entity) appendMessage(e.data);
  },
  "meshtastic_message_log",
);
```

Tear down in `disconnectedCallback()` and on `setConfig` change.

### 7.4 Render

Scrolling `<ul>` with rows: `[time]  <from_name>:  <message>  [🔒 if pki]`.
Auto-scroll to bottom on new message unless the user has scrolled up
(detect via `scrollHeight - scrollTop - clientHeight > threshold`).

## 8. Visual editor (`getConfigElement`)

Reuse the boilerplate editor pattern. One `ha-form` panel:

| Field | Selector |
|---|---|
| `channel_entity` | `{ entity: { domain: "meshtastic", device_class: "channel" } }` |
| `title` | `{ text: {} }` |
| `limit` | `{ number: { min: 10, max: 1000, step: 10 } }` |
| `show_timestamps` | `{ boolean: {} }` |
| `show_pki_badge` | `{ boolean: {} }` |

The HA entity selector with `device_class: "channel"` gives the user a
native picker showing `Channel Primary`, `Channel Secondary`, etc.,
grouped by gateway device — no custom dropdown needed.

## 9. Build & HACS release

Same as the boilerplate README:

- Dev: `yarn start` (writes to `<config>/www/meshtastic-chat-card.js`,
  watch mode), add `/local/meshtastic-chat-card.js` as a Lovelace
  resource, disable browser cache while iterating.
- Release: bump `package.json`, update `CHANGELOG.md`, `yarn build`,
  create a GitHub release with the tag (`1.0.0`), attach
  `dist/meshtastic-chat-card.js`. HACS picks up the asset automatically.
- `hacs.json` keeps `"filename": "meshtastic-chat-card.js"`.

## 10. Limitations (v1)

- Logbook/recorder must be enabled (the integration's README already
  states this); messages are gone from history if recorder is disabled.
- History depth = recorder retention (default 10 days).
- Direct messages aren't covered in v1 (the DM entity exists but
  threading per-peer needs a separate UX). Easy follow-up: accept
  a `dm_entity` config and group rows by `from_name`.
- Outgoing messages from the gateway itself aren't logged by the
  integration today — same caveat as Logbook view.

## 11. Roadmap / follow-ups

- DM mode (per-peer threads).
- Send box (calls `meshtastic.send_text` / `broadcast_channel_message`).
- Multi-channel "all gateways" feed.
- Unread badge + browser notification on new messages.
- Per-message tap → `more-info` on the originating node device.

