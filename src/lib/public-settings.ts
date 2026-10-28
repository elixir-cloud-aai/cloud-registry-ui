/**
 * @description settings that the browser needs (`NEXT_PUBLIC_*`), read when
 * the server runs, so that one build serves any deployment. The server
 * reads them from its environment and passes them to the browser in the
 * page (`publicSettingsScript()`, in the root layout); values set when
 * building (e.g. on Vercel, or in `.env` for `next build`) apply where the
 * server's environment doesn't set them. They are public: they reach the
 * browser, so they must not hold secrets. Pages that replace the root
 * layout (e.g. a `global-error.tsx`) must render the script too.
 */

// the list of the public settings, with the values set when building;
// Next replaces only these literal reads, so they must stay written out.
// Only names listed here reach the browser: add new settings here, to the
// README's Configurations table and to `.env.example`
const builtIn = {
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

type PublicSettingName = keyof typeof builtIn;
type PublicSettings = Partial<Record<PublicSettingName, string>>;

const publicSettingNames = Object.keys(builtIn) as PublicSettingName[];

declare global {
    interface Window {
        // set by `publicSettingsScript()` before the app's scripts run
        __PUBLIC_SETTINGS__?: PublicSettings;
    }
}

// whether the browser was told that the settings are missing
let warned = false;

/**
 * Read a public setting from the server's environment
 * @param name Name of the setting
 * @returns Its value, or the one set when building if the environment
 * doesn't set it
 */
function serverPublicSetting(name: PublicSettingName) {
    // a computed key, so that Next doesn't replace the read when building
    const env: Record<string, string | undefined> = process.env;
    return env[name] ?? builtIn[name];
}

/**
 * Read the public settings from the server's environment
 * @returns The settings, with the values set when building where the
 * environment doesn't set them
 */
function serverPublicSettings(): PublicSettings {
    return Object.fromEntries(
        publicSettingNames.map((name) => [name, serverPublicSetting(name)]),
    );
}

/**
 * Get a public setting, on the server or in the browser
 * @param name Name of the setting
 * @returns Its value, or undefined if it isn't set
 */
function publicSetting(name: PublicSettingName): string | undefined {
    if (typeof window === "undefined") return serverPublicSetting(name);
    const settings = window.__PUBLIC_SETTINGS__;
    // pages get them from the root layout; without them, only the values
    // set when building apply, if any
    if (!settings && !warned) {
        warned = true;
        console.error(
            "The page has no settings (window.__PUBLIC_SETTINGS__); using those set when building, if any",
        );
    }
    return settings?.[name] ?? builtIn[name];
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

export { type PublicSettingName, publicSetting, publicSettingsScript };
