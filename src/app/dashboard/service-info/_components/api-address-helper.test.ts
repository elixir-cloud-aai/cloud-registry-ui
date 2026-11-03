import { describe, expect, it } from "vitest";
import { apiAddress } from "./api-address-helper";

const page = "https://app.example.org/dashboard/service-info";

describe("apiAddress", () => {
    it.each([
        // another host than the app
        [
            "https://registry.example.org/ga4gh/registry/v1",
            "https://registry.example.org/ga4gh/registry/v1",
        ],
        ["http://localhost:8180/x/", "http://localhost:8180/x"],
        // without trailing slashes, as the calls use it
        ["https://r.example.org", "https://r.example.org"],
        ["https://r.example.org/", "https://r.example.org"],
        // relative: where the browser's calls go
        ["/ga4gh/registry/v1", "https://app.example.org/ga4gh/registry/v1"],
        ["api/v1", "https://app.example.org/dashboard/api/v1"],
        // no "//": the browser takes it as a path of the app's own site
        ["https:api/v1", "https://app.example.org/dashboard/api/v1"],
        // the browser strips surrounding spaces
        [" https://r.example.org/x ", "https://r.example.org/x"],
        // credentials don't belong on the page
        ["https://user:secret@r.example.org/x", "https://r.example.org/x"],
    ])("%s", (setting, address) => {
        expect(apiAddress(setting, page)).toBe(address);
    });

    it.each([
        [undefined],
        [""],
        ["   "],
        // not an address to show or link to
        ["http://[invalid/x"],
        ["javascript:alert(1)"],
        ["ftp://registry.example.org/x"],
    ])("nothing for %s", (setting) => {
        expect(apiAddress(setting, page)).toBeUndefined();
    });
});
