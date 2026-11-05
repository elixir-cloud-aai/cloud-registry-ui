# Login

Users log in with one of the login providers that you configure (OpenID Connect, authorization code flow with PKCE and a nonce). Providers must support PKCE with `S256`, as LS Login does; if a provider names itself in its responses (RFC 9207), the app checks the name. ID tokens must name the provider's issuer, the client ID and the login's nonce. The issuer and the endpoints that its discovery document lists must be `https` URLs (`http` only for `localhost`, `*.localhost` and loopback addresses, e.g. for development; `*.localhost` names must resolve to the local machine on the app's server): the app sends the client secret and the code verifier to the token endpoint, and takes the ID token from there without checking its signature. The app refuses to start with an `http` issuer, and logins fail if the discovery lists `http` endpoints. To get tokens, the app authenticates with its client ID and secret in the body of the token request (`client_secret_post`) if the provider lists that method in `token_endpoint_auth_methods_supported`, and otherwise with HTTP Basic authentication (`client_secret_basic`), which is the default of OpenID Connect for providers that list no methods. There is nothing to configure for this. The app reads these settings when the server starts and refuses to start without at least one valid provider. They are read at runtime, so `docker run -e` and `--env-file` work, and they stay on the server: client secrets never reach the browser or the image (pass them with `docker run`, see [Docker](deployment.md#docker)).

| Variable             | Required | Description                                                                                  |
| -------------------- | -------- | -------------------------------------------------------------------------------------------- |
| `LOGIN_PROVIDERS`    | yes      | Login providers as a JSON list (see below)                                                   |
| `LOGIN_REDIRECT_URI` | yes      | URL of the app's `/auth/api/callback`, e.g. `https://app.example.org/auth/api/callback` |

Each provider has these fields:

| Field          | Required | Description                                                                                               |
| -------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `id`           | yes      | Unique ID, `a-z`, `0-9` and `-` only, e.g. `ls-login`                                                     |
| `name`         | yes      | Name on the login page                                                                                    |
| `logo`         | yes      | Logo on the login page; an `https` URL, or a path in `public/` (built into the image)                     |
| `issuer`       | yes      | Issuer URL, as in its `/.well-known/openid-configuration`, which lists the endpoints; `https` (see above) |
| `clientId`     | yes      | Client ID registered with the provider                                                                    |
| `clientSecret` | yes      | Client secret                                                                                             |
| `scopes`       | no       | Default: `["openid", "profile", "email"]`; add `eduperson_entitlement` for LS Login                       |

Example for [LS Login](https://lifescience-ri.eu/ls-login/), whose logo is in `public/`:

```
LOGIN_PROVIDERS=[{"id": "ls-login", "name": "LS Login", "logo": "/ls-login-grey-wide.jpg", "issuer": "https://login.aai.lifescience-ri.eu/oidc/", "clientId": "<client ID>", "clientSecret": "<client secret>", "scopes": ["openid", "profile", "email", "eduperson_entitlement"]}]
LOGIN_REDIRECT_URI=https://app.example.org/auth/api/callback
```

The login page lists the providers, also when there is only one, so that logging out doesn't log users straight back in. Restart the app after changing the providers.

**Several providers:** the registry must trust each provider's issuer (`security.auth.issuers`, see below). Since cloud-registry 0.6.0, it namespaces user IDs by issuer, so IDs from different providers don't clash. All providers share one redirect URI, though, so the app can't tell which provider answered a login: register the same redirect URI with each provider, and don't combine trusted and untrusted providers. The registry's `security.auth.audience` must contain the client IDs of all providers (see below).

## Registering the app with LS Login

Register the app with [LS Login](https://lifescience-ri.eu/ls-login/) as a service (an OpenID Connect client):

- **Flow:** authorization code, with a client secret.
- **Redirect URI:** the value of `LOGIN_REDIRECT_URI`, e.g. `https://app.example.org/auth/api/callback`. Use a separate client for local development, with `http://localhost:3000/auth/api/callback`.
- **Post-logout redirect URI:** the app's login page, `/auth/login` at the origin of `LOGIN_REDIRECT_URI`, e.g. `https://app.example.org/auth/login` (see [Sessions and logout](#sessions-and-logout)).
- **Scopes:** `openid`, `profile`, `email` and `eduperson_entitlement`. LS Login releases the groups (`eduperson_entitlement`), which the registry needs to recognise admins, only with this scope, and only via user info.

Put the client ID and secret in `LOGIN_PROVIDERS` (see the example above), and keep its `scopes`: without them, the app requests only the default scopes, and the registry doesn't recognise admins. The app sends the user's access token to the registry, never the ID token.

## Sessions and logout

After logging in, the app keeps the session in cookies for as long as the access token is valid (`expires_in` of the provider's token response), at most 12 hours (also if the provider doesn't say); an `expires_in` that isn't a number of at least 1 second fails the login. The app doesn't refresh tokens, so users log in again afterwards: set the provider's access token lifetime to the session length you want (e.g. Keycloak's "Access Token Lifespan", 5 minutes by default). The cookies are `__Host-access_token`, which the browser sends to the registry, and `__Host-id_token` and `__Host-login_provider`, the ID token and the provider, which only the server reads (`httpOnly`); a login in progress has `__Host-auth*` cookies for up to 30 minutes. The prefix `__Host-` makes browsers take the cookies only if they are `Secure`, for the path `/`, and without a `Domain`, so that sites on other subdomains of the same domain can't set them, e.g. to log users in to an account of the attacker. Production builds serve the app over `https` for this (`http` works on `localhost` only); development servers (`bun run dev`) use the names without the prefix. Still, serve the app on a domain of its own (e.g. `registry.example.org`, not next to sites of others under one domain), as such sites can set cookies of their own for the whole domain, e.g. the names without the prefix (see [Upgrading](upgrading.md#100-rc2)). Logging out is a `POST` to `/auth/api/logout` from the app's own pages (same origin; a sent `Origin` must be that of `LOGIN_REDIRECT_URI`), so serve the app at that address; other requests lead to an error page.

Logging out deletes the app's cookies and, if the session still has its ID token, its provider is configured, and the provider's discovery document lists an `end_session_endpoint` (OpenID Connect RP-Initiated Logout), ends the session at the provider too: the app sends the browser there with the ID token (`id_token_hint`), its client ID and the login page as `post_logout_redirect_uri`, and the provider sends it back to the login page. Register that URI with the provider (see above), as providers may refuse others or show their own page instead. The app goes on to the provider with a page that refreshes at once (not a redirect, which the Content Security Policy's `form-action` would block for providers that pass the browser on to other hosts). If the provider can't be reached, the app logs an error and logs out of the app only, as it does for providers without such an endpoint. The app doesn't revoke tokens: the access token stays valid until it expires. If a provider has no end session endpoint, users stay logged in there, so the next login may not ask for their credentials: tell users of shared computers to log out at the provider too.

Failed requests to login providers are logged without secrets or tokens.

## Copying the access token

Development servers (`bun run dev`) offer "Copy token to Dashboard" in the user menu; production builds (`bun run build`, the Docker image, Vercel) don't. Builds with Next's development settings (`next build --debug-prerender`, `experimental.allowDevelopmentBuild`) count as development builds and offer it too: don't deploy them. It copies the user's access token, e.g. to paste it into a dashboard or a CLI that has no login of its own yet. It's a convenience for development only:

- It puts a bearer token on the clipboard, where any app, and any page allowed to read the clipboard, can read it.
- Whoever has the token acts as the user until it expires (up to 4 hours with LS Login), at the registry and at every other service that accepts it.

Tools that need tokens should get their own login (e.g. [elixir-cloud-aai/krini#46](https://github.com/elixir-cloud-aai/krini/issues/46) for the web portal).

## Registry settings for the app

The registry accepts the app's tokens only if it is configured for them (see the registry's [configuration docs](https://cloud-registry.readthedocs.io/en/latest/configuration/#deployment-configuration)). For LS Login, in a config overlay (with the registry's Helm chart, in its `config` value):

```yaml
security:
    auth:
        issuers:
            - https://login.aai.lifescience-ri.eu/oidc/
        audience:
            - <client ID of the app>
        userinfo_claims:
            - eduperson_entitlement
            - name
    access_control:
        claim_groups: eduperson_entitlement
        group_mapping:
            "<admin group, a value of eduperson_entitlement>": admin
```

- `issuers` must contain the provider's issuer exactly as the provider spells it in its `/.well-known/openid-configuration` (the `iss` of its tokens), trailing slash included; otherwise, the registry rejects every request with `401`. LS Login's issuer ends with a slash.

    The app accepts the issuer in `LOGIN_PROVIDERS` with or without the slash, but the registry compares it exactly. To see the spelling, look for the log line starting with `Login provider <id>: issuer`, which the app writes when it first contacts a provider, e.g. at the first login.

- `audience` must contain the app's client ID; otherwise, all requests that need a login fail with `401`.
- `userinfo_claims` lets the registry read the groups and names that LS Login doesn't put in access tokens.

Deployments that use `LS_LOGIN_URL` and `OIDC_*` settings must change to `LOGIN_PROVIDERS` (see [Upgrading](upgrading.md#login-providers-instead-of-ls_login_url-and-oidc_)).
