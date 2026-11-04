/**
 * @description zod for the app: import `z` from here, not from "zod", so
 * the settings below apply before any schema is built (Biome's
 * `noRestrictedImports` checks this). Only modules that `next.config.ts`
 * loads, which can't use the `@/` paths, import "zod" directly; they run on
 * the server only.
 */
import { z } from "zod";

// no `Function("")` probe for faster parsing: the Content Security Policy
// forbids `eval`, and browsers report the probe as a violation
z.config({ jitless: true });

export { z };
