import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { MoreHorizontalIcon } from "lucide-react";

type Props = {
    services: ExternalService[];
};

function ServicesTableBody({ services }: Props) {
    if (services.length === 0)
        return (
            <TableBody>
                <TableRow>
                    <TableCell colSpan={6} className="text-center font-bold">
                        No services found.
                    </TableCell>
                </TableRow>
            </TableBody>
        );

    return (
        <TableBody>
            {services.map((val, idx) => (
                <TableRow key={idx + Math.random()}>
                    <TableCell className="font-medium">{val.id}</TableCell>
                    <TableCell>{val.name}</TableCell>
                    <TableCell>{val.organization.name}</TableCell>
                    <TableCell>{val.environment}</TableCell>
                    <TableCell>{val.version}</TableCell>
                    <TableCell>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8">
                                    <MoreHorizontalIcon />
                                    <span className="sr-only">Open menu</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem>View</DropdownMenuItem>
                                <DropdownMenuItem>Edit</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                </TableRow>
            ))}
        </TableBody>
    );
}

export default ServicesTableBody;
