import { describe, expect, it } from "vitest";
import type { Me } from "./cloud-registry.types";
import {
    canApproveServiceType,
    canDeleteService,
    canEditService,
    canManageAccess,
    canVerifyService,
    hasStatus,
    isConflict,
    isForbidden,
    isUnauthorized,
} from "./permissions";

const me = (admin: boolean, services: [string, string][] = []) =>
    ({
        admin,
        services: services.map(([service_id, role]) => ({ service_id, role })),
    }) as unknown as Me;
const failure = (status: number) => Object.assign(new Error("x"), { status });

describe("service permissions", () => {
    const owner = me(false, [["s1", "owner"]]);
    const maintainer = me(false, [["s1", "maintainer"]]);
    const viewer = me(false, [["s1", "viewer"]]);
    const admin = me(true);

    it.each([
        ["admin", admin, true, true, true],
        ["owner", owner, true, true, true],
        ["maintainer", maintainer, true, false, false],
        ["viewer", viewer, false, false, false],
        ["anonymous", null, false, false, false],
    ])("%s: edit, delete, manage access", (_, user, edit, del, manage) => {
        expect(canEditService(user, "s1")).toBe(edit);
        expect(canDeleteService(user, "s1")).toBe(del);
        expect(canManageAccess(user, "s1")).toBe(manage);
    });

    it("applies roles to their service only", () => {
        expect(canEditService(owner, "s2")).toBe(false);
        expect(canDeleteService(owner, "s2")).toBe(false);
    });

    it("lets only admins verify and approve", () => {
        expect(canVerifyService(admin)).toBe(true);
        expect(canApproveServiceType(admin)).toBe(true);
        for (const user of [owner, null]) {
            expect(canVerifyService(user)).toBe(false);
            expect(canApproveServiceType(user)).toBe(false);
        }
    });
});

describe("request failures", () => {
    it("tells statuses apart", () => {
        expect(isUnauthorized(failure(401))).toBe(true);
        expect(isForbidden(failure(403))).toBe(true);
        expect(isConflict(failure(409))).toBe(true);
        expect(isUnauthorized(failure(403))).toBe(false);
        expect(hasStatus(failure(500), 500)).toBe(true);
    });

    it("needs an error with a status", () => {
        expect(isUnauthorized(new Error("x"))).toBe(false);
        expect(isUnauthorized({ status: 401 })).toBe(false);
        expect(isUnauthorized(undefined)).toBe(false);
    });
});
