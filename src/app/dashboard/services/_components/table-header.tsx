import { TableCell, TableHeader, TableRow } from "@/components/ui/table";

function ServicesTableHeader() {
    return (
        <TableHeader>
            <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Organization</TableCell>
                <TableCell>Envirnoment</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Actions</TableCell>
            </TableRow>
        </TableHeader>
    );
}

export default ServicesTableHeader;
