import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";

export const ALL = "__all__";

export type ServiceFilters = {
    type: string;
    organization: string;
    environment: string;
};

export const defaultFilters: ServiceFilters = {
    type: ALL,
    organization: ALL,
    environment: ALL,
};

const filterValues: Record<
    keyof ServiceFilters,
    (service: ExternalService) => string | undefined
> = {
    type: (service) =>
        `${service.type.group}:${service.type.artifact}:${service.type.version}`,
    organization: (service) => service.organization.name,
    environment: (service) => service.environment,
};

export function typeLabel(value: string) {
    return value.split(":").join(" · ");
}

export function filterOptions(
    services: ExternalService[],
    key: keyof ServiceFilters,
) {
    const values = services
        .map(filterValues[key])
        .filter((val): val is string => !!val);
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function isFiltered(search: string, filters: ServiceFilters) {
    return (
        search.trim() !== "" ||
        Object.values(filters).some((val) => val !== ALL)
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
    const keys = Object.keys(filters) as (keyof ServiceFilters)[];
    return services.filter(
        (service) =>
            matchesSearch(service, search) &&
            keys.every(
                (key) =>
                    filters[key] === ALL ||
                    filterValues[key](service) === filters[key],
            ),
    );
}
