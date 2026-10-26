import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedCloudRegistryProvider } from "./authenticated-cloud-registry";

const base = "https://registry.example.org/ga4gh/registry/v1";
const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});

function lastRequest() {
    const [url, init] = fetchMock.mock.calls.at(-1) ?? [];
    const headers = new Headers(init?.headers);
    return {
        url,
        method: init?.method,
        auth: headers.get("Authorization"),
        body:
            init?.body === undefined
                ? undefined
                : JSON.parse(String(init.body)),
    };
}

describe("requests", () => {
    it("strips trailing slashes and takes options", () => {
        const provider = new AuthenticatedCloudRegistryProvider({
            baseUrl: `${base}//`,
            token: "t",
        });
        expect(provider.isAuthenticated).toBe(true);
        expect(
            new AuthenticatedCloudRegistryProvider(base).isAuthenticated,
        ).toBe(false);
    });

    it("sends public reads without the token", async () => {
        fetchMock.mockResolvedValue(json([{ id: "a" }]));
        const provider = new AuthenticatedCloudRegistryProvider(
            `${base}/`,
            "t",
        );
        expect(await provider.getServices()).toEqual([{ id: "a" }]);
        expect(lastRequest()).toMatchObject({
            url: `${base}/services`,
            method: "GET",
            auth: null,
        });
    });

    it("retries a public read with the token after a 401", async () => {
        fetchMock
            .mockResolvedValueOnce(json({}, 401))
            .mockResolvedValueOnce(json({ id: "a" }));
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        expect(await provider.getServiceById("a")).toEqual({ id: "a" });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(lastRequest().auth).toBe("Bearer t");
    });

    it("needs a token for authenticated operations", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base);
        await expect(provider.getCurrentUser()).rejects.toThrow(
            "Authentication is required",
        );
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("keeps status and problem details of failures", async () => {
        fetchMock.mockResolvedValue(
            json(
                { title: "Conflict", detail: "Duplicate", serviceId: "x" },
                409,
            ),
        );
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        await expect(provider.createService({} as never)).rejects.toMatchObject(
            {
                message: "Duplicate",
                status: 409,
                title: "Conflict",
                detail: "Duplicate",
                serviceId: "x",
            },
        );
    });

    it("words failures without details", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        fetchMock.mockResolvedValueOnce(json({ message: "Oops" }, 500));
        await expect(provider.getServices()).rejects.toThrow("Oops");
        fetchMock.mockResolvedValueOnce(
            new Response("<html>", { status: 502, statusText: "Bad Gateway" }),
        );
        await expect(provider.getServices()).rejects.toThrow(
            "Request failed: 502 Bad Gateway",
        );
        fetchMock.mockResolvedValueOnce(new Response("null", { status: 500 }));
        await expect(provider.getServices()).rejects.toMatchObject({
            message: "Request failed: 500",
            status: 500,
        });
    });

    it("returns nothing for empty and non-JSON responses", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
        expect(await provider.deleteService("a")).toBeUndefined();
        fetchMock.mockResolvedValueOnce(new Response("ok", { status: 200 }));
        expect(await provider.deleteService("a")).toBeUndefined();
    });

    it("encodes IDs and rejects dot segments", async () => {
        fetchMock.mockResolvedValue(json({}));
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        await provider.getServiceById("a/b?c");
        expect(lastRequest().url).toBe(`${base}/services/a%2Fb%3Fc`);
        for (const id of [".", ".."])
            await expect(provider.deleteService(id)).rejects.toThrow(
                "Invalid ID",
            );
    });
});

