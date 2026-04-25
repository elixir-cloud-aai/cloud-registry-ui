"use server"
import axios from "axios"
import { getCookie } from "cookies-next/server"
import { cookies } from "next/headers"

type Res = {
    error: boolean;
    user: User | null
}

async function getUserInfo() : Promise<Res> {
    const accessToken = await getCookie("access_token", { cookies })

    try {
        const res = await axios.get(`${process.env.LS_LOGIN_URL}/oidc/userinfo`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json"
            }
        })

        if (!res.data || typeof res.data !== "object") {
            throw new Error("Invalid JSON response")
        }

        return {
            error: false,
            user: res.data
        }

    } catch {
        return {
            error: true,
            user: null
        }
    }
}

export default getUserInfo