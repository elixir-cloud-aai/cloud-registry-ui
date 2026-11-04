import { describe, expect, it } from "vitest";
import { adminModeState, isAdminMode, requestRoles } from "./admin-mode";
import type { Me } from "./cloud-registry.types";

const me = (fields: Partial<Me>): Me => ({
    admin: false,
    services: [],
    user_id: "u",
    ...fields,
});

describe("isAdminMode", () => {
    it("reads the cookie's value", () => {
        expect(isAdminMode("1")).toBe(true);
        expect(isAdminMode(undefined)).toBe(false);
        expect(isAdminMode("0")).toBe(false);
        expect(isAdminMode("true")).toBe(false);
    });
});

describe("requestRoles", () => {
    it("asks for the admin role in admin mode only", () => {
        expect(requestRoles(true)).toEqual(["admin"]);
        expect(requestRoles(false)).toEqual([]);
    });
});

describe("adminModeState", () => {
    it("offers the switch to users who may be admins, in both modes", () => {
        expect(adminModeState(me({ admin_available: true }), false)).toBe(
            "user",
        );
        expect(
            adminModeState(me({ admin: true, admin_available: true }), true),
        ).toBe("admin");
    });

    it("lets users leave admin mode without admin rights", () => {
        // e.g. while requests fail, or if the registry ignores the header
        expect(adminModeState(null, true)).toBe("unavailable");
        expect(adminModeState(me({ admin_available: true }), true)).toBe(
            "unavailable",
        );
    });

    it("hides it from other users and guests", () => {
        expect(
            adminModeState(me({ admin_available: false }), false),
        ).toBeUndefined();
        expect(adminModeState(null, false)).toBeUndefined();
    });

    it("hides it in registries without admin mode", () => {
        // admins without asking for the role
        expect(
            adminModeState(me({ admin: true, admin_available: true }), false),
        ).toBeUndefined();
        // registries before admin mode
        expect(adminModeState(me({ admin: true }), false)).toBeUndefined();
    });
});
