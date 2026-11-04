import { getCookie } from "cookies-next/client";
import { useEffect, useState } from "react";
import { adminModeCookie, isAdminMode, requestRoles } from "@/lib/admin-mode";
import { AuthenticatedCloudRegistryProvider } from "@/lib/authenticated-cloud-registry";
import { publicSetting } from "@/lib/public-settings";

function useCloudRegistry() {
    const token = getCookie("access_token");
    const [cloudRegistryProvider, setCloudRegistryProvider] =
        useState<AuthenticatedCloudRegistryProvider | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        let provider;
        if (!token)
            provider = new AuthenticatedCloudRegistryProvider(
                publicSetting("NEXT_PUBLIC_CLOUD_REGISTRY_URL") || "",
            );
        else
            provider = new AuthenticatedCloudRegistryProvider({
                baseUrl: publicSetting("NEXT_PUBLIC_CLOUD_REGISTRY_URL") || "",
                token: token as string,
                roles: requestRoles(isAdminMode(getCookie(adminModeCookie))),
            });
        setIsLoggedIn(!!token);
        setCloudRegistryProvider(provider);
    }, [token]);

    return {
        cloudRegistryProvider,
        isLoggedIn,
    };
}

export { useCloudRegistry };
