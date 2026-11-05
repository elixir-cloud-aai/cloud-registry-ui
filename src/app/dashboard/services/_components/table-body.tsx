import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { useState } from "react";
import { PendingBadge } from "@/components/shared/pending";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useCloudRegistry } from "@/hooks";
import type {
    Me,
    ServiceSyncState,
    ServiceVerification,
} from "@/lib/cloud-registry.types";
import SyncBadge from "./sync-badge";
import VerifiedBadge from "./verified-badge";
import ServiceDetailsDialog from "./view-service-dailog";

type Props = {
    services: ExternalService[];
    verifications: Map<string, ServiceVerification>;
    syncs: Map<string, ServiceSyncState>;
    pending: Set<string>;
    fetchServices: () => void;
    refetchMe: () => void;
    me: Me | null;
    emptyMessage?: string;
};

function ServicesTableBody({
    services,
    verifications,
    syncs,
    pending,
    fetchServices,
    refetchMe,
    me,
    emptyMessage = "No services found.",
}: Props) {
    const { cloudRegistryProvider } = useCloudRegistry();
    const [selectedService, setSelectedService] =
        useState<ExternalService | null>(null);

    if (
        selectedService &&
        !services.some((val) => val.id === selectedService.id)
    )
        setSelectedService(null);

    // as loaded last, e.g. with the values of a sync
    const shownService =
        services.find((val) => val.id === selectedService?.id) ??
        selectedService;

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
                        <TableCell>
                            <div className="flex items-center gap-2">
                                {val.name}
                                {verifications.has(val.id) && <VerifiedBadge />}
                                <SyncBadge status={syncs.get(val.id)?.status} />
                                {pending.has(val.id) && <PendingBadge />}
                            </div>
                        </TableCell>
                        <TableCell>{val.organization.name}</TableCell>
                        <TableCell>{val.type.artifact}</TableCell>
                        <TableCell>{val.environment}</TableCell>
                        <TableCell>{val.version}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
            <ServiceDetailsDialog
                service={shownService}
                verification={
                    shownService
                        ? verifications.get(shownService.id)
                        : undefined
                }
                pending={!!shownService && pending.has(shownService.id)}
                open={!!shownService}
                fetchServices={fetchServices}
                refetchMe={refetchMe}
                cloudRegistryProvider={cloudRegistryProvider}
                me={me}
                onOpenChange={(open) => !open && setSelectedService(null)}
            />
        </>
    );
}

export default ServicesTableBody;
