import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useCloudRegistry } from "@/hooks";
import { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { useState } from "react";
import ServiceDetailsDialog from "./view-service-dailog";

type Props = {
    services: ExternalService[];
    fetchServices: () => void;
};

function ServicesTableBody({ services, fetchServices }: Props) {
    const { cloudRegistryProvider } = useCloudRegistry();
    const [selectedService, setSelectedService] = useState<ExternalService | null>(null);

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
                onOpenChange={(open) => !open && setSelectedService(null)}
            />
        </>
    );
}

export default ServicesTableBody;
