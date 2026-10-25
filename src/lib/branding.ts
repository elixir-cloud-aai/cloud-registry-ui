/** @description branding from `NEXT_PUBLIC_*` variables, set at build time */

const maxLineLength = 24;
const maxLines = 2;

// a blank title falls back to the default, like an unset one
const appTitle = process.env.NEXT_PUBLIC_APP_TITLE?.trim() || "Cloud Registry";
const titleSize = Number(process.env.NEXT_PUBLIC_APP_TITLE_SIZE);
const appTitleSize = titleSize > 0 ? titleSize : undefined;
const appTitleFont = process.env.NEXT_PUBLIC_APP_TITLE_FONT || undefined;
const startYear = Number(process.env.NEXT_PUBLIC_FOOTER_START_YEAR);
const footerStartYear =
    Number.isInteger(startYear) && startYear > 0 ? startYear : undefined;

// `_DARK` = the logo shown in the dark colour scheme, i.e. a light-coloured
// logo for a dark background; a custom logo without one is used in both
// colour schemes, on a white backing in the dark one
const appLogo = {
    light: process.env.NEXT_PUBLIC_APP_LOGO || "/elixir-on-cloud-mark.svg",
    dark: process.env.NEXT_PUBLIC_APP_LOGO
        ? process.env.NEXT_PUBLIC_APP_LOGO_DARK || undefined
        : process.env.NEXT_PUBLIC_APP_LOGO_DARK ||
          "/elixir-on-cloud-mark-night.svg",
};
const footerLogo = {
    light: process.env.NEXT_PUBLIC_FOOTER_LOGO || "/elixir-on-cloud-lockup.svg",
    dark: process.env.NEXT_PUBLIC_FOOTER_LOGO
        ? process.env.NEXT_PUBLIC_FOOTER_LOGO_DARK || undefined
        : process.env.NEXT_PUBLIC_FOOTER_LOGO_DARK ||
          "/elixir-on-cloud-lockup-night.svg",
};

/**
 * Count the characters of a text, not its UTF-16 code units
 * @param text Text
 * @returns Number of characters; an emoji counts as one
 */
function length(text: string) {
    return [...text].length;
}

/**
 * Break a title into lines at spaces, as few as possible
 * @param title Title
 * @returns Lines of at most 24 characters, or an error
 */
function breakTitle(title: string) {
    const lines: string[] = [];
    for (const word of title.trim().split(/\s+/)) {
        if (length(word) > maxLineLength)
            return {
                lines,
                error: `the word "${word}" has ${length(word)} characters; words may have at most ${maxLineLength}`,
            };
        const last = lines.at(-1);
        if (last !== undefined && length(`${last} ${word}`) <= maxLineLength)
            lines[lines.length - 1] = `${last} ${word}`;
        else lines.push(word);
    }
    if (lines.length > maxLines)
        return {
            lines,
            error: `the title needs ${lines.length} lines of at most ${maxLineLength} characters (${lines.map((line) => `"${line}"`).join(", ")}); at most ${maxLines} are allowed`,
        };
    return { lines };
}

/**
 * Check the branding settings
 * @throws Error naming the invalid setting
 */
function brandingSettings() {
    const { error } = breakTitle(appTitle);
    if (error)
        throw new Error(
            `Invalid branding setting NEXT_PUBLIC_APP_TITLE "${appTitle}": ${error}`,
        );
}

const appTitleLines = breakTitle(appTitle).lines;

/**
 * Get the copyright line of the footer
 * @param currentYear Current year, unknown while prerendering
 * @returns "© START – CURRENT", or "© CURRENT" without an earlier start year;
 * without the current year only "© START", or nothing
 */
function copyright(currentYear?: number) {
    if (currentYear === undefined)
        return footerStartYear ? `© ${footerStartYear}` : "";
    return footerStartYear && footerStartYear < currentYear
        ? `© ${footerStartYear} – ${currentYear}`
        : `© ${currentYear}`;
}

export {
    appLogo,
    appTitle,
    appTitleFont,
    appTitleLines,
    appTitleSize,
    brandingSettings,
    breakTitle,
    copyright,
    footerLogo,
};
