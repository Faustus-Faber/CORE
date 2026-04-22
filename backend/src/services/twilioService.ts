import { triggerDispatchAlertsForCrisis } from "./dispatchAlertService.js";

/**
 * Backward-compatible shim.
 * Module 3.3 now dispatches alerts over email via Resend.
 */
export async function triggerAlertsForCrisis(crisisEventId: string) {
  await triggerDispatchAlertsForCrisis(crisisEventId);
}
