import { getCookie } from "cookies-next/client";
import { useEffect, useState } from "react";
import { adminModeCookie, isAdminMode, requestRoles } from "@/lib/admin-mode";
import { AuthenticatedCloudRegistryProvider } from "@/lib/authenticated-cloud-registry";

function useCloudRegistry() {
    const [cloudRegistryProvider, setCloudRegistryProvider] =
        useState<AuthenticatedCloudRegistryProvider | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const token = getCookie("access_token");
        let provider;
        if (!token)
            provider = new AuthenticatedCloudRegistryProvider(
                process.env.NEXT_PUBLIC_CLOUD_REGISTRY_URL || "",
            );
        else
            provider = new AuthenticatedCloudRegistryProvider({
                baseUrl: process.env.NEXT_PUBLIC_CLOUD_REGISTRY_URL || "",
                token: token as string,
                roles: requestRoles(isAdminMode(getCookie(adminModeCookie))),
            });
        setIsLoggedIn(!!token);
        setCloudRegistryProvider(provider);
    }, []);

    return {
        cloudRegistryProvider,
        isLoggedIn,
    };
}

export { useCloudRegistry };
