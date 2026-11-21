import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ServicesSort, ServicesSortKey } from "@/lib/services-sort";

// the columns, in the order of the table body
const columns: { key: ServicesSortKey; label: string }[] = [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "organization", label: "Organization" },
    { key: "type", label: "Artifact" },
    { key: "environment", label: "Environment" },
    { key: "version", label: "Version" },
];

type Props = {
    sort: ServicesSort;
    onSortChange: (key: ServicesSortKey) => void;
};

function ServicesTableHeader({ sort, onSortChange }: Props) {
    return (
        <TableHeader>
            <TableRow>
                {columns.map(({ key, label }) => {
                    const active = sort.key === key;
                    const ascending = sort.order === "asc";
                    const Icon = !active
                        ? ArrowUpDown
                        : ascending
                          ? ArrowUp
                          : ArrowDown;
                    return (
                        <TableHead
                            key={key}
                            scope="col"
                            aria-sort={
                                !active
                                    ? undefined
                                    : ascending
                                      ? "ascending"
                                      : "descending"
                            }
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
                                        active
                                            ? "size-4"
                                            : "size-4 text-muted-foreground/60"
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
