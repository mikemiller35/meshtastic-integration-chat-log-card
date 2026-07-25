# Changelog

## Unreleased

🚀 New features:

- Optional `enable_send` config flag adds a composer at the top of the card.
  When enabled, sends to the configured channel via the integration's
  `meshtastic.broadcast_channel_message` service.
- Messages you send are now marked as your own (`You: …` with an accent bar)
  and persist across reloads, tabs and devices, provided the integration
  reports outbound messages via `direction: "out"` on
  `meshtastic_message_log`. De-duplication keys on Home Assistant's context id,
  so a sent message renders exactly once no matter whether the live event or
  the service call response arrives first. See
  [docs/sent-message-echo.md](docs/sent-message-echo.md).
- The composer now shows a sent message immediately rather than waiting for the
  service call to finish, and hands the text back to the input if the send
  fails so it can be retried.

💥 Breaking changes:

- Removed the `show_pki_badge` config option. The 🔒 badge is now always
  shown for messages with `pki: true`.
- `ChatMessage` gained a required `own: boolean` field. Only relevant if you
  import the card's types.

## v1.0.0 (unreleased)

🚀 New features:

- Initial release. Read-only Lovelace card that displays Meshtastic channel
  messages recorded by the `meshtastic` Home Assistant integration.
- Per-card channel selection via HA entity selector
  (`device_class: "channel"`).
- Backfills history from `logbook/get_events` and live-updates via the
  `meshtastic_message_log` event bus.
- Visual editor (`title`, `channel_entity`, `limit`, `show_timestamps`,
  `sort_order`).
