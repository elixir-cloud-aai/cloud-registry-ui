import { describe, expect, it } from "vitest";
import { loginHref, safeHref } from "./links";

describe("safeHref", () => {
    it.each([
        ["https://example.org/x", false, "https://example.org/x"],
        ["http://example.org", false, "http://example.org"],
        ["mailto:a@example.org", true, "mailto:a@example.org"],
        ["mailto:a@example.org", false, undefined],
        ["javascript:alert(1)", true, undefined],
        ["data:text/html,x", false, undefined],
        ["/relative", false, undefined],
        ["", false, undefined],
        [undefined, false, undefined],
    ])("%s (mail: %s)", (value, mail, href) => {
        expect(safeHref(value, mail)).toBe(href);
    });
});

describe("loginHref", () => {
    it.each([
        [undefined, "/auth/login"],
        [null, "/auth/login"],
        ["", "/auth/login"],
        ["/dashboard/services", "/auth/login?next=%2Fdashboard%2Fservices"],
        ["/a?b=c&d", "/auth/login?next=%2Fa%3Fb%3Dc%26d"],
    ])("%s", (next, href) => {
        expect(loginHref(next)).toBe(href);
    });
});
