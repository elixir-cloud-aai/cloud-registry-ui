import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";

export type FilterValue = string | null;

export type ServiceFilters = {
    type?: FilterValue;
    organization?: FilterValue;
    environment?: FilterValue;
};

export const defaultFilters: ServiceFilters = {};

const filterValues: Record<
    keyof ServiceFilters,
    (service: ExternalService) => FilterValue
> = {
    type: (service) =>
        JSON.stringify([
            service.type.group,
            service.type.artifact,
            service.type.version,
        ]),
    organization: (service) => service.organization.name || null,
    environment: (service) => service.environment || null,
};

const filterKeys = Object.keys(filterValues) as (keyof ServiceFilters)[];

export function typeLabel(value: string) {
    return (JSON.parse(value) as string[]).join(" · ");
}

export function filterOptions(
    services: ExternalService[],
    key: keyof ServiceFilters,
) {
    const values = [...new Set(services.map(filterValues[key]))];
    return values.sort((a, b) => {
        if (a === null) return 1;
        if (b === null) return -1;
        return a.localeCompare(b);
    });
}

export function isFiltered(search: string, filters: ServiceFilters) {
    return (
        search.trim() !== "" ||
        filterKeys.some((key) => filters[key] !== undefined)
    );
}

function matchesSearch(service: ExternalService, search: string) {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [
        service.name,
        service.id,
        service.description,
        service.organization.name,
        service.type.artifact,
        service.environment,
        service.version,
        service.url,
    ].some((val) => val?.toLowerCase().includes(query));
}

export function filterServices(
    services: ExternalService[],
    search: string,
    filters: ServiceFilters,
) {
    return services.filter(
        (service) =>
            matchesSearch(service, search) &&
            filterKeys.every(
                (key) =>
                    filters[key] === undefined ||
                    filterValues[key](service) === filters[key],
            ),
    );
}
