import { default as getUserInfo } from "@/lib/get-user-info";
import { AxiosError } from "axios";
import { useCallback, useEffect, useState } from "react";

export function useUserInfo() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<boolean>(false);

    const fetchUserInfo = useCallback(async () => {
        setLoading(true);
        setError(false);

        try {
            const userResp = await getUserInfo()
            if(userResp.error === false)
                setUser(userResp.user);
            else
                setError(true)
        } catch (e: any) {
            e = e as AxiosError;
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUserInfo()
    }, [fetchUserInfo]);

    return { user, loading, error, refetch: fetchUserInfo };
}
