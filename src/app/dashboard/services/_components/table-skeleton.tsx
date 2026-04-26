import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";

const columnWidths = ["w-[40px]", "w-[70px]", "w-[110px]", "w-[80px]", "w-[55px]", "w-[40px]"]

function ServiceTableBodySkeleton() {
    return (
        <TableBody>
          {Array.from({ length: 6 }).map((_, i) => (
            <TableRow key={i} style={{ opacity: 1 - i * 0.14 }}>
              {columnWidths.map((w, j) => (
                <TableCell key={j}>
                  <Skeleton className={`h-3 ${w}`} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
    );
}


export default ServiceTableBodySkeleton
