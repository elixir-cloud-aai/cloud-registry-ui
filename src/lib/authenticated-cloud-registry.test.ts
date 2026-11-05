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

describe("importServiceInfo", () => {
    it("sends the address with the user's token, and returns the values", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        const values = { name: "TES" };
        fetchMock.mockResolvedValue(json(values));
        const address = "https://tes.example.org/ga4gh/tes/v1/service-info";
        await expect(provider.importServiceInfo(address)).resolves.toEqual(
            values,
        );
        expect(lastRequest()).toEqual({
            url: `${base}/services/import`,
            method: "POST",
            auth: "Bearer t",
            body: { serviceInfoUrl: address },
        });
    });
});

describe("getServicesAsUser", () => {
    it("reads with the user's token", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        fetchMock.mockResolvedValue(json([]));
        await provider.getServicesAsUser();
        expect(lastRequest()).toMatchObject({
            url: `${base}/services`,
            auth: "Bearer t",
        });
    });
});

describe("syncService", () => {
    it("can ask to sync only if sync is on", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        fetchMock.mockResolvedValue(json({ status: "synced" }));
        await provider.syncService("a", { onlyIfEnabled: true });
        expect(lastRequest().url).toBe(
            `${base}/services/a/sync?onlyIfEnabled=true`,
        );
    });

    it("turns sync on with the user's token, and returns the state", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        const state = { status: "synced" };
        fetchMock.mockResolvedValue(json(state));
        await expect(provider.syncService("a/b")).resolves.toEqual(state);
        expect(lastRequest()).toEqual({
            url: `${base}/services/a%2Fb/sync`,
            method: "PUT",
            auth: "Bearer t",
            body: undefined,
        });
    });
});

describe("removeServiceSync", () => {
    it("turns sync off with the user's token", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        fetchMock.mockResolvedValue(json("a/b"));
        await expect(provider.removeServiceSync("a/b")).resolves.toBe("a/b");
        expect(lastRequest()).toMatchObject({
            url: `${base}/services/a%2Fb/sync`,
            method: "DELETE",
            auth: "Bearer t",
        });
    });
});

describe("notifications", () => {
    it("reads them with the user's token", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        fetchMock.mockResolvedValue(json([]));
        await expect(provider.getNotifications()).resolves.toEqual([]);
        expect(lastRequest()).toMatchObject({
            url: `${base}/notifications`,
            method: "GET",
            auth: "Bearer t",
        });
    });

    it("dismisses one with the user's token", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        fetchMock.mockResolvedValue(json("a/b"));
        await expect(provider.dismissNotification("a/b")).resolves.toBe("a/b");
        expect(lastRequest()).toMatchObject({
            url: `${base}/notifications/a%2Fb`,
            method: "DELETE",
            auth: "Bearer t",
        });
    });
});

describe("getServiceSync", () => {
    it("reads the state with the token of logged-in users", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        fetchMock.mockResolvedValue(json({ status: "synced" }));
        await provider.getServiceSync("a");
        expect(lastRequest()).toMatchObject({
            url: `${base}/services/a/sync`,
            method: "GET",
            auth: "Bearer t",
        });
    });

    it("reads the state without a token for guests", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base);
        fetchMock.mockResolvedValue(json({ status: "synced" }));
        await provider.getServiceSync("a");
        expect(lastRequest().auth).toBeNull();
    });
});

