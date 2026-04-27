import { AuthenticatedCloudRegistryProvider } from "@/lib/authenticated-cloud-registry";
import { getCookie } from "cookies-next/client";
import { useEffect, useState } from "react";

function useCloudRegistry() {
    const [cloudRegistryProvider, setCloudRegistryProvider] =
        useState<AuthenticatedCloudRegistryProvider | null>(null);

    useEffect(() => {
        const token = getCookie("access_token");
        if (!token) return;

        const provider = new AuthenticatedCloudRegistryProvider(
            process.env.NEXT_PUBLIC_CLOUD_REGISTRY_URL || "",
            token as string,
        );
        setCloudRegistryProvider(provider);
    }, []);

    return {
        cloudRegistryProvider,
    };
}

export { useCloudRegistry };
