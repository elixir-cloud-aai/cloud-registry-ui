import { TableCell, TableFooter, TableRow } from "@/components/ui/table";


function ServicesTableFooter() {
    return (
        <TableFooter>
            <TableRow>
                <TableCell colSpan={6}>{"-"}</TableCell>
            </TableRow>
        </TableFooter>
    )
}


export default ServicesTableFooter;