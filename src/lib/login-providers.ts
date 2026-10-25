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
    issuer: z.url(),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    scopes: z.array(z.string().min(1)).default(["openid", "profile", "email"]),
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

    const url = `${provider.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
    const promise = axios.get<OidcEndpoints>(url).then((res) => {
        const {
            issuer,
            authorization_endpoint,
            token_endpoint,
            userinfo_endpoint,
        } = res.data;
        if (issuer?.replace(/\/$/, "") !== provider.issuer.replace(/\/$/, ""))
            throw new Error(`Unexpected issuer ${issuer} at ${url}`);
        if (!authorization_endpoint || !token_endpoint || !userinfo_endpoint)
            throw new Error(`Incomplete OpenID Connect discovery at ${url}`);
        return { authorization_endpoint, token_endpoint, userinfo_endpoint };
    });
    // fetch again on the next login after a failure
    promise.catch(() => endpoints.delete(provider.id));
    endpoints.set(provider.id, promise);
    return promise;
}

export type { LoginProvider, LoginProviderInfo };
export { loginProvider, loginProviderInfos, loginSettings, oidcEndpoints };
