# Meshtastic Chat Card

A custom [Lovelace](https://www.home-assistant.io/dashboards/) card for [Home Assistant](https://www.home-assistant.io/) that displays Meshtastic channel messages recorded by the [`meshtastic` integration](https://github.com/meshtastic/home-assistant).

## Features

- **History backfill** – on load, pulls up to 7 days of past messages from the HA logbook (`logbook/get_events`).
- **Live updates** – subscribes to the `meshtastic_message_log` event bus so new messages appear instantly without a page refresh.
- **Auto-scroll** – automatically scrolls to the latest message; pauses auto-scroll when you scroll up, and resumes when you scroll back to the bottom.
- **PKI / direct-message badge** – optionally shows a 🔒 badge next to messages delivered over an encrypted direct link.
- **Visual editor** – all options are configurable through the Lovelace UI editor; no YAML required.
- **Channel auto-discovery** – when adding a new card, the editor pre-selects the primary Meshtastic channel entity if one exists.
- **Message deduplication** – messages received from both history and the live event stream are deduplicated so nothing appears twice.

## Requirements

- Home Assistant with the [`meshtastic` custom integration](https://github.com/meshtastic/home-assistant) installed and configured.
- At least one Meshtastic gateway device added to HA with a channel entity (`device_class: channel`).

## Installation

### HACS (recommended)

1. Open **HACS → Frontend** in Home Assistant.
2. Click the three-dot menu → **Custom repositories**.
3. Add `https://github.com/ch0ppy35/meshtastic-integration-chat-log-card` with category **Dashboard**.
4. Search for **Meshtastic Chat** and install it.
5. Reload your browser.

### Manual

1. Download `meshtastic-chat-card.js` from the [latest release](https://github.com/ch0ppy35/meshtastic-integration-chat-log-card/releases).
2. Copy the file to `config/www/meshtastic-chat-card.js` on your Home Assistant instance.
3. Go to **Settings → Dashboards → Resources** and add `/local/meshtastic-chat-card.js` as a **JavaScript module**.
4. Reload your browser.

## Usage

Add the card via the Lovelace UI (**Add card → Meshtastic Chat**) or paste the YAML directly:

```yaml
type: custom:meshtastic-chat-card
channel_entity: meshtastic.my_gateway_channel_primary
```

### Configuration options

| Option            | Type    | Default | Description                                                                 |
|-------------------|---------|---------|-----------------------------------------------------------------------------|
| `channel_entity`  | string  | —       | **Required.** Entity ID of the Meshtastic channel to display (`device_class: channel`). |
| `title`           | string  | —       | Card title. Defaults to the channel entity's `friendly_name`.               |
| `limit`           | number  | `200`   | Maximum number of messages to keep rendered (oldest are dropped first).     |
| `show_timestamps` | boolean | `true`  | Show the `HH:MM` timestamp at the start of each message row.                |
| `show_pki_badge`  | boolean | `true`  | Show a 🔒 badge on messages delivered via PKI / direct encrypted link.      |

### Full YAML example

```yaml
type: custom:meshtastic-chat-card
channel_entity: meshtastic.my_gateway_channel_primary
title: "Base Camp Chat"
limit: 100
show_timestamps: true
show_pki_badge: true
```

## Development

```bash
# Install dependencies
yarn install

# Start a development server with live rebuild (sets DEV=true in index.ts)
yarn start

# Production build → dist/meshtastic-chat-card.js
yarn build

# Lint
yarn lint
```

The development build registers the card as `meshtastic-chat-card-dev` so it can coexist with a production build in the same HA instance. Set `DEV = false` in `src/index.ts` before cutting a release.
