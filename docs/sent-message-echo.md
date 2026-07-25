# Sent messages: how your own messages appear in the log

When you send a message via the card's composer, it appears in the chat log
immediately as **`You: …`**, styled with an accent bar to mark it as yours.

That row starts out **optimistic** — rendered before Home Assistant has finished
sending, so you get instant feedback rather than waiting on the mesh. It is
shown dimmed while it is unconfirmed. Once the integration reports the message
back, the row is reconciled into the real, recorded entry.

Sent messages **persist**: they survive reloads, appear in other browser tabs
and on other devices, show up in Home Assistant's
[Logbook](https://www.home-assistant.io/integrations/logbook/), and are written
to the recorder database — the same as messages received off the mesh.

## Requirements

This needs an integration that reports outbound messages. Home Assistant's
Meshtastic integration historically did **not** — see upstream issue
[#59 "Show messages sent from HA in logbook"](https://github.com/meshtastic/home-assistant/issues/59).

Against an integration that does not report them, the card degrades gracefully:
the optimistic `You: …` row still appears for instant feedback, but it is
in-memory only. It disappears on reload, is invisible in other tabs and on other
devices, and never reaches the Logbook or the recorder. Other mesh nodes still
receive your message normally either way — the transmission is unaffected.

## How it works

The card reads history from Home Assistant's logbook (`logbook/get_events`) and
live updates from the `meshtastic_message_log` event on the HA event bus. For
outbound messages the integration fires that same event with two extra fields:

| Field       | Value                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- |
| `direction` | `"out"` for messages Home Assistant sent, `"in"` for received. Absent means received. |
| `to_name`   | Who it went to: the channel name, or the peer node for a direct message.              |

The matching logbook entry encodes the direction in its verb, because a logbook
row carries no event type:

```
«on my way» to Channel Primary     ← sent by Home Assistant
«dinner?» by Kitchen Node (!a1b2)  ← received off the mesh
```

The icon keeps meaning encryption, not direction: `mdi:message-lock` for direct
messages, `mdi:message-arrow-right` for an outbound broadcast, `mdi:message` for
an inbound one.

### Why you only ever see one row

The card would otherwise show your message twice — once as its own optimistic
echo, once as the real event. It avoids that without any guesswork by keying on
Home Assistant's **context id**.

Sending is a service call, and Home Assistant gives every service call a
context. The integration passes that context through to the event it fires, so
the event, the recorded logbook row, and the `callService` response the card gets
back all carry the _same_ id. The card re-keys its optimistic row to that id, and
the ordinary de-duplication (which matches on id) collapses them into one row.

This works in either order. With `ack: true` the event usually arrives while the
service call is still in flight, in which case the real row wins and the
optimistic one is dropped; if the call resolves first, the optimistic row is
re-keyed and the event de-dupes against it.

## Limitations

- "Sent" means the packet was accepted by the radio, not that it was delivered.
  A message whose acknowledgement times out is still logged, because it was
  still transmitted.
- Messages sent from a phone app through the integration's raw TCP proxy bypass
  the reporting path and are not logged.

## See also

- [Home Assistant Logbook integration](https://www.home-assistant.io/integrations/logbook/)
- [Meshtastic HA integration repo](https://github.com/meshtastic/home-assistant)
- [Meshtastic HA integration issue #59 — outbound message logbook](https://github.com/meshtastic/home-assistant/issues/59)
