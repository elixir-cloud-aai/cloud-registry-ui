/**
 * @description settings that the browser needs (`NEXT_PUBLIC_*`), read when
 * the server runs, so that one build serves any deployment. The server
 * reads them from its environment and passes them to the browser in the
 * page (`publicSettingsScript()`, in the root layout); values set when
 * building (e.g. on Vercel, or in `.env` for `next build`) apply where the
 * server's environment doesn't set them. They are public: they reach the
 * browser, so they must not hold secrets.
 */

const publicSettingNames = [
    "NEXT_PUBLIC_CLOUD_REGISTRY_URL",
    "NEXT_PUBLIC_SERVICE_URL_SCHEMES",
    "NEXT_PUBLIC_SERVICE_ENVIRONMENTS",
    "NEXT_PUBLIC_APP_TITLE",
    "NEXT_PUBLIC_APP_TITLE_SIZE",
    "NEXT_PUBLIC_APP_TITLE_FONT",
    "NEXT_PUBLIC_APP_LOGO",
    "NEXT_PUBLIC_APP_LOGO_DARK",
    "NEXT_PUBLIC_FOOTER_LOGO",
    "NEXT_PUBLIC_FOOTER_LOGO_DARK",
    "NEXT_PUBLIC_FOOTER_START_YEAR",
] as const;

type PublicSettingName = (typeof publicSettingNames)[number];
type PublicSettings = Partial<Record<PublicSettingName, string>>;

declare global {
    interface Window {
        // set by `publicSettingsScript()` before the app's scripts run
        __PUBLIC_SETTINGS__?: PublicSettings;
    }
}

// values set when building; Next replaces only these literal reads, so
// they must stay written out
const builtIn: PublicSettings = {
    NEXT_PUBLIC_CLOUD_REGISTRY_URL: process.env.NEXT_PUBLIC_CLOUD_REGISTRY_URL,
    NEXT_PUBLIC_SERVICE_URL_SCHEMES:
        process.env.NEXT_PUBLIC_SERVICE_URL_SCHEMES,
    NEXT_PUBLIC_SERVICE_ENVIRONMENTS:
        process.env.NEXT_PUBLIC_SERVICE_ENVIRONMENTS,
    NEXT_PUBLIC_APP_TITLE: process.env.NEXT_PUBLIC_APP_TITLE,
    NEXT_PUBLIC_APP_TITLE_SIZE: process.env.NEXT_PUBLIC_APP_TITLE_SIZE,
    NEXT_PUBLIC_APP_TITLE_FONT: process.env.NEXT_PUBLIC_APP_TITLE_FONT,
    NEXT_PUBLIC_APP_LOGO: process.env.NEXT_PUBLIC_APP_LOGO,
    NEXT_PUBLIC_APP_LOGO_DARK: process.env.NEXT_PUBLIC_APP_LOGO_DARK,
    NEXT_PUBLIC_FOOTER_LOGO: process.env.NEXT_PUBLIC_FOOTER_LOGO,
    NEXT_PUBLIC_FOOTER_LOGO_DARK: process.env.NEXT_PUBLIC_FOOTER_LOGO_DARK,
    NEXT_PUBLIC_FOOTER_START_YEAR: process.env.NEXT_PUBLIC_FOOTER_START_YEAR,
};

/**
 * Read the public settings from the server's environment
 * @returns The settings, with the values set when building where the
 * environment doesn't set them
 */
function serverPublicSettings(): PublicSettings {
    // a computed key, so that Next doesn't replace the read when building
    const env: Record<string, string | undefined> = process.env;
    return Object.fromEntries(
        publicSettingNames.map((name) => [name, env[name] ?? builtIn[name]]),
    );
}

/**
 * Get a public setting, on the server or in the browser
 * @param name Name of the setting
 * @returns Its value, or undefined if it isn't set
 */
function publicSetting(name: PublicSettingName): string | undefined {
    if (typeof window === "undefined") return serverPublicSettings()[name];
    return window.__PUBLIC_SETTINGS__?.[name] ?? builtIn[name];
}

/**
 * Build the inline script that passes the public settings to the browser
 * @returns JavaScript that sets `window.__PUBLIC_SETTINGS__`; `<` is
 * escaped, so that no value can end the script element
 */
function publicSettingsScript() {
    const json = JSON.stringify(serverPublicSettings()).replace(
        /</g,
        "\\u003c",
    );
    return `window.__PUBLIC_SETTINGS__=${json};`;
}

export {
    type PublicSettingName,
    publicSetting,
    publicSettingNames,
    publicSettingsScript,
};
