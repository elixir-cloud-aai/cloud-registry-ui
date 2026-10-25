/** @description branding from `NEXT_PUBLIC_*` variables, set at build time */

const appTitle = process.env.NEXT_PUBLIC_APP_TITLE || "Cloud Registry";
const appLogo = process.env.NEXT_PUBLIC_APP_LOGO || "/elixir-on-cloud-mark.svg";
const footerLogo =
    process.env.NEXT_PUBLIC_FOOTER_LOGO || "/elixir-on-cloud-lockup.svg";
const startYear = Number(process.env.NEXT_PUBLIC_FOOTER_START_YEAR);
const footerStartYear =
    Number.isInteger(startYear) && startYear > 0 ? startYear : undefined;

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

export { appLogo, appTitle, copyright, footerLogo };
