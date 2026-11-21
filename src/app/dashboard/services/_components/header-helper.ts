import type { ServicesSort, ServicesSortKey } from "@/lib/services-sort";

/** How a column's header shows the order */
export type HeaderSortState = "none" | "ascending" | "descending";

/**
 * Get how a column's header shows the order
 * @param sort The order of the list
 * @param key The column
 * @returns `none` for the other columns; else the direction, as in
 * `aria-sort`
 */
export function headerSortState(
    sort: ServicesSort,
    key: ServicesSortKey,
): HeaderSortState {
    if (sort.key !== key) return "none";
    return sort.order === "asc" ? "ascending" : "descending";
}
