import { describe, expect, it } from "vitest";
// biome-ignore lint/style/noRestrictedImports: compares the wrapper with zod
import { z as zod } from "zod";
import { z } from "./zod";

describe("zod for the app", () => {
    it("is zod, without the eval probe", () => {
        expect(z).toBe(zod);
        expect(z.config().jitless).toBe(true);
    });
});