describe("operations", () => {
    const type = { group: "org.ga4gh", artifact: "tes", version: "1.1.0" };
    const service = { name: "s" } as never;
    const role = { role: "maintainer" } as never;

    it.each<
        [
            string,
            (p: AuthenticatedCloudRegistryProvider) => Promise<unknown>,
            string,
            string,
            boolean,
            unknown,
        ]
    >([
        [
            "getCurrentUser",
            (p) => p.getCurrentUser(),
            "GET",
            "/me",
            true,
            undefined,
        ],
        [
            "getServiceTypes",
            (p) => p.getServiceTypes(),
            "GET",
            "/services/types",
            false,
            undefined,
        ],
        [
            "addServiceType",
            (p) => p.addServiceType(type),
            "POST",
            "/services/types",
            true,
            type,
        ],
        [
            "removeServiceType",
            (p) => p.removeServiceType(type),
            "DELETE",
            "/services/types?group=org.ga4gh&artifact=tes&version=1.1.0",
            true,
            undefined,
        ],
        [
            "approveServiceType",
            (p) => p.approveServiceType({ ...type, extra: 1 } as never),
            "PUT",
            "/services/types/approval",
            true,
            type,
        ],
        [
            "getApprovals",
            (p) => p.getApprovals(),
            "GET",
            "/approvals",
            true,
            undefined,
        ],
        [
            "createService",
            (p) => p.createService(service),
            "POST",
            "/services",
            true,
            service,
        ],
        [
            "createServiceWithId",
            (p) => p.createServiceWithId("a", service),
            "PUT",
            "/services/a",
            true,
            service,
        ],
        [
            "updateService",
            (p) => p.updateService("a", service),
            "PUT",
            "/services/a",
            true,
            service,
        ],
        [
            "deleteService",
            (p) => p.deleteService("a"),
            "DELETE",
            "/services/a",
            true,
            undefined,
        ],
        [
            "getServicePermissions",
            (p) => p.getServicePermissions("a"),
            "GET",
            "/services/a/permissions",
            true,
            undefined,
        ],
        [
            "grantServicePermission",
            (p) => p.grantServicePermission("a", "u@x", role),
            "PUT",
            "/services/a/permissions/u%40x",
            true,
            role,
        ],
        [
            "revokeServicePermission",
            (p) => p.revokeServicePermission("a", "u"),
            "DELETE",
            "/services/a/permissions/u",
            true,
            undefined,
        ],
        [
            "grantGroupPermission",
            (p) => p.grantGroupPermission("a", "urn:g#x", role),
            "PUT",
            "/services/a/permissions/groups/urn%3Ag%23x",
            true,
            role,
        ],
        [
            "revokeGroupPermission",
            (p) => p.revokeGroupPermission("a", "g"),
            "DELETE",
            "/services/a/permissions/groups/g",
            true,
            undefined,
        ],
        [
            "getServiceVerification",
            (p) => p.getServiceVerification("a"),
            "GET",
            "/services/a/verification",
            false,
            undefined,
        ],
        [
            "verifyService",
            (p) => p.verifyService("a", role),
            "PUT",
            "/services/a/verification",
            true,
            role,
        ],
        [
            "removeServiceVerification",
            (p) => p.removeServiceVerification("a"),
            "DELETE",
            "/services/a/verification",
            true,
            undefined,
        ],
        [
            "getVerifications",
            (p) => p.getVerifications(),
            "GET",
            "/verifications",
            false,
            undefined,
        ],
        [
            "getServiceInfo",
            (p) => p.getServiceInfo(),
            "GET",
            "/service-info",
            false,
            undefined,
        ],
    ])("%s", async (_, call, method, path, authenticated, body) => {
        fetchMock.mockResolvedValue(json({ ok: true }));
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        expect(await call(provider)).toEqual({ ok: true });
        expect(lastRequest()).toEqual({
            url: `${base}${path}`,
            method,
            auth: authenticated ? "Bearer t" : null,
            body,
        });
    });
});

describe("hasApprovals", () => {
    // each test uses its own registry, as support is kept per base URL
    it("probes once without a token and keeps support", async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
        const provider = new AuthenticatedCloudRegistryProvider(
            `${base}/1`,
            "t",
        );
        expect(await provider.hasApprovals()).toBe(true);
        expect(await provider.hasApprovals()).toBe(true);
        expect(fetchMock).toHaveBeenCalledOnce();
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(`${base}/1/approvals`);
        expect(new Headers(init?.headers).get("Authorization")).toBeNull();
    });

    it("asks again after a 404 or a failure", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(`${base}/2`);
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
        expect(await provider.hasApprovals()).toBe(false);
        fetchMock.mockRejectedValueOnce(new TypeError("offline"));
        await expect(provider.hasApprovals()).rejects.toThrow("offline");
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
        expect(await provider.hasApprovals()).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
});
