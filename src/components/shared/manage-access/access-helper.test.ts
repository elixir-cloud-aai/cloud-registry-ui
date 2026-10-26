import { describe, expect, it } from "vitest";
import { failure } from "@/test/errors";
import {
    accessError,
    defaultGrant,
    grantSchema,
    isGroup,
    listError,
    roleOptions,
} from "./access-helper";

const issues = (data: object) =>
    grantSchema
        .safeParse({ ...defaultGrant, ...data })
        .error?.issues.map((val) => val.message);

describe("grantSchema", () => {
    it("accepts users and groups, trimmed", () => {
        expect(
            grantSchema.parse({ ...defaultGrant, principal: " bob " }),
        ).toEqual({ kind: "user", principal: "bob", role: "maintainer" });
        expect(
            issues({
                kind: "group",
                principal: "urn:geant:x#y",
                role: "owner",
            }),
        ).toBeUndefined();
    });

    it.each([
        [{ principal: " " }, "User ID is required."],
        [{ kind: "group", principal: "" }, "Group is required."],
        [
            { kind: "group", principal: "/admins" },
            "Group can't start with '/'.",
        ],
        [{ principal: ".." }, "User ID can't consist of dots only."],
        [
            { kind: "group", principal: "." },
            "Group can't consist of dots only.",
        ],
    ])("rejects %j", (data, message) => {
        expect(issues(data)).toEqual([message]);
    });

    it("offers the roles that can be granted", () => {
        expect(roleOptions).toEqual([
            { label: "Owner", value: "owner" },
            { label: "Maintainer", value: "maintainer" },
        ]);
        expect(issues({ role: "admin" })).toHaveLength(1);
    });
});

describe("access helpers", () => {
    it("tells groups from users", () => {
        expect(isGroup({ group: "g", role: "owner" } as never)).toBe(true);
        expect(isGroup({ user_id: "u", role: "owner" } as never)).toBe(false);
    });

    it("words failures", () => {
        expect(listError(failure(500))).toBe(
            "Cannot fetch the access list. Please try again later.",
        );
        expect(listError(failure(404, { detail: "Not found" }))).toBe(
            "Not found",
        );
        expect(accessError(failure(409))).toBe(
            "Add another owner first, or delete the service.",
        );
        expect(accessError(failure(403), true)).toBe(
            "You can grant roles only to groups you are a member of.",
        );
        expect(accessError(failure(403))).toBe(
            "You don't have permission to change this service.",
        );
        expect(accessError(failure(500))).toBe(
            "Cannot change access currently.",
        );
    });
});
