import { getCookie } from "cookies-next/client";
import { useEffect, useState } from "react";
import { AuthenticatedCloudRegistryProvider } from "@/lib/authenticated-cloud-registry";

function useCloudRegistry() {
    const token = getCookie("access_token");
    const [cloudRegistryProvider, setCloudRegistryProvider] =
        useState<AuthenticatedCloudRegistryProvider | null>(null);

    useEffect(() => {
        let provider;
        if (!token)
            provider = new AuthenticatedCloudRegistryProvider(
                process.env.NEXT_PUBLIC_CLOUD_REGISTRY_URL || "",
            );
        else
            provider = new AuthenticatedCloudRegistryProvider(
                process.env.NEXT_PUBLIC_CLOUD_REGISTRY_URL || "",
                token as string,
            );
        setCloudRegistryProvider(provider);
    }, [token]);

    return {
        cloudRegistryProvider,
    };
}

export { useCloudRegistry };
