import { defineConfig, devices } from "@playwright/test";

// end-to-end tests (`e2e/`) against the stack of `e2e/stack/compose.yaml`
// (registry, MongoDB, mock login provider), which must be running; the app
// is built and started here, on its own port
const port = 3100;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
    testDir: "e2e",
    // the tests share the registry: one file at a time
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
    use: { baseURL, trace: "retain-on-failure" },
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    ],
    webServer: {
        command: `bun run build && bun run start --port ${port}`,
        url: `${baseURL}/auth/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
        env: {
            NEXT_TELEMETRY_DISABLED: "1",
            NEXT_PUBLIC_CLOUD_REGISTRY_URL:
                "http://localhost:8180/ga4gh/registry/v1",
            NEXT_PUBLIC_SERVICE_URL_SCHEMES: "http,https",
            LOGIN_PROVIDERS: JSON.stringify([
                {
                    id: "mock",
                    name: "Mock Login",
                    logo: "/elixir-on-cloud-mark.svg",
                    issuer: "http://oidc.localhost:8190/oidc",
                    clientId: "cloud-registry-ui-e2e",
                    clientSecret: "e2e-secret",
                },
            ]),
            LOGIN_REDIRECT_URI: `${baseURL}/auth/api/callback`,
        },
    },
});
