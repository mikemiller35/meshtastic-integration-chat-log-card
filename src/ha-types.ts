import type { Connection, HassEntity } from 'home-assistant-js-websocket';

export interface HomeAssistantDevice {
  name?: string;
  name_by_user?: string;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  connection: Connection;
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown>;

  // Optional bits we touch for channel/gateway display fallbacks.
  devices?: Record<string, HomeAssistantDevice>;
}
