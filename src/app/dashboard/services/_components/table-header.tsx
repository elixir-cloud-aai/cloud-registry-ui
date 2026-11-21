import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ServicesSort, ServicesSortKey } from "@/lib/services-sort";
import { type HeaderSortState, headerSortState } from "./header-helper";

// the columns, in the order of the table body
const columns: { key: ServicesSortKey; label: string }[] = [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "organization", label: "Organization" },
    { key: "type", label: "Artifact" },
    { key: "environment", label: "Environment" },
    { key: "version", label: "Version" },
];

const icons: Record<HeaderSortState, typeof ArrowUp> = {
    none: ArrowUpDown,
    ascending: ArrowUp,
    descending: ArrowDown,
};

type Props = {
    sort: ServicesSort;
    onSortChange: (key: ServicesSortKey) => void;
};

function ServicesTableHeader({ sort, onSortChange }: Props) {
    return (
        <TableHeader>
            <TableRow>
                {columns.map(({ key, label }) => {
                    const state = headerSortState(sort, key);
                    const Icon = icons[state];
                    return (
                        <TableHead
                            key={key}
                            scope="col"
                            aria-sort={state === "none" ? undefined : state}
                        >
                            <button
                                type="button"
                                onClick={() => onSortChange(key)}
                                className="-mx-2 inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {label}
                                <Icon
                                    aria-hidden
                                    className={
                                        state === "none"
                                            ? "size-4 text-muted-foreground/60"
                                            : "size-4"
                                    }
                                />
                            </button>
                        </TableHead>
                    );
                })}
            </TableRow>
        </TableHeader>
    );
}

export default ServicesTableHeader;
