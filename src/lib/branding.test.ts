import { describe, expect, it, vi } from "vitest";

// the settings are read when the module loads
async function load(env: Record<string, string | undefined> = {}) {
    vi.resetModules();
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    return import("./branding");
}

describe("branding settings", () => {
    it("has defaults", async () => {
        const branding = await load({
            NEXT_PUBLIC_APP_TITLE: " ",
            NEXT_PUBLIC_APP_TITLE_SIZE: "x",
            NEXT_PUBLIC_FOOTER_START_YEAR: "-1",
        });
        expect(branding.appTitle).toBe("Cloud Registry");
        expect(branding.appTitleLines).toEqual(["Cloud Registry"]);
        expect(branding.appTitleSize).toBeUndefined();
        expect(branding.appTitleFont).toBeUndefined();
        expect(branding.appLogo).toEqual({
            light: "/elixir-on-cloud-mark.svg",
            dark: "/elixir-on-cloud-mark-night.svg",
        });
        expect(branding.footerLogo).toEqual({
            light: "/elixir-on-cloud-lockup.svg",
            dark: "/elixir-on-cloud-lockup-night.svg",
        });
        expect(branding.copyright(2026)).toBe("© 2026");
        expect(branding.copyright()).toBe("");
        expect(() => branding.brandingSettings()).not.toThrow();
    });

    it("uses the settings", async () => {
        const branding = await load({
            NEXT_PUBLIC_APP_TITLE: "ELIXIR Cloud Service Registry",
            NEXT_PUBLIC_APP_TITLE_SIZE: "20",
            NEXT_PUBLIC_APP_TITLE_FONT: "Inter",
            NEXT_PUBLIC_APP_LOGO: "/logo.svg",
            NEXT_PUBLIC_FOOTER_LOGO: "/footer.svg",
            NEXT_PUBLIC_FOOTER_LOGO_DARK: "/footer-dark.svg",
            NEXT_PUBLIC_FOOTER_START_YEAR: "2024",
        });
        expect(branding.appTitleLines).toEqual([
            "ELIXIR Cloud Service",
            "Registry",
        ]);
        expect(branding.appTitleSize).toBe(20);
        expect(branding.appTitleFont).toBe("Inter");
        // a custom logo without a dark one is used in both schemes
        expect(branding.appLogo).toEqual({
            light: "/logo.svg",
            dark: undefined,
        });
        expect(branding.footerLogo).toEqual({
            light: "/footer.svg",
            dark: "/footer-dark.svg",
        });
        expect(branding.copyright(2026)).toBe("© 2024 – 2026");
        expect(branding.copyright(2024)).toBe("© 2024");
        expect(branding.copyright()).toBe("© 2024");
    });

    it("uses a custom footer logo in both schemes", async () => {
        const { footerLogo } = await load({
            NEXT_PUBLIC_FOOTER_LOGO: "/f.svg",
        });
        expect(footerLogo).toEqual({ light: "/f.svg", dark: undefined });
    });

    it("keeps the default light logo with only a dark one", async () => {
        const { appLogo, footerLogo } = await load({
            NEXT_PUBLIC_APP_LOGO_DARK: "/d.svg",
            NEXT_PUBLIC_FOOTER_LOGO_DARK: "/fd.svg",
        });
        expect(appLogo).toEqual({
            light: "/elixir-on-cloud-mark.svg",
            dark: "/d.svg",
        });
        expect(footerLogo).toEqual({
            light: "/elixir-on-cloud-lockup.svg",
            dark: "/fd.svg",
        });
    });

    it.each([
        [
            "a word longer than a line",
            "Supercalifragilisticexpialidocious",
            /has 34 characters/,
        ],
        [
            "more than two lines",
            "one two three four five six seven eight nine ten eleven",
            /needs 3 lines/,
        ],
    ])("rejects %s", async (_, title, message) => {
        const { brandingSettings } = await load({
            NEXT_PUBLIC_APP_TITLE: title,
        });
        expect(() => brandingSettings()).toThrow(message);
    });
});

describe("breakTitle", () => {
    it("counts characters, not code units", async () => {
        const { breakTitle } = await load();
        expect(breakTitle(`${"😀".repeat(24)} x`)).toEqual({
            lines: ["😀".repeat(24), "x"],
        });
    });
});
