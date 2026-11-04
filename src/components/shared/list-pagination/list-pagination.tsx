"use client";
import { Fragment, type MouseEvent } from "react";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";

type Props = {
    page: number;
    pageCount: number;
    onPageChange: (page: number) => void;
    className?: string;
};

function pageNumbers(page: number, pageCount: number) {
    const pages = [...new Set([1, page - 1, page, page + 1, pageCount])]
        .filter((val) => val >= 1 && val <= pageCount)
        .sort((a, b) => a - b);
    return pages.flatMap((val, idx) =>
        idx > 0 && val - pages[idx - 1] === 2 ? [val - 1, val] : [val],
    );
}

function ListPagination({ page, pageCount, onPageChange, className }: Props) {
    if (pageCount <= 1) return null;

    const handlePageChange =
        (target: number) => (e: MouseEvent<HTMLAnchorElement>) => {
            e.preventDefault();
            if (target >= 1 && target <= pageCount) onPageChange(target);
        };

    const disabledClass = "pointer-events-none opacity-50";

    return (
        <Pagination className={className}>
            <PaginationContent>
                <PaginationItem>
                    <PaginationPrevious
                        href="#"
                        aria-disabled={page === 1}
                        tabIndex={page === 1 ? -1 : undefined}
                        className={page === 1 ? disabledClass : undefined}
                        onClick={handlePageChange(page - 1)}
                    />
                </PaginationItem>
                {pageNumbers(page, pageCount).map((val, idx, pages) => (
                    <Fragment key={val}>
                        {idx > 0 && val - pages[idx - 1] > 1 && (
                            <PaginationItem>
                                <PaginationEllipsis />
                            </PaginationItem>
                        )}
                        <PaginationItem>
                            <PaginationLink
                                href="#"
                                isActive={val === page}
                                onClick={handlePageChange(val)}
                            >
                                {val}
                            </PaginationLink>
                        </PaginationItem>
                    </Fragment>
                ))}
                <PaginationItem>
                    <PaginationNext
                        href="#"
                        aria-disabled={page === pageCount}
                        tabIndex={page === pageCount ? -1 : undefined}
                        className={
                            page === pageCount ? disabledClass : undefined
                        }
                        onClick={handlePageChange(page + 1)}
                    />
                </PaginationItem>
            </PaginationContent>
        </Pagination>
    );
}

export default ListPagination;
