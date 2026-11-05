import { describe, expect, it } from "vitest";
import { isLocalHost, isSecureUrl } from "./secure-urls";

describe("isLocalHost", () => {
    it.each(["localhost", "oidc.localhost", "127.0.0.1", "127.1.2.3", "[::1]"])(
        "takes %s as the local machine",
        (hostname) => {
            expect(isLocalHost(hostname)).toBe(true);
        },
    );

    it.each(["localhost.example.org", "example.org", "128.0.0.1", "[::2]"])(
        "takes %s as another machine",
        (hostname) => {
            expect(isLocalHost(hostname)).toBe(false);
        },
    );
});

describe("isSecureUrl", () => {
    it.each([
        "https://login.example.org/oidc",
        "HTTPS://login.example.org",
        "http://localhost:8190/oidc",
        "http://oidc.localhost:8190/oidc",
        "http://127.0.0.1/oidc",
        "http://[::1]:8190/oidc",
    ])("accepts %s", (url) => {
        expect(isSecureUrl(url)).toBe(true);
    });

    it.each([
        "http://login.example.org/oidc",
        "http://localhost.example.org/oidc",
        "ftp://login.example.org/oidc",
        "javascript:alert(1)",
        "/oidc/token",
        "not a URL",
    ])("rejects %s", (url) => {
        expect(isSecureUrl(url)).toBe(false);
    });
});
