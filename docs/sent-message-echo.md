# Sent messages: how your own messages appear in the log

When you send a message via the card's composer, the card adds your message to
the visible chat log immediately as **`You: …`** so you get instant feedback.

That echo is **client-side only** — it lives in the open browser tab's memory.
The message itself is transmitted normally over the mesh, but the entry you
see in your log is not stored or shared anywhere.

## What this means

- The "You" entry disappears when you **reload the page** or navigate away and
  back.
- It is not visible in **other browser tabs**, **other dashboards**, or on
  **other devices** viewing the same Home Assistant instance.
- It does **not** appear in the Home Assistant
  [Logbook](https://www.home-assistant.io/integrations/logbook/) or the
  built-in **Activity** card.
- It is **not** written to the Home Assistant recorder database.
- Other mesh nodes still receive your message normally — the transmission is
  unaffected. Their logs will show it as a real received message from your
  node, and it will persist for them via the integration's normal logbook
  path.

## Why

The card reads its history from Home Assistant's logbook
(`logbook/get_events`) and its live updates from the
`meshtastic_message_log` event on the HA event bus. The upstream
[Meshtastic Home Assistant
integration](https://github.com/meshtastic/home-assistant) only emits that
event — and only writes a logbook entry — for messages it **receives** off
the mesh. When you call the integration's `broadcast_channel_message`
service to send, it transmits the message but never reports it back to HA's
event bus or logbook. So the card has no server-side signal to display, and
falls back to an in-memory echo for UX.

This is a known gap in the upstream integration. See issue
[#59 "Show messages sent from HA in logbook"](https://github.com/meshtastic/home-assistant/issues/59).
The maintainer has agreed it should be fixed; no PR has landed at the time of
writing.

For reference, the [Meshcore Home Assistant
integration](https://meshcore-dev.github.io/meshcore-ha/docs/ha/messaging/)
already handles this on the backend — sent messages from HA appear in its
logbook automatically. That's the model the Meshtastic integration would
adopt.

## Workarounds

- If you want a running history of your own sends within a session, **keep
  the dashboard tab open** — the echo accumulates until reload.
- For persistent proof-of-send, rely on a **receiving node's logs**: any node
  that picked up your transmission will log it normally via the integration.
- **Subscribe** to [meshtastic/home-assistant#59](https://github.com/meshtastic/home-assistant/issues/59)
  to follow progress on a real backend fix. Once the integration fires
  `meshtastic_message_log` (or writes a logbook entry) for outbound messages,
  sent messages will persist across reloads automatically with no further
  card change required.

## See also

- [Home Assistant Logbook integration](https://www.home-assistant.io/integrations/logbook/)
- [Meshtastic HA integration repo](https://github.com/meshtastic/home-assistant)
- [Meshtastic HA integration issue #59 — outbound message logbook](https://github.com/meshtastic/home-assistant/issues/59)
- [Meshcore HA messaging docs (reference implementation that logs outbound)](https://meshcore-dev.github.io/meshcore-ha/docs/ha/messaging/)
