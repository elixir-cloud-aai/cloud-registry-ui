import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import type { ServicesSort, ServicesSortKey } from "@/lib/services-sort";

// text in the user's language, ignoring case and accents; numbers in it
// by their values, so that `1.10.0` comes after `1.9.0`
const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
});

// what each column sorts by, most significant first: types by artifact
// (the column shows it), then by version, then by group
const sortValues: Record<
    ServicesSortKey,
    (service: ExternalService) => string[]
> = {
    id: (service) => [service.id],
    name: (service) => [service.name],
    organization: (service) => [service.organization.name],
    type: ({ type }) => [type.artifact, type.version, type.group],
    environment: (service) => [service.environment ?? ""],
    version: (service) => [service.version],
};

/**
 * Compare the values of two services for a column
 * @param a Values of a service
 * @param b Values of the other service
 * @returns Negative if `a` comes first, positive if `b` does, else 0
 */
function compareValues(a: string[], b: string[]) {
    for (const [index, value] of a.entries()) {
        const order = collator.compare(value, b[index]);
        if (order) return order;
    }
    return 0;
}

/**
 * Break a tie: by name, then by ID, ascending in both directions
 * @param a Service
 * @param b Other service
 * @returns Negative if `a` comes first, positive if `b` does; 0 only for
 * the same ID
 */
function compareTies(a: ExternalService, b: ExternalService) {
    const order = collator.compare(a.name, b.name);
    if (order) return order;
    const ids = collator.compare(a.id, b.id);
    if (ids) return ids;
    // IDs that differ only in case or accents
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Sort services by a column; services without a value for it come last,
 * in both directions
 * @param services Services; the list isn't changed
 * @param sort The column and the direction
 * @returns The services, sorted
 */
export function sortServices(
    services: ExternalService[],
    { key, order }: ServicesSort,
) {
    const direction = order === "desc" ? -1 : 1;
    return services.toSorted((a, b) => {
        const valuesA = sortValues[key](a);
        const valuesB = sortValues[key](b);
        const missingA = !valuesA[0];
        const missingB = !valuesB[0];
        if (missingA !== missingB) return missingA ? 1 : -1;
        return direction * compareValues(valuesA, valuesB) || compareTies(a, b);
    });
}
