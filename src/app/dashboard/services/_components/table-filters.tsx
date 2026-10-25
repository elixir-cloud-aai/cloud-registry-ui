import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { BadgeCheckIcon, ClockIcon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { typeFromKey, typeLabel } from "@/lib/service-types";
import {
    defaultFilters,
    type FilterValue,
    filterOptions,
    type SelectFilterKey,
    type ServiceFilters,
} from "./filter-helper";

const anyValue = "any";
const unsetValue = "unset";

function toSelectValue(value?: FilterValue) {
    if (value === undefined) return anyValue;
    if (value === null) return unsetValue;
    return `=${value}`;
}

function fromSelectValue(value: string) {
    if (value === anyValue) return undefined;
    if (value === unsetValue) return null;
    return value.slice(1);
}

type FilterSelectProps = {
    label: string;
    allLabel: string;
    value?: FilterValue;
    options: FilterValue[];
    disabled: boolean;
    onValueChange: (value?: FilterValue) => void;
    formatLabel?: (value: string) => string;
};

function FilterSelect({
    label,
    allLabel,
    value,
    options,
    disabled,
    onValueChange,
    formatLabel = (val) => val,
}: FilterSelectProps) {
    const items =
        value === undefined || options.includes(value)
            ? options
            : [...options, value];

    return (
        <Select
            value={toSelectValue(value)}
            onValueChange={(val) => onValueChange(fromSelectValue(val))}
            disabled={disabled}
        >
            <SelectTrigger aria-label={label} className="w-full sm:w-48">
                <SelectValue placeholder={allLabel} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={anyValue}>{allLabel}</SelectItem>
                {items.map((option) => (
                    <SelectItem
                        key={toSelectValue(option)}
                        value={toSelectValue(option)}
                    >
                        {option === null ? "Not set" : formatLabel(option)}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

type Props = {
    services: ExternalService[];
    search: string;
    filters: ServiceFilters;
    filtered: boolean;
    disabled: boolean;
    showPending?: boolean;
    onSearchChange: (search: string) => void;
    onFiltersChange: (filters: ServiceFilters) => void;
};

function ServicesTableFilters({
    services,
    search,
    filters,
    filtered,
    disabled,
    showPending = false,
    onSearchChange,
    onFiltersChange,
}: Props) {
    const handleFilterChange =
        (key: SelectFilterKey) => (value?: FilterValue) =>
            onFiltersChange({ ...filters, [key]: value });

    const handleClear = () => {
        onSearchChange("");
        onFiltersChange(defaultFilters);
    };

    return (
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
            <div className="relative w-full sm:w-72">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    type="search"
                    aria-label="Search services"
                    placeholder="Search services..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    disabled={disabled}
                    className="pl-9"
                />
            </div>
            <FilterSelect
                label="Filter by type"
                allLabel="All types"
                value={filters.type}
                options={filterOptions(services, "type")}
                disabled={disabled}
                onValueChange={handleFilterChange("type")}
                formatLabel={(val) => typeLabel(typeFromKey(val))}
            />
            <FilterSelect
                label="Filter by organization"
                allLabel="All organizations"
                value={filters.organization}
                options={filterOptions(services, "organization")}
                disabled={disabled}
                onValueChange={handleFilterChange("organization")}
            />
            <FilterSelect
                label="Filter by environment"
                allLabel="All environments"
                value={filters.environment}
                options={filterOptions(services, "environment")}
                disabled={disabled}
                onValueChange={handleFilterChange("environment")}
            />
            <Toggle
                variant={"outline"}
                aria-label="Show verified services only"
                pressed={!!filters.verified}
                onPressedChange={(pressed) =>
                    onFiltersChange({
                        ...filters,
                        verified: pressed || undefined,
                    })
                }
                disabled={disabled}
            >
                <BadgeCheckIcon />
                Verified only
            </Toggle>
            {showPending && (
                <Toggle
                    variant={"outline"}
                    aria-label="Show pending services only"
                    pressed={!!filters.pending}
                    onPressedChange={(pressed) =>
                        onFiltersChange({
                            ...filters,
                            pending: pressed || undefined,
                        })
                    }
                    disabled={disabled}
                >
                    <ClockIcon />
                    Pending only
                </Toggle>
            )}
            {filtered && (
                <Button variant={"ghost"} onClick={handleClear}>
                    <XIcon />
                    Clear
                </Button>
            )}
        </div>
    );
}

export default ServicesTableFilters;
