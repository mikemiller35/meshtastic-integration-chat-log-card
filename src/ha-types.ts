import type { Connection, HassEntity } from 'home-assistant-js-websocket';

export interface HomeAssistantDevice {
  name?: string;
  name_by_user?: string;
}

// What Home Assistant resolves a `callService` call with. We only need the
// context, whose id lets us tie a message we sent to the log entry it produced.
// Every field is optional, and the result itself may be absent: we do not
// control what the frontend hands back, and treating a missing context as a
// failed send would be wrong.
export interface ServiceCallResult {
  context?: { id?: string; parent_id?: string | null; user_id?: string | null };
  response?: unknown;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  connection: Connection;
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<ServiceCallResult | undefined>;

  // Optional bits we touch for channel/gateway display fallbacks.
  devices?: Record<string, HomeAssistantDevice>;
}
