/**
 * @description the order of the services list: the columns it sorts by,
 * the deployment's default (`NEXT_PUBLIC_SERVICES_SORT`,
 * `NEXT_PUBLIC_SERVICES_SORT_ORDER`, read when the server runs, see
 * `public-settings.ts`) and the order in the URL query (`sort`, `order`)
 */
import { publicSetting } from "./public-settings";

/** The columns of the services list, in the order the table shows them */
const servicesSortKeys = [
    "id",
    "name",
    "organization",
    "type",
    "environment",
    "version",
] as const;

const servicesSortOrders = ["asc", "desc"] as const;

type ServicesSortKey = (typeof servicesSortKeys)[number];
type ServicesSortOrder = (typeof servicesSortOrders)[number];

/** A column of the services list and the direction to sort it in */
type ServicesSort = { key: ServicesSortKey; order: ServicesSortOrder };

const defaultServicesSort: ServicesSort = { key: "name", order: "asc" };

/**
 * Parse one of a set of values
 * @param values The values allowed
 * @param value Text of the setting or parameter; case and blanks around
 * it are ignored, and blank counts as not set
 * @returns The value; null if not set, undefined if invalid
 */
function parseValue<T extends string>(
    values: readonly T[],
    value: string | null = "",
): T | null | undefined {
    const text = (value ?? "").trim().toLowerCase();
    if (!text) return null;
    return values.find((val) => val === text);
}

/**
 * Get the deployment's default order of the services list
 * @returns The settings `NEXT_PUBLIC_SERVICES_SORT` and
 * `NEXT_PUBLIC_SERVICES_SORT_ORDER`, each the default (name, ascending) if
 * it isn't set or is invalid
 */
function servicesSort(): ServicesSort {
    return {
        key:
            parseValue(
                servicesSortKeys,
                publicSetting("NEXT_PUBLIC_SERVICES_SORT"),
            ) ?? defaultServicesSort.key,
        order:
            parseValue(
                servicesSortOrders,
                publicSetting("NEXT_PUBLIC_SERVICES_SORT_ORDER"),
            ) ?? defaultServicesSort.order,
    };
}

/**
 * Warn of invalid settings of the order; the list then falls back to the
 * default, so they don't stop the server
 */
function servicesSortWarnings() {
    const key = publicSetting("NEXT_PUBLIC_SERVICES_SORT");
    if (parseValue(servicesSortKeys, key) === undefined)
        console.warn(
            `Ignoring setting NEXT_PUBLIC_SERVICES_SORT: "${key}" must be one of ${servicesSortKeys.join(", ")}; sorting by ${defaultServicesSort.key}`,
        );
    const order = publicSetting("NEXT_PUBLIC_SERVICES_SORT_ORDER");
    if (parseValue(servicesSortOrders, order) === undefined)
        console.warn(
            `Ignoring setting NEXT_PUBLIC_SERVICES_SORT_ORDER: "${order}" must be asc or desc; sorting ${defaultServicesSort.order}`,
        );
}

/**
 * Get the order of the services list from the URL query, e.g. of a shared
 * link
 * @param params Parameters of the query; `sort` names the column, `order`
 * the direction
 * @param fallback The order for missing or invalid parameters, each on its
 * own
 * @returns The order
 */
function sortFromQuery(
    params: Pick<URLSearchParams, "get">,
    fallback: ServicesSort,
): ServicesSort {
    return {
        key: parseValue(servicesSortKeys, params.get("sort")) ?? fallback.key,
        order:
            parseValue(servicesSortOrders, params.get("order")) ??
            fallback.order,
    };
}

/**
 * Put the order of the services list in a URL's query
 * @param href The URL
 * @param sort The order
 * @returns The URL with the parameters `sort` and `order`, and the others
 * it has
 */
function withSortQuery(href: string, { key, order }: ServicesSort) {
    const url = new URL(href);
    url.searchParams.set("sort", key);
    url.searchParams.set("order", order);
    return url;
}

/**
 * Get the order after a click on a column's header
 * @param current The current order
 * @param key The column clicked
 * @returns The other direction for the same column, else the column,
 * ascending
 */
function nextSort(current: ServicesSort, key: ServicesSortKey): ServicesSort {
    if (current.key !== key) return { key, order: "asc" };
    return { key, order: current.order === "asc" ? "desc" : "asc" };
}

export {
    nextSort,
    type ServicesSort,
    type ServicesSortKey,
    servicesSort,
    servicesSortWarnings,
    sortFromQuery,
    withSortQuery,
};
