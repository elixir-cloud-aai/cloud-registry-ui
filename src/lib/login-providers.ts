/**
 * @description login providers from `LOGIN_PROVIDERS` (a JSON list), read on
 * the server only, as they hold client secrets
 */
import axios from "axios";
import { z } from "zod";
import { isSecureUrl } from "./secure-urls";

const loginProviderSchema = z.object({
    id: z.string().regex(/^[a-z0-9-]+$/, "Use a-z, 0-9 and - only"),
    name: z.string().min(1),
    logo: z.string().min(1),
    // without a trailing slash, to compare it with the discovered one;
    // over TLS, as the client secret goes to its endpoints
    issuer: z
        .url()
        .refine(isSecureUrl, "Use an https URL (http only for localhost)")
        .transform((val) => val.replace(/\/$/, "")),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    scopes: z
        .array(z.string().min(1))
        .refine((val) => val.includes("openid"), "Include the openid scope")
        .default(["openid", "profile", "email"]),
});

const loginProvidersSchema = z
    .array(loginProviderSchema)
    .min(1, "Configure at least one login provider")
    .refine(
        (providers) =>
            new Set(providers.map((val) => val.id)).size === providers.length,
        "Login provider IDs must be unique",
    );

const loginSettingsSchema = z.object({
    providers: loginProvidersSchema,
    redirectUri: z.url({
        error: "Set to the URL of /auth/api/callback, e.g. https://registry.example.org/auth/api/callback",
    }),
});

type LoginProvider = z.infer<typeof loginProviderSchema>;

type LoginProviderInfo = Pick<LoginProvider, "id" | "name" | "logo">;

type OidcDiscovery = {
    issuer?: string;
    authorization_endpoint: string;
    token_endpoint: string;
    userinfo_endpoint: string;
    end_session_endpoint?: string;
    authorization_response_iss_parameter_supported?: boolean | string;
    token_endpoint_auth_methods_supported?: unknown;
};

/** @description how the app authenticates at the token endpoint */
type TokenAuthMethod = "client_secret_basic" | "client_secret_post";

type OidcEndpoints = {
    /** The issuer as discovered, which responses with `iss` must match */
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    userinfo_endpoint: string;
    /** Where to end the session at the provider (RP-Initiated Logout), if
     * the provider has one */
    end_session_endpoint?: string;
    /** Whether authorization responses have `iss` (RFC 9207) */
    issParameterSupported: boolean;
    tokenAuthMethod: TokenAuthMethod;
};

/** @description timeout of requests to login providers, in milliseconds */
const loginRequestTimeout = 10000;

// settings of earlier versions, which the app no longer reads (see
// `docs/operator-guide/upgrading.md`)
const legacySettings = [
    "LS_LOGIN_URL",
    "OIDC_CLIENT_ID",
    "OIDC_CLIENT_SECRET",
    "OIDC_REDIRECT_URI",
];
// what `vercel pull` writes for sensitive variables, which it can't read
const sensitivePlaceholder = "[SENSITIVE]";

let settings: z.infer<typeof loginSettingsSchema> | undefined;
const endpoints = new Map<string, Promise<OidcEndpoints>>();

/**
 * Read and check the login settings
 * @returns Providers and the redirect URI
 * @throws Error naming each invalid or missing setting
 */
function loginSettings() {
    if (settings) return settings;
    legacyLoginSettings();

    const result = loginSettingsSchema.safeParse({
        providers: providersJson(),
        redirectUri: process.env.LOGIN_REDIRECT_URI,
    });
    if (!result.success)
        throw new Error(
            `Invalid login settings (LOGIN_PROVIDERS, LOGIN_REDIRECT_URI):\n${z.prettifyError(result.error)}`,
        );

    settings = result.data;
    return settings;
}

/**
 * Read `LOGIN_PROVIDERS`
 * @returns Its value, parsed, or an empty list if it is unset or empty
 * @throws Error if it isn't JSON
 */
function providersJson(): unknown {
    try {
        return JSON.parse(process.env.LOGIN_PROVIDERS || "[]");
    } catch {
        throw new Error("LOGIN_PROVIDERS is not valid JSON");
    }
}

/**
 * Check for the settings of earlier versions: warn of them (by name, never
 * their values) if they are set next to `LOGIN_PROVIDERS`
 * @throws Error naming them if they are set without `LOGIN_PROVIDERS`
 */
