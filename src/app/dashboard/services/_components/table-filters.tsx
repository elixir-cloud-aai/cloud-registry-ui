import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ALL,
    defaultFilters,
    filterOptions,
    type ServiceFilters,
    typeLabel,
} from "./filter-helper";

type FilterSelectProps = {
    label: string;
    allLabel: string;
    value: string;
    options: string[];
    disabled: boolean;
    onValueChange: (value: string) => void;
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
        value === ALL || options.includes(value)
            ? options
            : [...options, value];

    return (
        <Select value={value} onValueChange={onValueChange} disabled={disabled}>
            <SelectTrigger aria-label={label} className="w-full sm:w-48">
                <SelectValue placeholder={allLabel} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={ALL}>{allLabel}</SelectItem>
                {items.map((option) => (
                    <SelectItem key={option} value={option}>
                        {formatLabel(option)}
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
    onSearchChange: (search: string) => void;
    onFiltersChange: (filters: ServiceFilters) => void;
};

function ServicesTableFilters({
    services,
    search,
    filters,
    filtered,
    disabled,
    onSearchChange,
    onFiltersChange,
}: Props) {
    const handleFilterChange = (key: keyof ServiceFilters) => (value: string) =>
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
                formatLabel={typeLabel}
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
