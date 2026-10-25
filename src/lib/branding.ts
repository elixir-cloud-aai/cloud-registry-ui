/** @description branding from `NEXT_PUBLIC_*` variables, set at build time */

const appTitle = process.env.NEXT_PUBLIC_APP_TITLE || "Cloud Registry";
const appLogo = process.env.NEXT_PUBLIC_APP_LOGO || "/elixir-on-cloud-mark.svg";

export { appLogo, appTitle };
