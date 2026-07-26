// Mirrors the wire formats produced by the upstream `meshtastic`
// Home Assistant integration (see custom_components/meshtastic/{const,logbook}.py).

// ---------------------------------------------------------------------------
// Card config
// ---------------------------------------------------------------------------

export interface ChatCardConfig {
  type?: string;
  title?: string;
  channel_entity: string;
  limit?: number;
  show_timestamps?: boolean;
  sort_order?: 'asc' | 'desc';
  enable_send?: boolean;
}

export const DEFAULT_LIMIT = 200;
export const DEFAULT_HISTORY_DAYS = 7;

// ---------------------------------------------------------------------------
// Normalised message used for rendering
// ---------------------------------------------------------------------------

export interface ChatMessage {
  // Stable id used as a Lit `repeat` key and for de-duping.
  id: string;
  // ISO timestamp string.
  time: string;
  fromName: string;
  message: string;
  pki: boolean;
  // True when this Home Assistant instance sent the message rather than
  // receiving it off the mesh.
  own: boolean;
  // Source of the message, useful for debugging.
  source: 'history' | 'live';
  // Set on an optimistic row that the backend has not confirmed yet.
  pending?: boolean;
}

// ---------------------------------------------------------------------------
// Meshtastic event payload (event type: `meshtastic_message_log`)
// ---------------------------------------------------------------------------

export const MESHTASTIC_MESSAGE_LOG_EVENT = 'meshtastic_message_log';

export type MessageDirection = 'in' | 'out';

export interface MeshtasticMessageLogData {
  entity_id: string;
  device_id?: string | null;
  from_name: string;
  message: string;
  pki?: boolean;
  // Absent on integrations that only log received messages, so treat a missing
  // direction as inbound.
  direction?: MessageDirection;
  // Recipient of an outbound message: the channel name, or the peer node for a DM.
  to_name?: string;
}

export interface MeshtasticMessageLogEvent {
  event_type: typeof MESHTASTIC_MESSAGE_LOG_EVENT;
  data: MeshtasticMessageLogData;
  origin?: string;
  time_fired?: string;
  context?: { id?: string; user_id?: string | null; parent_id?: string | null };
}

// ---------------------------------------------------------------------------
// Logbook WS response
// ---------------------------------------------------------------------------

// `logbook/get_events` returns an array of LogbookEntry. Only the fields we
// actually use are typed here.
export interface LogbookEntry {
  when: number | string; // seconds (float) since epoch, or ISO string in some HA versions
  name?: string;
  message?: string;
  entity_id?: string;
  domain?: string;
  icon?: string;
  context_id?: string;
}

// ---------------------------------------------------------------------------
// Channel discovery
// ---------------------------------------------------------------------------

export interface MeshtasticChannelStateAttrs {
  device_class?: string;
  friendly_name?: string;
  index?: number;
  node?: number | string;
  primary?: boolean;
  secondary?: boolean;
}
