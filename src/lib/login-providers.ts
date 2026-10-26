/**
 * @description login providers from `LOGIN_PROVIDERS` (a JSON list), read on
 * the server only, as they hold client secrets
 */
import axios from "axios";
import { z } from "zod";

const loginProviderSchema = z.object({
    id: z.string().regex(/^[a-z0-9-]+$/, "Use a-z, 0-9 and - only"),
    name: z.string().min(1),
    logo: z.string().min(1),
    // without a trailing slash, to compare it with the discovered one
    issuer: z.url().transform((val) => val.replace(/\/$/, "")),
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

type OidcEndpoints = {
    issuer?: string;
    authorization_endpoint: string;
    token_endpoint: string;
    userinfo_endpoint: string;
};

/** @description timeout of requests to login providers, in milliseconds */
const loginRequestTimeout = 10000;

let settings: z.infer<typeof loginSettingsSchema> | undefined;
const endpoints = new Map<string, Promise<OidcEndpoints>>();

/**
 * Read and check the login settings
 * @returns Providers and the redirect URI
 * @throws Error naming each invalid or missing setting
 */
function loginSettings() {
    if (settings) return settings;

    let providers: unknown;
    try {
        providers = JSON.parse(process.env.LOGIN_PROVIDERS || "[]");
    } catch {
        throw new Error("LOGIN_PROVIDERS is not valid JSON");
    }
    const result = loginSettingsSchema.safeParse({
        providers,
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
 * @returns Promise resolving to the authorization, token and user info URLs
 */
function oidcEndpoints(provider: LoginProvider) {
    const cached = endpoints.get(provider.id);
    if (cached) return cached;

    const url = `${provider.issuer}/.well-known/openid-configuration`;
    const promise = axios
        .get<OidcEndpoints>(url, { timeout: loginRequestTimeout })
        .then((res) => {
            const {
                issuer,
                authorization_endpoint,
                token_endpoint,
                userinfo_endpoint,
            } = res.data;
            if (issuer?.replace(/\/$/, "") !== provider.issuer)
                throw new Error(`Unexpected issuer ${issuer} at ${url}`);
            if (
                !authorization_endpoint ||
                !token_endpoint ||
                !userinfo_endpoint
            )
                throw new Error(
                    `Incomplete OpenID Connect discovery at ${url}`,
                );
            if (
                ![
                    authorization_endpoint,
                    token_endpoint,
                    userinfo_endpoint,
                ].every((val) => URL.canParse(val))
            )
                throw new Error(`Malformed endpoint URLs at ${url}`);
            return {
                authorization_endpoint,
                token_endpoint,
                userinfo_endpoint,
            };
        });
    // fetch again on the next login after a failure
    promise.catch(() => endpoints.delete(provider.id));
    endpoints.set(provider.id, promise);
    return promise;
}

/**
 * Describe a failed request to a login provider without secrets: the
 * request's body (e.g. the client secret) and headers stay out
 * @param err Error of a request, or any other error
 * @returns Method, URL without query, status, OAuth error code and message
 */
function loginErrorSummary(err: unknown) {
    if (!axios.isAxiosError(err))
        return err instanceof Error ? err.message : String(err);
    const { config, response } = err;
    const url = config?.url ? config.url.split("?")[0] : "unknown URL";
    const data = response?.data as { error?: unknown } | undefined;
    // only codes as in RFC 6749 (e.g. invalid_grant): other text from the
    // provider could hold secrets or forge log lines
    const oauthError =
        typeof data?.error === "string" && /^[a-z_]{1,64}$/.test(data.error)
            ? `, error ${data.error}`
            : "";
    return `${config?.method?.toUpperCase() ?? "Request"} ${url} failed: ${
        response ? `status ${response.status}${oauthError}` : err.message
    }`;
}

export type { LoginProvider, LoginProviderInfo };
export {
    loginErrorSummary,
    loginProvider,
    loginProviderInfos,
    loginRequestTimeout,
    loginSettings,
    oidcEndpoints,
};
