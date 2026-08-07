import { EventEmitter } from "node:events";

/**
 * Crisis chat stream — Server-Sent Events (SSE) for real-time
 * chat message notifications to connected clients.
 *
 * Same in-process EventEmitter pattern as criticalIncidentStream.ts.
 * Single-instance limitation accepted for demo deployment.
 */

export type CrisisChatEvent = {
  id: string;
  crisisEventId: string;
  senderId: string;
  senderName: string;
  senderTrustTier: string;
  senderRole: string;
  content: string;
  createdAt: string;
};

type Listener = (event: CrisisChatEvent) => void;

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export function publishCrisisChatMessage(event: CrisisChatEvent): void {
  try {
    emitter.emit(`crisis-chat:${event.crisisEventId}`, event);
  } catch (err) {
    console.error("[crisisChatStream] Listener error during publish:", err);
  }
}

export function subscribeToCrisisChat(crisisEventId: string, listener: Listener): () => void {
  const channel = `crisis-chat:${crisisEventId}`;
  const wrapped = (event: CrisisChatEvent) => {
    try {
      listener(event);
    } catch (err) {
      console.error("[crisisChatStream] Listener error:", err);
    }
  };
  emitter.on(channel, wrapped);
  return () => {
    emitter.off(channel, wrapped);
  };
}
