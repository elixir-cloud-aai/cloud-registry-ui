import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import type { ServiceVerification } from "@/lib/cloud-registry.types";
import { environmentRank } from "@/lib/service-environments";
import { typeKey } from "@/lib/service-types";

export type FilterValue = string | null;

export type ServiceFilters = {
    type?: FilterValue;
    organization?: FilterValue;
    environment?: FilterValue;
    verified?: boolean;
    pending?: boolean;
};

export type SelectFilterKey = "type" | "organization" | "environment";

export const defaultFilters: ServiceFilters = {};

const filterValues: Record<
    SelectFilterKey,
    (service: ExternalService) => FilterValue
> = {
    type: (service) => typeKey(service.type),
    organization: (service) => service.organization.name || null,
    environment: (service) => service.environment || null,
};

const filterKeys = Object.keys(filterValues) as SelectFilterKey[];

export function filterOptions(
    services: ExternalService[],
    key: SelectFilterKey,
) {
    const values = [...new Set(services.map(filterValues[key]))];
    return values.sort((a, b) => {
        if (a === null) return 1;
        if (b === null) return -1;
        // configured environments first, in their order
        if (key === "environment") {
            const rank = environmentRank(a) - environmentRank(b);
            if (rank) return rank;
        }
        return a.localeCompare(b);
    });
}

export function isFiltered(search: string, filters: ServiceFilters) {
    return (
        search.trim() !== "" ||
        filterKeys.some((key) => filters[key] !== undefined) ||
        !!filters.verified ||
        !!filters.pending
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
    verifications: Map<string, ServiceVerification>,
    pending: Set<string>,
) {
    return services.filter(
        (service) =>
            matchesSearch(service, search) &&
            (!filters.verified || verifications.has(service.id)) &&
            (!filters.pending || pending.has(service.id)) &&
            filterKeys.every(
                (key) =>
                    filters[key] === undefined ||
                    filterValues[key](service) === filters[key],
            ),
    );
}
