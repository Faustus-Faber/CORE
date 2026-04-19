import { EventEmitter } from "node:events";

export type CriticalIncidentEvent = {
  incidentId: string;
  latitude: number | null;
  longitude: number | null;
  occurredAt: string;
};

type Listener = (event: CriticalIncidentEvent) => void;

const CHANNEL = "critical-incident";
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export function publishCriticalIncident(event: CriticalIncidentEvent): void {
  emitter.emit(CHANNEL, event);
}

export function subscribeToCriticalIncidents(listener: Listener): () => void {
  emitter.on(CHANNEL, listener);
  return () => {
    emitter.off(CHANNEL, listener);
  };
}
