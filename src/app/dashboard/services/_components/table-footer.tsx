import { ListPagination } from "@/components/shared/list-pagination";
import { TableCell, TableFooter, TableRow } from "@/components/ui/table";

type Props = {
    total: number;
    start: number;
    end: number;
    page: number;
    pageCount: number;
    onPageChange: (page: number) => void;
};

function ServicesTableFooter({
    total,
    start,
    end,
    page,
    pageCount,
    onPageChange,
}: Props) {
    return (
        <TableFooter>
            <TableRow>
                <TableCell colSpan={6}>
                    {total === 0 ? (
                        "-"
                    ) : (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                            <span className="font-normal text-muted-foreground">
                                Showing {start + 1}-{end} of {total} services
                            </span>
                            <ListPagination
                                page={page}
                                pageCount={pageCount}
                                onPageChange={onPageChange}
                                className="mx-0 w-auto"
                            />
                        </div>
                    )}
                </TableCell>
            </TableRow>
        </TableFooter>
    );
}

export default ServicesTableFooter;
