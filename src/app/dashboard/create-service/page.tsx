"use client"
import { useCloudRegistry } from "@/hooks";
import { EccServiceCreatedEvent, EccServiceCreateFailedEvent, EccServiceCreateValidationFailedEvent } from "@elixir-cloud/cloud-registry/events";
import { ECCClientElixirCloudRegistryServiceCreate } from "@elixir-cloud/cloud-registry/react";
import { toast } from "sonner";

function Page() {
    const { cloudRegistryProvider } = useCloudRegistry();

    const onServiceCreated = (e : EccServiceCreatedEvent) => {
        toast.success(e.detail.message)
    }

    const onServiceCreationFailed = (e : EccServiceCreateFailedEvent) => {
        toast.error(e.detail.error)
    }

    const onValidationError = (e : EccServiceCreateValidationFailedEvent) => {
        toast.error(e.detail.error)
    }

    if (cloudRegistryProvider !== null)
        return (
            <div className="max-w-5xl mx-auto mt-5 md:mt-8">
                <ECCClientElixirCloudRegistryServiceCreate 
                onEccServiceCreated={onServiceCreated}
                onEccServiceCreateFailed={onServiceCreationFailed}
                onEccServiceCreateValidationFailed={onValidationError}
                provider={cloudRegistryProvider} />
            </div>
        );
}

export default Page;
