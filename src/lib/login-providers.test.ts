import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";

const provider = {
    id: "ls-login",
    name: "LS Login",
    logo: "/ls-login.svg",
    issuer: "https://login.example.org/oidc/",
    clientId: "client",
    clientSecret: "secret",
};
const redirectUri = "https://app.example.org/auth/api/callback";

// the settings are read once per module instance
async function load(env: Record<string, string | undefined> = {}) {
    vi.resetModules();
    const settings = {
        LOGIN_PROVIDERS: JSON.stringify([provider]),
        LOGIN_REDIRECT_URI: redirectUri,
        ...env,
    };
    for (const [name, value] of Object.entries(settings))
        vi.stubEnv(name, value);
    return import("./login-providers");
}

describe("loginSettings", () => {
    it("reads the providers, with defaults", async () => {
        const { loginSettings, loginProvider, loginProviderInfos } =
            await load();
        const settings = loginSettings();
        expect(settings.redirectUri).toBe(redirectUri);
        expect(settings.providers[0]).toMatchObject({
            issuer: "https://login.example.org/oidc",
            scopes: ["openid", "profile", "email"],
        });
        expect(loginSettings()).toBe(settings);
        expect(loginProviderInfos()).toEqual([
            { id: "ls-login", name: "LS Login", logo: "/ls-login.svg" },
        ]);
        expect(loginProvider()?.id).toBe("ls-login");
        expect(loginProvider("ls-login")?.id).toBe("ls-login");
        expect(loginProvider("other")).toBeUndefined();
    });

    it("needs an ID to choose among several providers", async () => {
        const { loginProvider } = await load({
            LOGIN_PROVIDERS: JSON.stringify([
                provider,
                { ...provider, id: "other" },
            ]),
        });
        expect(loginProvider()).toBeUndefined();
        expect(loginProvider("other")?.id).toBe("other");
    });

    it.each([
        ["missing providers", { LOGIN_PROVIDERS: undefined }, /at least one/],
        ["invalid JSON", { LOGIN_PROVIDERS: "[" }, /not valid JSON/],
        [
            "duplicate IDs",
            { LOGIN_PROVIDERS: JSON.stringify([provider, provider]) },
            /must be unique/,
        ],
        [
            "an invalid ID",
            { LOGIN_PROVIDERS: JSON.stringify([{ ...provider, id: "LS" }]) },
            /a-z, 0-9/,
        ],
        [
            "scopes without openid",
            {
                LOGIN_PROVIDERS: JSON.stringify([
                    { ...provider, scopes: ["email"] },
                ]),
            },
            /openid scope/,
        ],
        ["no redirect URI", { LOGIN_REDIRECT_URI: undefined }, /callback/],
        [
            "old variables only",
            {
                LOGIN_PROVIDERS: undefined,
                OIDC_CLIENT_ID: "c",
                LS_LOGIN_URL: "https://login.example.org",
            },
            /no longer reads LS_LOGIN_URL, OIDC_CLIENT_ID/,
        ],
        [
            "old variables only, with where the docs explain them",
            {
                LOGIN_PROVIDERS: undefined,
                OIDC_CLIENT_ID: "c",
            },
            "https://cloud-registry-ui.readthedocs.io/en/latest/operator-guide/upgrading/",
        ],
    ])("rejects %s", async (_, env, message) => {
        const { loginSettings } = await load(env);
        expect(loginSettings).toThrow(message);
    });

    it("ignores old variables next to LOGIN_PROVIDERS", async () => {
        const { loginSettings } = await load({ OIDC_CLIENT_ID: "c" });
        expect(loginSettings).not.toThrow();
    });
});

describe("loginSettingsAtBuild", () => {
    const sensitive = "[SENSITIVE]";

    it("checks readable settings fully", async () => {
        expect((await load()).loginSettingsAtBuild).not.toThrow();
        expect(
            (await load({ LOGIN_PROVIDERS: "" })).loginSettingsAtBuild,
        ).toThrow(/at least one/);
    });

    it("only checks that sensitive settings are set", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const both = await load({
            LOGIN_PROVIDERS: sensitive,
            LOGIN_REDIRECT_URI: sensitive,
        });
        expect(both.loginSettingsAtBuild).not.toThrow();
        expect(warn).toHaveBeenCalledWith(
            expect.stringMatching(/LOGIN_PROVIDERS, LOGIN_REDIRECT_URI/),
        );
        const providers = await load({ LOGIN_PROVIDERS: sensitive });
        expect(providers.loginSettingsAtBuild).not.toThrow();
    });

    it("checks the readable setting next to a sensitive one", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        for (const env of [
            { LOGIN_PROVIDERS: sensitive, LOGIN_REDIRECT_URI: "nope" },
            { LOGIN_PROVIDERS: sensitive, LOGIN_REDIRECT_URI: undefined },
            { LOGIN_PROVIDERS: "[]", LOGIN_REDIRECT_URI: sensitive },
        ])
            expect((await load(env)).loginSettingsAtBuild).toThrow(
                /Invalid login settings/,
            );
    });

    it("names old variables before the placeholders", async () => {
        const { loginSettingsAtBuild } = await load({
            LOGIN_PROVIDERS: undefined,
            LOGIN_REDIRECT_URI: sensitive,
            OIDC_CLIENT_SECRET: sensitive,
        });
        expect(loginSettingsAtBuild).toThrow(
            /no longer reads OIDC_CLIENT_SECRET/,
        );
    });
});

