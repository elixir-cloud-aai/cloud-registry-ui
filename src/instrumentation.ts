/**
 * @description checks when the server starts, also for the standalone
 * server of the Docker image, which doesn't load `next.config.ts`
 */

/**
 * Check the login settings, which are read at runtime; invalid settings stop
 * the server, as the standalone server would otherwise keep running and fail
 * every request
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;
    const { loginSettings } = await import("@/lib/login-providers");
    try {
        loginSettings();
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
