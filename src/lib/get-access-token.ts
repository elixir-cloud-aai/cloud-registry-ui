"use server"
import { getCookie } from "cookies-next/server"
import { cookies } from "next/headers"

async function getAccessToken() {
    const accessToken = await getCookie("access_token", { cookies })
    return accessToken
}

export { getAccessToken }

