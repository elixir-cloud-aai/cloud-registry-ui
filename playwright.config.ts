import { defineConfig, devices } from "@playwright/test";

// end-to-end tests (`e2e/`) against the stack of `e2e/stack/compose.yaml`
// (registry, MongoDB, mock login provider), which must be running. The app
// is built and started here, on its own port, unless `E2E_BASE_URL` points
// to one that runs already with the settings below, e.g. the image
// (service `app` of the stack, profile `image`)
const port = 3100;
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${port}`;

export default defineConfig({
    testDir: "e2e",
    // the tests share the registry: one file at a time
    workers: 1,
    forbidOnly: !!process.env.CI,
    // a test that passes only on the retry fails the run, with the traces
    // of both attempts
    retries: process.env.CI ? 1 : 0,
    failOnFlakyTests: !!process.env.CI,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
    use: { baseURL, trace: "retain-on-failure" },
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    ],
    // the settings of the tests; keep those of service `app` of the stack
    // in step
    webServer: process.env.E2E_BASE_URL
        ? undefined
        : {
              command: `bun run build && bun run start --port ${port}`,
              url: `${baseURL}/auth/login`,
              reuseExistingServer: !process.env.CI,
              timeout: 300_000,
              env: {
                  NEXT_TELEMETRY_DISABLED: "1",
                  NEXT_PUBLIC_CLOUD_REGISTRY_URL:
                      "http://localhost:8180/ga4gh/registry/v1",
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
