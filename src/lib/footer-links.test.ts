import { beforeEach, describe, expect, it, vi } from "vitest";

const name = "NEXT_PUBLIC_FOOTER_LINKS";

// settings of the test process must not leak into the tests
async function load() {
    vi.resetModules();
    return import("./footer-links");
}

beforeEach(() => {
    vi.stubEnv(name, undefined);
});

describe("parseFooterLinks", () => {
    it.each([undefined, "", " ", "[]"])(
        "has no links for %j",
        async (value) => {
            const { parseFooterLinks } = await load();
            expect(parseFooterLinks(value)).toEqual({ links: [] });
        },
    );

    it("reads links of all kinds", async () => {
        const { parseFooterLinks } = await load();
        const links = [
            { label: "Privacy notice", url: "https://example.org/privacy" },
            { label: "Imprint", url: "/imprint.html" },
            { label: "Contact", url: "mailto:support@example.org" },
            { label: "Local", url: "http://localhost:8000/terms" },
        ];
        expect(parseFooterLinks(JSON.stringify(links))).toEqual({ links });
    });

    it("trims labels", async () => {
        const { parseFooterLinks } = await load();
        expect(
            parseFooterLinks('[{"label": " Imprint ", "url": "/imprint"}]'),
        ).toEqual({ links: [{ label: "Imprint", url: "/imprint" }] });
    });

    it("refuses text that isn't JSON", async () => {
        const { parseFooterLinks } = await load();
        expect(parseFooterLinks("[{label: x}]").error).toBe(
            "it is not valid JSON",
        );
    });

    it.each(['{"label": "x", "url": "/x"}', '"x"', "null"])(
        "refuses %s, which isn't a list",
        async (value) => {
            const { parseFooterLinks } = await load();
            expect(parseFooterLinks(value).error).toBe(
                "it must be a JSON list of links",
            );
        },
    );

    it("refuses more than 12 links", async () => {
        const { parseFooterLinks } = await load();
        const links = Array.from({ length: 13 }, (_, i) => ({
            label: `Link ${i}`,
            url: `/link-${i}`,
        }));
        expect(parseFooterLinks(JSON.stringify(links)).error).toBe(
            "it has 13 links; at most 12 are allowed",
        );
        expect(
            parseFooterLinks(JSON.stringify(links.slice(1))).error,
        ).toBeUndefined();
    });

    it.each([
        ["[null]", "link 1 must be an object with label and url"],
        ['["/x"]', "link 1 must be an object with label and url"],
        ['[{"url": "/x"}]', "link 1 needs a label"],
        ['[{"label": " ", "url": "/x"}]', "link 1 needs a label"],
        ['[{"label": 1, "url": "/x"}]', "link 1 needs a label"],
        ['[{"label": "x"}]', 'link 1 ("x") needs a url'],
        [
            '[{"label": "x", "url": "/x", "href": "/y"}]',
            'link 1 ("x") has the unknown key "href"; use label and url only',
        ],
    ])("refuses %s", async (value, error) => {
        const { parseFooterLinks } = await load();
        expect(parseFooterLinks(value).error).toBe(error);
    });

    it("refuses labels of more than 60 characters", async () => {
        const { parseFooterLinks } = await load();
        const label = "é".repeat(61);
        expect(
            parseFooterLinks(JSON.stringify([{ label, url: "/x" }])).error,
        ).toBe("link 1 has a label of 61 characters; at most 60 are allowed");
        expect(
            parseFooterLinks(
                JSON.stringify([{ label: label.slice(1), url: "/x" }]),
            ).error,
        ).toBeUndefined();
    });

    it.each([
        "http://example.org/privacy",
        "javascript:alert(1)",
        "data:text/html,x",
        "ftp://example.org/terms",
        "//example.org/privacy",
        "/\\example.org/privacy",
        "/\t/example.org/privacy",
        "/privacy notice",
        "privacy.html",
        "mailto:",
        "https://",
        "",
    ])("refuses the url %j", async (url) => {
        const { parseFooterLinks } = await load();
        expect(
            parseFooterLinks(JSON.stringify([{ label: "Privacy", url }])).error,
        ).toBe(
            'link 1 ("Privacy") has an invalid url: use an https URL, a mailto: address or a path of the app starting with /',
        );
    });

    it("names the first invalid link", async () => {
        const { parseFooterLinks } = await load();
        const links = [
            { label: "Imprint", url: "/imprint" },
            { label: "Privacy", url: "http://example.org" },
        ];
        expect(parseFooterLinks(JSON.stringify(links)).error).toMatch(
            /^link 2 \("Privacy"\)/,
        );
    });
});

describe("footerLinks", () => {
    it("has no links by default", async () => {
        const { footerLinks } = await load();
        expect(footerLinks()).toEqual([]);
    });

    it("reads the setting when called", async () => {
        const { footerLinks } = await load();
        vi.stubEnv(name, '[{"label": "Imprint", "url": "/imprint"}]');
        expect(footerLinks()).toEqual([{ label: "Imprint", url: "/imprint" }]);
    });

    it("has no links for invalid settings", async () => {
        const { footerLinks } = await load();
        vi.stubEnv(name, "not JSON");
        expect(footerLinks()).toEqual([]);
    });
});

describe("isExternalLink", () => {
    it.each([
        ["https://example.org/privacy", true],
        ["http://localhost:8000/terms", true],
        ["/imprint", false],
        ["mailto:support@example.org", false],
    ])("tells for %s", async (url, external) => {
        const { isExternalLink } = await load();
        expect(isExternalLink(url)).toBe(external);
    });
});

describe("footerSettings", () => {
    it("accepts no setting", async () => {
        const { footerSettings } = await load();
        expect(footerSettings).not.toThrow();
    });

    it("accepts valid links", async () => {
        vi.stubEnv(name, '[{"label": "Imprint", "url": "/imprint"}]');
        const { footerSettings } = await load();
        expect(footerSettings).not.toThrow();
    });

    it("names the setting and the problem", async () => {
        vi.stubEnv(name, '[{"label": "Imprint"}]');
        const { footerSettings } = await load();
        expect(footerSettings).toThrow(
            'Invalid setting NEXT_PUBLIC_FOOTER_LINKS: link 1 ("Imprint") needs a url',
        );
    });
});