function legacyLoginSettings() {
    const legacy = legacySettings.filter((name) => process.env[name]);
    if (!process.env.LOGIN_PROVIDERS && legacy.length)
        throw new Error(
            `Missing setting LOGIN_PROVIDERS: the app no longer reads ${legacy.join(", ")}; replace them with LOGIN_PROVIDERS and LOGIN_REDIRECT_URI (see "Upgrading" in the operator guide: https://cloud-registry-ui.readthedocs.io/en/latest/operator-guide/upgrading/)`,
        );
    for (const name of legacy)
        console.warn(
            `Ignoring setting ${name}: the app reads LOGIN_PROVIDERS and LOGIN_REDIRECT_URI instead. Remove the setting.`,
        );
}

/**
 * Check the login settings when building on Vercel, which deploys what it
 * builds. Builds with `vercel pull` get sensitive variables with a
 * placeholder instead of their values: those are only checked to be set,
 * and fully when the app starts; the others are checked as usual.
 * @throws Error naming each invalid or missing setting
 */
function loginSettingsAtBuild() {
    const sensitive = ["LOGIN_PROVIDERS", "LOGIN_REDIRECT_URI"].filter(
        (name) => process.env[name] === sensitivePlaceholder,
    );
    // `loginSettings()` checks for the old settings too
    if (!sensitive.length) {
        loginSettings();
        return;
    }
    legacyLoginSettings();
    console.warn(
        `Can't check ${sensitive.join(", ")} when building: sensitive variables have no value here; they are checked when the app starts`,
    );
    const schema = loginSettingsSchema.partial({
        providers: true,
        redirectUri: true,
    });
    const result = schema.safeParse({
        providers: sensitive.includes("LOGIN_PROVIDERS")
            ? undefined
            : providersJson(),
        redirectUri: sensitive.includes("LOGIN_REDIRECT_URI")
            ? undefined
            : (process.env.LOGIN_REDIRECT_URI ?? ""),
    });
    if (!result.success)
        throw new Error(
            `Invalid login settings (LOGIN_PROVIDERS, LOGIN_REDIRECT_URI):\n${z.prettifyError(result.error)}`,
        );
}

/**
 * Get the providers' public details for the login page
 * @returns ID, name and logo of each provider
 */
function loginProviderInfos(): LoginProviderInfo[] {
    return loginSettings().providers.map(({ id, name, logo }) => ({
        id,
        name,
        logo,
    }));
}

/**
 * Get a provider by its ID
 * @param id Provider ID; without one, the only provider, if there is one
 * @returns The provider, or undefined if there is none
 */
function loginProvider(id?: string) {
    const { providers } = loginSettings();
    if (!id) return providers.length === 1 ? providers[0] : undefined;
    return providers.find((val) => val.id === id);
}

/**
 * Get a provider's endpoints from its OpenID Connect discovery document
 * @param provider Login provider
 * @returns Promise resolving to the issuer, the authorization, token, user
 * info and end session URLs, whether authorization responses name the
 * issuer, and how to authenticate at the token endpoint
 * @throws Error (rejecting) for another issuer, missing or malformed
 * endpoints, or endpoints without TLS
 */
function oidcEndpoints(provider: LoginProvider): Promise<OidcEndpoints> {
    const cached = endpoints.get(provider.id);
    if (cached) return cached;

    const url = `${provider.issuer}/.well-known/openid-configuration`;
    const promise = axios
        .get<OidcDiscovery>(url, { timeout: loginRequestTimeout })
        .then((res) => {
            const {
                issuer,
                authorization_endpoint,
                token_endpoint,
                userinfo_endpoint,
                end_session_endpoint,
                authorization_response_iss_parameter_supported,
                token_endpoint_auth_methods_supported,
            } = res.data;
            if (!issuer || issuer.replace(/\/$/, "") !== provider.issuer)
                throw new Error(`Unexpected issuer ${issuer} at ${url}`);
            if (
                !authorization_endpoint ||
                !token_endpoint ||
                !userinfo_endpoint
            )
                throw new Error(
                    `Incomplete OpenID Connect discovery at ${url}`,
                );
            const urls = [
                authorization_endpoint,
                token_endpoint,
                userinfo_endpoint,
                end_session_endpoint,
                // optional: an empty one counts as none
            ].filter((val): val is string => !!val);
            if (!urls.every((val) => URL.canParse(val)))
                throw new Error(`Malformed endpoint URLs at ${url}`);
            // the token endpoint gets the client secret and the code
            // verifier, and its ID tokens are taken without checking their
            // signature; the end session endpoint gets the ID token
            if (!urls.every(isSecureUrl))
                throw new Error(
                    `Endpoint URLs that aren't https at ${url} (http only for localhost)`,
                );
            console.info(issuerLogLine(provider.id, issuer));
            return {
                issuer,
                authorization_endpoint,
                token_endpoint,
                userinfo_endpoint,
                end_session_endpoint: end_session_endpoint || undefined,
                // a string "true" too: the check is safer than none
                issParameterSupported: [true, "true"].includes(
                    authorization_response_iss_parameter_supported ?? false,
                ),
                tokenAuthMethod: tokenAuthMethod(
                    token_endpoint_auth_methods_supported,
                ),
            };
        });
    // fetch again on the next login after a failure
    promise.catch(() => endpoints.delete(provider.id));
    endpoints.set(provider.id, promise);
    return promise;
}

