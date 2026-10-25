import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { useState } from "react";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useCloudRegistry } from "@/hooks";
import type { Me } from "@/lib/cloud-registry.types";
import ServiceDetailsDialog from "./view-service-dailog";

type Props = {
    services: ExternalService[];
    fetchServices: () => void;
    me: Me | null;
    emptyMessage?: string;
};

function ServicesTableBody({
    services,
    fetchServices,
    me,
    emptyMessage = "No services found.",
}: Props) {
    const { cloudRegistryProvider } = useCloudRegistry();
    const [selectedService, setSelectedService] =
        useState<ExternalService | null>(null);

    if (services.length === 0)
        return (
            <TableBody>
                <TableRow>
                    <TableCell colSpan={6} className="text-center font-bold">
                        {emptyMessage}
                    </TableCell>
                </TableRow>
            </TableBody>
        );

    return (
        <>
            <TableBody>
                {services.map((val) => (
                    <TableRow
                        key={val.id}
                        onClick={() => setSelectedService(val)}
                        className="cursor-pointer"
                    >
                        <TableCell className="font-medium">{val.id}</TableCell>
                        <TableCell>{val.name}</TableCell>
                        <TableCell>{val.organization.name}</TableCell>
                        <TableCell>{val.type.artifact}</TableCell>
                        <TableCell>{val.environment}</TableCell>
                        <TableCell>{val.version}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
            <ServiceDetailsDialog
                service={selectedService}
                open={!!selectedService}
                fetchServices={fetchServices}
                cloudRegistryProvider={cloudRegistryProvider}
                me={me}
                onOpenChange={(open) => !open && setSelectedService(null)}
            />
        </>
    );
}

export default ServicesTableBody;
