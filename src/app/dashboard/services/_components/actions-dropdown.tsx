import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { MoreHorizontalIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AuthenticatedCloudRegistryProvider } from "@/lib/authenticated-cloud-registry";
import { mutationError } from "@/lib/errors";

type Props = {
    cloudRegistryProvider: AuthenticatedCloudRegistryProvider | null;
    rowData: ExternalService;
    fetchServices: () => void;
    onViewDetails: (service: ExternalService) => void;
};

function ActionDropdown(props: Props) {
    const { cloudRegistryProvider, rowData, fetchServices, onViewDetails } =
        props;

    const handleServiceDelete = async (id: string) => {
        if (!cloudRegistryProvider) return;

        const promise = cloudRegistryProvider.deleteService(id);

        toast.promise(promise, {
            loading: `Deleting service with ID - ${id}`,
            success: (response) => `Deleted service with ID - ${response}`,
            error: (err) =>
                mutationError(err, "Cannot delete service currently."),
        });

        try {
            await promise;
            await fetchServices();
        } catch {
            toast.error("Cannot update the service list.");
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                    <MoreHorizontalIcon />
                    <span className="sr-only">Open menu</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onViewDetails(rowData)}>
                    View
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href={`/dashboard/services/update/${rowData.id}`}>
                        Edit
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    variant="destructive"
                    onClick={() => handleServiceDelete(rowData.id)}
                >
                    Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default ActionDropdown;
