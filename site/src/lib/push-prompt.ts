/** v0.56.0 (PLAN 31.2, push part 5a): the settings of the soft prompt card. Pure function, unit tested. */
import { pushConfig } from './push-client.js';

export interface PushPromptPlan { worker: string }

/** null while config/push.json is empty or wrong: then no card and no script is added to any page. */
export function pushPromptPlan(cfg: unknown): PushPromptPlan | null {
  return pushConfig(cfg).enabled ? { worker: '/push-sw.js' } : null;
}
