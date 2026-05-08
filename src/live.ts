import { type HomeAssistant } from './ha-types';
import { MESHTASTIC_MESSAGE_LOG_EVENT, type ChatMessage, type MeshtasticMessageLogEvent } from './types';

export type Unsubscribe = () => void;

// Subscribe to the `meshtastic_message_log` event bus and call `cb` for every
// event whose entity_id matches `entityId`. Returns an unsubscribe function.
export const subscribeMessageLog = async (
  hass: HomeAssistant,
  entityId: string,
  cb: (msg: ChatMessage) => void,
): Promise<Unsubscribe> => {
  let counter = 0;
  const unsub = await hass.connection.subscribeEvents<MeshtasticMessageLogEvent>((event) => {
    const data = event.data;
    if (data.entity_id !== entityId) return;

    const time = event.time_fired ?? new Date().toISOString();
    const id = event.context?.id ?? `live-${time}-${String(counter++)}`;

    cb({
      id,
      time,
      fromName: data.from_name,
      message: data.message,
      pki: Boolean(data.pki),
      source: 'live',
    });
  }, MESHTASTIC_MESSAGE_LOG_EVENT);

  return () => {
    try {
      void unsub();
    } catch {
      // ignore — connection may already be torn down
    }
  };
};
