# Changelog

## v1.0.0 (unreleased)

🚀 New features:

- Initial release. Read-only Lovelace card that displays Meshtastic channel
  messages recorded by the `meshtastic` Home Assistant integration.
- Per-card channel selection via HA entity selector
  (`device_class: "channel"`).
- Backfills history from `logbook/get_events` and live-updates via the
  `meshtastic_message_log` event bus.
- Visual editor (`title`, `channel_entity`, `limit`, `show_timestamps`,
  `show_pki_badge`).
