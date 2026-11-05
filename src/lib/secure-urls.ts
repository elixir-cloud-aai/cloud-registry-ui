/**
 * @description checks that URLs are reached over TLS: `https`, or `http` on
 * the local machine only (e.g. development setups and tests)
 */

/**
 * Check whether a host name is the local machine
 * @param hostname Host name of a URL, IPv6 addresses in brackets
 * @returns Whether it is `localhost`, a `.localhost` name or a loopback
 * address
 */
function isLocalHost(hostname: string) {
    return (
        hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        /^127(\.\d{1,3}){3}$/.test(hostname) ||
        hostname === "[::1]"
    );
}

/**
 * Check that a URL is absolute and reached over TLS
 * @param url URL
 * @returns Whether it is an `https` URL, or an `http` URL of the local
 * machine
 */
function isSecureUrl(url: string) {
    if (!URL.canParse(url)) return false;
    const { protocol, hostname } = new URL(url);
    return (
        protocol === "https:" || (protocol === "http:" && isLocalHost(hostname))
    );
}

export { isLocalHost, isSecureUrl };