/**
 * Choose how to authenticate at the token endpoint: in the request's body
 * (`client_secret_post`) if the provider lists that method, else with HTTP
 * Basic authentication (`client_secret_basic`), which OpenID Connect
 * Discovery takes as the default if the provider lists none
 * @param supported `token_endpoint_auth_methods_supported` as discovered
 * @returns The method
 */
function tokenAuthMethod(supported: unknown): TokenAuthMethod {
    return Array.isArray(supported) && supported.includes("client_secret_post")
        ? "client_secret_post"
        : "client_secret_basic";
}

/**
 * Get the origins of the providers' issuers, to which the app may send
 * forms (the logout, redirected to the provider's end session endpoint)
 * @returns The origins, without duplicates; none if the login settings
 * are invalid (the server doesn't start with them)
 */
function loginProviderOrigins() {
    try {
        return [
            ...new Set(
                loginSettings().providers.map(
                    (val) => new URL(val.issuer).origin,
                ),
            ),
        ];
    } catch {
        return [];
    }
}

/**
 * Make text safe for a log line: no control characters (they could forge
 * log entries), at most 300 characters
 * @param text Text, e.g. from a login provider
 * @param maxLength Most characters to keep
 * @returns The text, with control characters replaced by spaces
 */
function logSafe(text: string, maxLength = 300) {
    return text.replace(/\p{Cc}/gu, " ").slice(0, maxLength);
}

/**
 * Describe a discovered issuer for the log, in full, as the registry
 * compares the tokens' `iss` with its trusted issuers exactly (trailing
 * slash included). Issuers with credentials, a query or a fragment, which
 * OpenID Connect doesn't allow, aren't logged, as those parts could hold
 * secrets.
 * @param id Provider ID
 * @param issuer Issuer as discovered
 * @returns Log line naming the issuer, or saying why it isn't named
 */
function issuerLogLine(id: string, issuer: string) {
    const { username, password, search, hash } = new URL(issuer);
    const line =
        username || password || search || hash
            ? `Login provider ${id}: issuer not logged, as it has credentials, a query or a fragment, which OpenID Connect doesn't allow`
            : `Login provider ${id}: issuer ${issuer} (list it exactly so in the registry's security.auth.issuers)`;
    return logSafe(line, Number.POSITIVE_INFINITY);
}

/**
 * Get a URL for logs: origin and path only, without credentials, query or
 * fragment
 * @param url URL
 * @returns Origin and path, or a placeholder for unparsable URLs
 */
function logUrl(url?: string) {
    if (!url || !URL.canParse(url)) return "unknown URL";
    const { origin, pathname } = new URL(url);
    return `${origin}${pathname}`;
}

/**
 * Describe a failed request to a login provider without secrets: the
 * request's body (e.g. the client secret), headers and the URL's
 * credentials, query and fragment stay out
 * @param err Error of a request, or any other error
 * @returns Method, URL, status, OAuth error code or message, safe for logs
 */
function loginErrorSummary(err: unknown) {
    if (!axios.isAxiosError(err))
        return logSafe(err instanceof Error ? err.message : String(err));
    const { config, response } = err;
    const data = response?.data as { error?: unknown } | undefined;
    // only codes as in RFC 6749 (e.g. invalid_grant): other text from the
    // provider could hold secrets
    const oauthError =
        typeof data?.error === "string" && /^[a-z_]{1,64}$/.test(data.error)
            ? `, error ${data.error}`
            : "";
    return logSafe(
        `${config?.method?.toUpperCase() ?? "Request"} ${logUrl(config?.url)} failed: ${
            response ? `status ${response.status}${oauthError}` : err.message
        }`,
    );
}

export type { LoginProvider, LoginProviderInfo, TokenAuthMethod };
export {
    loginErrorSummary,
    loginProvider,
    loginProviderInfos,
    loginProviderOrigins,
    loginRequestTimeout,
    loginSettings,
    loginSettingsAtBuild,
    oidcEndpoints,
};