describe("oidcEndpoints", () => {
    const discovery = {
        issuer: "https://login.example.org/oidc/",
        authorization_endpoint: "https://login.example.org/oidc/authorize",
        token_endpoint: "https://login.example.org/oidc/token",
        userinfo_endpoint: "https://login.example.org/oidc/userinfo",
    };

    it("discovers and caches the endpoints", async () => {
        const { oidcEndpoints, loginSettings } = await load();
        const get = vi
            .spyOn(axios, "get")
            .mockResolvedValue({ data: discovery });
        const ls = loginSettings().providers[0];
        // the issuer as discovered, for the check of responses (RFC 9207)
        expect(await oidcEndpoints(ls)).toEqual({
            ...discovery,
            issParameterSupported: false,
        });
        await oidcEndpoints(ls);
        expect(get).toHaveBeenCalledOnce();
        expect(get).toHaveBeenCalledWith(
            "https://login.example.org/oidc/.well-known/openid-configuration",
            { timeout: 10000 },
        );
    });

    it.each([
        [true, true],
        ["true", true],
        [false, false],
        ["false", false],
        ["yes", false],
    ])(
        "takes %j for whether the provider sends its issuer as %s",
        async (value, supported) => {
            const { oidcEndpoints, loginSettings } = await load();
            vi.spyOn(axios, "get").mockResolvedValue({
                data: {
                    ...discovery,
                    authorization_response_iss_parameter_supported: value,
                },
            });
            const ls = loginSettings().providers[0];
            expect((await oidcEndpoints(ls)).issParameterSupported).toBe(
                supported,
            );
        },
    );

    it.each([
        [
            "another issuer",
            { issuer: "https://evil.example.org" },
            /Unexpected issuer/,
        ],
        ["no issuer", { issuer: undefined }, /Unexpected issuer/],
        ["a missing endpoint", { token_endpoint: "" }, /Incomplete/],
        [
            "a malformed endpoint",
            { userinfo_endpoint: "not a URL" },
            /Malformed/,
        ],
    ])(
        "rejects %s, and fetches again next time",
        async (_, change, message) => {
            const { oidcEndpoints, loginSettings } = await load();
            const get = vi
                .spyOn(axios, "get")
                .mockResolvedValueOnce({ data: { ...discovery, ...change } })
                .mockResolvedValueOnce({ data: discovery });
            const ls = loginSettings().providers[0];
            await expect(oidcEndpoints(ls)).rejects.toThrow(message);
            await expect(oidcEndpoints(ls)).resolves.toBeDefined();
            expect(get).toHaveBeenCalledTimes(2);
        },
    );
});

describe("loginErrorSummary", () => {
    const config = {
        method: "post",
        url: "https://user:pw@login.example.org/oidc/token?code=abc#x",
        data: "client_secret=secret",
        headers: {},
    } as unknown as InternalAxiosRequestConfig;
    const response = (data: unknown) =>
        ({ status: 400, data, statusText: "", headers: {}, config }) as never;

    it("names method, URL, status and OAuth error, without secrets", async () => {
        const { loginErrorSummary } = await load();
        const err = new AxiosError(
            "x",
            "E",
            config,
            {},
            response({
                error: "invalid_grant",
                error_description: "code abc for secret",
            }),
        );
        const summary = loginErrorSummary(err);
        expect(summary).toBe(
            "POST https://login.example.org/oidc/token failed: status 400, error invalid_grant",
        );
        expect(summary).not.toMatch(/secret|abc|pw/);
    });

    it("leaves out error codes that aren't OAuth codes", async () => {
        const { loginErrorSummary } = await load();
        const err = new AxiosError(
            "x",
            "E",
            config,
            {},
            response({
                error: "Secret: s3cr3t",
            }),
        );
        expect(loginErrorSummary(err)).toBe(
            "POST https://login.example.org/oidc/token failed: status 400",
        );
    });

    it("describes requests without a response and other errors", async () => {
        const { loginErrorSummary } = await load();
        expect(
            loginErrorSummary(
                new AxiosError("timeout of 10000ms exceeded", "ECONNABORTED", {
                    headers: {},
                } as InternalAxiosRequestConfig),
            ),
        ).toBe("Request unknown URL failed: timeout of 10000ms exceeded");
        expect(loginErrorSummary(new Error("line\nbreak"))).toBe("line break");
        expect(loginErrorSummary("x".repeat(400))).toHaveLength(300);
    });
});
