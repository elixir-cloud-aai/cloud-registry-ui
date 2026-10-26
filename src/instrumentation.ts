/**
 * @description checks when the server starts; needed for the standalone
 * server of the Docker image, which doesn't load `next.config.ts` (that
 * file checks the same settings for `next start` and `next dev`, before
 * this hook runs)
 */

/**
 * @description check the settings, which are read at runtime; invalid
 * settings stop the server, as the standalone server would otherwise keep
 * running and fail, e.g. every login or every call of the registry. Next
 * doesn't call this hook during
 * `next build`.
 * @returns Promise resolving when the settings are valid; with invalid
 * settings, the server stops instead
 */
export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;
    const { loginSettings } = await import("@/lib/login-providers");
    const { publicSettingsChecks } = await import("@/lib/settings-checks");
    try {
        loginSettings();
        publicSettingsChecks();
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