describe("getSyncs", () => {
    it("lists the states", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base);
        const states = [{ serviceId: "a", status: "synced" }];
        fetchMock.mockResolvedValue(json(states));
        await expect(provider.getSyncs()).resolves.toEqual(states);
        expect(lastRequest().url).toBe(`${base}/syncs`);
    });

    it("reads like a guest with an expired token", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        fetchMock
            .mockResolvedValueOnce(json({ status: 401 }, 401))
            .mockResolvedValueOnce(json([]));
        await expect(provider.getSyncs()).resolves.toEqual([]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(lastRequest().auth).toBeNull();
    });

    it("reports the expired token if guests can't read it either", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        fetchMock
            .mockResolvedValueOnce(json({ status: 401 }, 401))
            .mockResolvedValueOnce(json({ status: 404 }, 404));
        await expect(provider.getServiceSync("a")).rejects.toMatchObject({
            status: 401,
        });
    });

    it("passes on other failures", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        fetchMock.mockResolvedValue(json({ status: 500 }, 500));
        await expect(provider.getSyncs()).rejects.toMatchObject({
            status: 500,
        });
    });

    it("passes on the 401 of a deployment that requires login", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base);
        fetchMock.mockResolvedValue(json({ status: 401 }, 401));
        await expect(provider.getSyncs()).rejects.toMatchObject({
            status: 401,
        });
    });
});

describe("revokeServicePermission", () => {
    it("takes the registry's answer for the requested user", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        fetchMock.mockResolvedValue(json("bob@x"));
        await expect(
            provider.revokeServicePermission("a", "bob@x"),
        ).resolves.toBe("bob@x");
    });

    it("takes an answer that names no user", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
        await expect(
            provider.revokeServicePermission("a", "bob@x"),
        ).resolves.toBeUndefined();
    });

    it("fails if the registry removed the role of another user", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        fetchMock.mockResolvedValue(json("users/bob@x"));
        await expect(
            provider.revokeServicePermission("a", "bob@x"),
        ).rejects.toMatchObject({
            detail: "This registry is too old for this version of the app: it removed the role of 'users/bob@x', not of 'bob@x'. Ask its admins to upgrade it; until then, this app can't change the roles of users.",
        });
    });
});

describe("IDs with dot segments", () => {
    it.each(["a/../b", "x/..", "../x", "a/./b", "a\\..\\b"])(
        "%s is refused without a request",
        async (id) => {
            const provider = new AuthenticatedCloudRegistryProvider(base, "t");
            await expect(
                provider.revokeServicePermission("a", id),
            ).rejects.toMatchObject({
                detail: `The app can't change the role of '${id}', as IDs can't have the parts '.' or '..'.`,
            });
            expect(fetchMock).not.toHaveBeenCalled();
        },
    );
});

describe("IDs with a leading slash", () => {
    it("are refused with a message for the user", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        await expect(
            provider.revokeServicePermission("a", "/u"),
        ).rejects.toMatchObject({
            detail: "The app can't change the role of '/u', as IDs can't start with '/'.",
        });
    });
});

describe("grantServicePermission", () => {
    const role = { role: "owner" } as const;

    it("takes the registry's answer for the requested user", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        const granted = { userId: "bob@x", role: "owner" };
        fetchMock.mockResolvedValue(json(granted));
        await expect(
            provider.grantServicePermission("a", "bob@x", role),
        ).resolves.toEqual(granted);
    });

    it("takes an answer that names no user", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
        await expect(
            provider.grantServicePermission("a", "bob@x", role),
        ).resolves.toBeUndefined();
    });

    it.each([
        ["userId"],
        // as cloud-registry 0.6.0 and 1.0.0rc1 answer
        ["user_id"],
    ])(
        "fails if the registry granted the role to another user (%s)",
        async (field) => {
            const provider = new AuthenticatedCloudRegistryProvider(base, "t");
            fetchMock.mockResolvedValue(
                json({ [field]: "users/bob@x", role: "owner" }),
            );
            const error = await provider
                .grantServicePermission("a", "bob@x", role)
                .catch((err: unknown) => err);
            expect(error).toBeInstanceOf(Error);
            expect(error).toMatchObject({
                detail: "This registry is too old for this version of the app: it granted the role to 'users/bob@x', not to 'bob@x'. Ask its admins to upgrade it; until then, this app can't change the roles of users.",
            });
        },
    );
});

