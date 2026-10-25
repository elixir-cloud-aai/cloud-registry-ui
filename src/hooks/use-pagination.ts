import { useState } from "react";

export function usePagination<T>(items: T[], pageSize: number) {
    const [page, setPage] = useState(1);
    const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
    const currentPage = Math.min(page, pageCount);
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(currentPage * pageSize, items.length);
    const pageItems = items.slice(start, end);

    return { page: currentPage, pageCount, pageItems, start, end, setPage };
}
