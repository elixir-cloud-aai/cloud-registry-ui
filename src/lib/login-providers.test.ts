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

    it.each([
        "http://localhost:8190/oidc",
        "http://oidc.localhost:8190/oidc",
        "http://127.0.0.1/oidc",
    ])("accepts an http issuer on the local machine (%s)", async (issuer) => {
        const { loginSettings } = await load({
            LOGIN_PROVIDERS: JSON.stringify([{ ...provider, issuer }]),
        });
        expect(loginSettings().providers[0].issuer).toBe(issuer);
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
        [
            "an http issuer",
            {
                LOGIN_PROVIDERS: JSON.stringify([
                    { ...provider, issuer: "http://login.example.org/oidc" },
                ]),
            },
            /Use an https URL \(http only for localhost\)\n.*providers\[0\]\.issuer/,
        ],
        [
            "an issuer of another scheme",
            {
                LOGIN_PROVIDERS: JSON.stringify([
                    { ...provider, issuer: "ftp://login.example.org/oidc" },
                ]),
            },
            /https URL/,
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

    it("ignores old variables next to LOGIN_PROVIDERS, with a warning", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { loginSettings } = await load({
            LS_LOGIN_URL: "https://login.example.org",
            OIDC_CLIENT_SECRET: "old-secret",
        });
        expect(loginSettings).not.toThrow();
        expect(warn).toHaveBeenCalledTimes(2);
        for (const name of ["LS_LOGIN_URL", "OIDC_CLIENT_SECRET"])
            expect(warn).toHaveBeenCalledWith(
                `Ignoring setting ${name}: the app reads LOGIN_PROVIDERS and LOGIN_REDIRECT_URI instead. Remove the setting.`,
            );
        // never the values
        expect(warn.mock.calls.join(" ")).not.toMatch(
            /old-secret|login\.example/,
        );
    });

    it("warns of nothing without old variables", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { loginSettings } = await load();
        loginSettings();
        expect(warn).not.toHaveBeenCalled();
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

    it("warns of old variables once", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(
            (await load({ OIDC_CLIENT_ID: "c" })).loginSettingsAtBuild,
        ).not.toThrow();
        expect(warn).toHaveBeenCalledOnce();
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

    it("warns of old variables next to sensitive settings", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { loginSettingsAtBuild } = await load({
            LOGIN_PROVIDERS: sensitive,
            OIDC_CLIENT_ID: "c",
        });
        expect(loginSettingsAtBuild).not.toThrow();
        expect(warn).toHaveBeenCalledTimes(2);
        expect(warn).toHaveBeenCalledWith(
            expect.stringMatching(/^Ignoring setting OIDC_CLIENT_ID:/),
        );
        expect(warn).toHaveBeenCalledWith(
            expect.stringMatching(/^Can't check LOGIN_PROVIDERS/),
        );
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
        const info = vi.spyOn(console, "info").mockImplementation(() => {});
        const { oidcEndpoints, loginSettings } = await load();
        const get = vi
            .spyOn(axios, "get")
            .mockResolvedValue({ data: discovery });
        const ls = loginSettings().providers[0];
        // the issuer as discovered, for the check of responses (RFC 9207)
        expect(await oidcEndpoints(ls)).toEqual({
            ...discovery,
            end_session_endpoint: undefined,
            issParameterSupported: false,
            tokenAuthMethod: "client_secret_basic",
        });
        await oidcEndpoints(ls);
        expect(get).toHaveBeenCalledOnce();
        // once, with the issuer as the registry must spell it
        expect(info).toHaveBeenCalledOnce();
        expect(info).toHaveBeenCalledWith(
            expect.stringContaining(
                "Login provider ls-login: issuer https://login.example.org/oidc/ ",
            ),
        );
        expect(get).toHaveBeenCalledWith(
            "https://login.example.org/oidc/.well-known/openid-configuration",
            { timeout: 10000 },
        );
    });

    it("discovers the end session endpoint", async () => {
        const { oidcEndpoints, loginSettings } = await load();
        const endpoint = "https://login.example.org/oidc/logout";
        vi.spyOn(axios, "get").mockResolvedValue({
            data: { ...discovery, end_session_endpoint: endpoint },
        });
        const ls = loginSettings().providers[0];
        expect((await oidcEndpoints(ls)).end_session_endpoint).toBe(endpoint);
    });

    it("takes an empty end session endpoint as none", async () => {
        const { oidcEndpoints, loginSettings } = await load();
        vi.spyOn(axios, "get").mockResolvedValue({
            data: { ...discovery, end_session_endpoint: "" },
        });
        const ls = loginSettings().providers[0];
        expect((await oidcEndpoints(ls)).end_session_endpoint).toBeUndefined();
    });

    it.each([
        [undefined, "client_secret_basic"],
        [["client_secret_basic"], "client_secret_basic"],
        [["private_key_jwt"], "client_secret_basic"],
        ["client_secret_post", "client_secret_basic"],
        [["client_secret_post"], "client_secret_post"],
        [["client_secret_basic", "client_secret_post"], "client_secret_post"],
    ])("takes the token auth methods %j as %s", async (methods, method) => {
        const { oidcEndpoints, loginSettings } = await load();
        vi.spyOn(axios, "get").mockResolvedValue({
            data: {
                ...discovery,
                token_endpoint_auth_methods_supported: methods,
            },
        });
        const ls = loginSettings().providers[0];
        expect((await oidcEndpoints(ls)).tokenAuthMethod).toBe(method);
    });

    it("accepts http endpoints of an issuer on the local machine", async () => {
        const issuer = "http://oidc.localhost:8190/oidc";
        const { oidcEndpoints, loginSettings } = await load({
            LOGIN_PROVIDERS: JSON.stringify([{ ...provider, issuer }]),
        });
        vi.spyOn(axios, "get").mockResolvedValue({
            data: {
                issuer,
                authorization_endpoint: `${issuer}/authorize`,
                token_endpoint: `${issuer}/token`,
                userinfo_endpoint: `${issuer}/userinfo`,
                end_session_endpoint: `${issuer}/endsession`,
            },
        });
        const ls = loginSettings().providers[0];
        expect((await oidcEndpoints(ls)).token_endpoint).toBe(
            `${issuer}/token`,
        );
    });

    it("logs long issuers in full", async () => {
        const info = vi.spyOn(console, "info").mockImplementation(() => {});
        const issuer = `https://login.example.org/${"a".repeat(300)}/`;
        const { oidcEndpoints, loginSettings } = await load({
            LOGIN_PROVIDERS: JSON.stringify([{ ...provider, issuer }]),
        });
        vi.spyOn(axios, "get").mockResolvedValue({
            data: { ...discovery, issuer },
        });
        await oidcEndpoints(loginSettings().providers[0]);
        expect(info).toHaveBeenCalledWith(
            expect.stringContaining(`issuer ${issuer} `),
        );
    });

    it.each([
        ["credentials", "https://user:pass@login.example.org/oidc/"],
        ["a query", "https://login.example.org/oidc/?key=secret"],
        ["a fragment", "https://login.example.org/oidc/#secret"],
    ])("doesn't log issuers with %s", async (_, issuer) => {
        const info = vi.spyOn(console, "info").mockImplementation(() => {});
        const { oidcEndpoints, loginSettings } = await load({
            LOGIN_PROVIDERS: JSON.stringify([{ ...provider, issuer }]),
        });
        vi.spyOn(axios, "get").mockResolvedValue({
            data: { ...discovery, issuer },
        });
        await oidcEndpoints(loginSettings().providers[0]);
        expect(info).toHaveBeenCalledOnce();
        expect(info).toHaveBeenCalledWith(
            expect.stringContaining(
                "Login provider ls-login: issuer not logged",
            ),
        );
        expect(info.mock.calls.join(" ")).not.toMatch(/pass|secret/);
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
        [
            "a malformed end session endpoint",
            { end_session_endpoint: "not a URL" },
            /Malformed/,
        ],
        [
            "an http token endpoint",
            { token_endpoint: "http://login.example.org/oidc/token" },
            /aren't https/,
        ],
        [
            "an http authorization endpoint",
            { authorization_endpoint: "http://login.example.org/oidc/auth" },
            /aren't https/,
        ],
        [
            "an http user info endpoint",
            { userinfo_endpoint: "http://login.example.org/oidc/userinfo" },
            /aren't https/,
        ],
        [
            "an end session endpoint of another scheme",
            { end_session_endpoint: "javascript:alert(1)" },
            /aren't https/,
        ],
        [
            "an http end session endpoint",
            { end_session_endpoint: "http://login.example.org/oidc/logout" },
            /aren't https/,
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