describe("requests", () => {
    it("strips trailing slashes and takes options", async () => {
        const provider = new AuthenticatedCloudRegistryProvider({
            baseUrl: `${base}//`,
            token: "t",
        });
        expect(provider.isAuthenticated).toBe(true);
        fetchMock.mockResolvedValue(json({ admin: false }));
        await provider.getCurrentUser();
        expect(lastRequest()).toMatchObject({
            url: `${base}/me`,
            auth: "Bearer t",
        });
        expect(
            new AuthenticatedCloudRegistryProvider(base).isAuthenticated,
        ).toBe(false);
    });

    it("asks for opt-in roles in authenticated requests only", async () => {
        const provider = new AuthenticatedCloudRegistryProvider({
            baseUrl: base,
            token: "t",
            roles: ["admin"],
        });
        fetchMock.mockResolvedValue(json({ admin: true }));
        await provider.getCurrentUser();
        expect(
            new Headers(fetchMock.mock.calls.at(-1)?.[1]?.headers).get(
                "X-Request-Roles",
            ),
        ).toBe("admin");
        // public reads go without the token, and so without roles
        fetchMock.mockResolvedValue(json([]));
        await provider.getServices();
        expect(
            new Headers(fetchMock.mock.calls.at(-1)?.[1]?.headers).has(
                "X-Request-Roles",
            ),
        ).toBe(false);
        // no roles by default
        fetchMock.mockImplementation(async () => json({ admin: false }));
        await new AuthenticatedCloudRegistryProvider({
            baseUrl: base,
            token: "t",
            roles: undefined,
        }).getCurrentUser();
        await new AuthenticatedCloudRegistryProvider(
            base,
            "t",
        ).getCurrentUser();
        for (const [, init] of fetchMock.mock.calls.slice(-2))
            expect(new Headers(init?.headers).has("X-Request-Roles")).toBe(
                false,
            );
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
                {
                    title: "Conflict",
                    detail: "Duplicate",
                    code: "duplicate-service",
                    serviceId: "x",
                },
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
                code: "duplicate-service",
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
            "renameService",
            (p) => p.renameService("a", "b c"),
            "POST",
            "/services/a/rename",
            true,
            { id: "b c" },
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
            "/services/a/permissions/users/u%40x",
            true,
            role,
        ],
        [
            "grantServicePermission, ID with slashes",
            (p) => p.grantServicePermission("a", "https://i.org/u", role),
            "PUT",
            "/services/a/permissions/users/https%3A%2F%2Fi.org%2Fu",
            true,
            role,
        ],
        [
            "grantServicePermission, user called like the groups' path",
            (p) => p.grantServicePermission("a", "groups", role),
            "PUT",
            "/services/a/permissions/users/groups",
            true,
            role,
        ],
        [
            "grantServicePermission, ID starting like the groups' path",
            (p) => p.grantServicePermission("a", "groups/g", role),
            "PUT",
            "/services/a/permissions/users/groups%2Fg",
            true,
            role,
        ],
        [
            "revokeServicePermission",
            (p) => p.revokeServicePermission("a", "u"),
            "DELETE",
            "/services/a/permissions/users/u",
            true,
            undefined,
        ],
        [
            "revokeServicePermission, ID with slashes",
            (p) => p.revokeServicePermission("a", "https://i.org/u"),
            "DELETE",
            "/services/a/permissions/users/https%3A%2F%2Fi.org%2Fu",
            true,
            undefined,
        ],
        [
            "revokeServicePermission, ID starting like the groups' path",
            (p) => p.revokeServicePermission("a", "groups/g"),
            "DELETE",
            "/services/a/permissions/users/groups%2Fg",
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
            "createInvitation",
            (p) => p.createInvitation("a", role),
            "POST",
            "/services/a/invitations",
            true,
            role,
        ],
        [
            "getServiceInvitations",
            (p) => p.getServiceInvitations("a"),
            "GET",
            "/services/a/invitations",
            true,
            undefined,
        ],
        [
            "revokeInvitation",
            (p) => p.revokeInvitation("a", "i/1"),
            "DELETE",
            "/services/a/invitations/i%2F1",
            true,
            undefined,
        ],
        [
            "acceptInvitation",
            (p) => p.acceptInvitation("tok"),
            "POST",
            "/invitations/accept",
            true,
            { token: "tok" },
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

describe("user IDs and groups with a leading slash", () => {
    // the path would have a double slash, which the registry redirects to
    // that of another user or group
    it.each<
        [string, (p: AuthenticatedCloudRegistryProvider) => Promise<unknown>]
    >([
        [
            "grantServicePermission",
            (p) => p.grantServicePermission("a", "/u", { role: "owner" }),
        ],
        [
            "revokeServicePermission",
            (p) => p.revokeServicePermission("a", "/u"),
        ],
        [
            "grantGroupPermission",
            (p) => p.grantGroupPermission("a", "/g", { role: "owner" }),
        ],
        ["revokeGroupPermission", (p) => p.revokeGroupPermission("a", "/g")],
    ])("%s refuses them without a request", async (_, call) => {
        const provider = new AuthenticatedCloudRegistryProvider(base, "t");
        await expect(call(provider)).rejects.toThrow("Invalid ID");
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("listing of the registry", () => {
    const provider = () =>
        new AuthenticatedCloudRegistryProvider({
            baseUrl: base,
            token: "t",
            roles: ["admin"],
        });
    const operations: [
        string,
        (p: AuthenticatedCloudRegistryProvider) => Promise<unknown>,
    ][] = [
        ["GET", (p) => p.getSelfListing()],
        ["PUT", (p) => p.addSelfListing()],
        ["DELETE", (p) => p.removeSelfListing()],
    ];

    it.each(operations)("%s asks as an admin", async (method, call) => {
        fetchMock.mockResolvedValue(json({ listed: false }));
        await call(provider());
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(`${base}/service-info/listing`);
        expect(init?.method).toBe(method);
        const headers = new Headers(init?.headers);
        expect(headers.get("Authorization")).toBe("Bearer t");
        expect(headers.get("X-Request-Roles")).toBe("admin");
    });

    it("needs a login", async () => {
        const guest = new AuthenticatedCloudRegistryProvider(base);
        await expect(guest.getSelfListing()).rejects.toThrow(
            "Authentication is required",
        );
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each(operations)("%s reads a listed registry", async (_, call) => {
        fetchMock.mockResolvedValue(
            json({ listed: true, serviceId: "org.example.registry" }, 201),
        );
        await expect(call(provider())).resolves.toEqual({
            listed: true,
            serviceId: "org.example.registry",
        });
    });

    it.each(operations)("%s reads a registry not listed", async (_, call) => {
        fetchMock.mockResolvedValue(json({ listed: false }));
        await expect(call(provider())).resolves.toEqual({ listed: false });
    });

    it("leaves out an identifier that is no text", async () => {
        fetchMock.mockResolvedValue(json({ listed: true, serviceId: 1 }));
        await expect(provider().getSelfListing()).resolves.toEqual({
            listed: true,
        });
    });

    it.each([
        ["no state", json({})],
        ["another type of state", json({ listed: "yes" })],
        ["no JSON", new Response("<html></html>", { status: 200 })],
    ])("fails with %s", async (_, response) => {
        fetchMock.mockResolvedValue(response);
        await expect(provider().getSelfListing()).rejects.toThrow(
            "The registry's answer doesn't say whether it is listed.",
        );
    });

    it("keeps the code and the service of a conflict", async () => {
        fetchMock.mockResolvedValue(
            json(
                {
                    detail: "Registered.",
                    code: "duplicate-service",
                    serviceId: "other",
                },
                409,
            ),
        );
        await expect(provider().addSelfListing()).rejects.toMatchObject({
            status: 409,
            detail: "Registered.",
            code: "duplicate-service",
            serviceId: "other",
        });
    });
});

describe("servicesPath", () => {
    it.each([
        [base, "/ga4gh/registry/v1/services"],
        [`${base}/`, "/ga4gh/registry/v1/services"],
        ["https://registry.example.org", "/services"],
        ["", "/services"],
        ["https://registry.example.org/r%C3%A9g", "/rég/services"],
        ["https://registry.example.org/%E0%A4%A", "/%E0%A4%A/services"],
    ])("of %j is %j", (url, path) => {
        expect(new AuthenticatedCloudRegistryProvider(url).servicesPath).toBe(
            path,
        );
    });
});

describe("hasApprovals", () => {
    // each test uses its own registry, as support is kept per base URL
    const unauthorized = () => new Response(null, { status: 401 });
    const authorization = (call: number) =>
        new Headers(fetchMock.mock.calls[call][1]?.headers).get(
            "Authorization",
        );

    it("trusts published rules without requesting the route", async () => {
        fetchMock.mockResolvedValueOnce(json({ registrationRules: {} }));
        const provider = new AuthenticatedCloudRegistryProvider(
            `${base}/1`,
            "t",
        );
        expect(await provider.hasApprovals()).toBe(true);
        expect(await provider.hasApprovals()).toBe(true);
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(fetchMock.mock.calls[0][0]).toBe(`${base}/1/service-info`);
        expect(authorization(0)).toBeNull();
    });

    it("probes registries without rules, without a token", async () => {
        fetchMock
            .mockResolvedValueOnce(json({ id: "older" }))
            .mockResolvedValueOnce(unauthorized());
        const provider = new AuthenticatedCloudRegistryProvider(
            `${base}/2`,
            "t",
        );
        expect(await provider.hasApprovals()).toBe(true);
        expect(await provider.hasApprovals()).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1][0]).toBe(`${base}/2/approvals`);
        expect(authorization(1)).toBeNull();
    });

    it.each([
        ["fails", () => new Response(null, { status: 500 })],
        ["needs a login", unauthorized],
        ["isn't JSON", () => new Response("<html>")],
        ["has empty rules", () => json({ registrationRules: null })],
    ])("probes if the service info %s", async (name, response) => {
        fetchMock
            .mockResolvedValueOnce(response())
            .mockResolvedValueOnce(unauthorized());
        const provider = new AuthenticatedCloudRegistryProvider(
            `${base}/3/${name}`,
        );
        expect(await provider.hasApprovals()).toBe(true);
        expect(fetchMock.mock.calls[1][0]).toBe(`${base}/3/${name}/approvals`);
    });

    it("probes if the service info can't be reached", async () => {
        fetchMock
            .mockRejectedValueOnce(new TypeError("offline"))
            .mockResolvedValueOnce(unauthorized());
        const provider = new AuthenticatedCloudRegistryProvider(`${base}/6`);
        expect(await provider.hasApprovals()).toBe(true);
        expect(fetchMock.mock.calls[1][0]).toBe(`${base}/6/approvals`);
    });

    it("asks again after a 404", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(`${base}/4`);
        fetchMock
            .mockResolvedValueOnce(json({ id: "older" }))
            .mockResolvedValueOnce(new Response(null, { status: 404 }));
        expect(await provider.hasApprovals()).toBe(false);
        fetchMock.mockResolvedValueOnce(json({ registrationRules: {} }));
        expect(await provider.hasApprovals()).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("asks again after a failure", async () => {
        const provider = new AuthenticatedCloudRegistryProvider(`${base}/7`);
        fetchMock
            .mockRejectedValueOnce(new TypeError("offline"))
            .mockRejectedValueOnce(new TypeError("offline"));
        await expect(provider.hasApprovals()).rejects.toThrow("offline");
        fetchMock.mockResolvedValueOnce(json({ registrationRules: {} }));
        expect(await provider.hasApprovals()).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("gives each request a timeout of its own", async () => {
        fetchMock
            .mockResolvedValueOnce(json({ id: "older" }))
            .mockResolvedValueOnce(unauthorized());
        const timeout = vi.spyOn(AbortSignal, "timeout");
        const provider = new AuthenticatedCloudRegistryProvider(`${base}/5`);
        await provider.hasApprovals();
        expect(timeout.mock.calls).toEqual([[5_000], [10_000]]);
        const [first, second] = fetchMock.mock.calls;
        expect(first[1]?.signal).toBe(timeout.mock.results[0].value);
        expect(second[1]?.signal).toBe(timeout.mock.results[1].value);
        timeout.mockRestore();
    });
});
