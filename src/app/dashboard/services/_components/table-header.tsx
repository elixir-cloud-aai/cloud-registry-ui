import { TableHead, TableHeader, TableRow } from "@/components/ui/table";

function ServicesTableHeader() {
    return (
        <TableHeader>
            <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Artifact</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Version</TableHead>
            </TableRow>
        </TableHeader>
    );
}

export default ServicesTableHeader;
