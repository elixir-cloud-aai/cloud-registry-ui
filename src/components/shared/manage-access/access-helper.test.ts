import { describe, expect, it } from "vitest";
import { failure } from "@/test/errors";
import {
    accessError,
    defaultGrant,
    filterHolders,
    grantSchema,
    isGroup,
    listError,
    roleOptions,
    userName,
} from "./access-helper";

const issues = (data: object) =>
    grantSchema
        .safeParse({ ...defaultGrant, ...data })
        .error?.issues.map((val) => val.message);

describe("grantSchema", () => {
    it.each(["...", "a..b", "a/.../b", ".hidden", "a./b", "https://i.org/u"])(
        "accepts %s, which has no dot segments",
        (principal) => {
            expect(issues({ principal })).toBeUndefined();
        },
    );

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
        [{ principal: "/bob" }, "User ID can't start with '/'."],
        [{ principal: ".." }, "User ID can't have the parts '.' or '..'."],
        [
            { kind: "group", principal: "." },
            "Group can't have the parts '.' or '..'.",
        ],
        [{ principal: "a/../b" }, "User ID can't have the parts '.' or '..'."],
        [{ principal: "x/.." }, "User ID can't have the parts '.' or '..'."],
        [{ principal: "../x" }, "User ID can't have the parts '.' or '..'."],
        [{ principal: "a/./b" }, "User ID can't have the parts '.' or '..'."],
        [{ principal: "a\\..\\b" }, "User ID can't have the parts '.' or '..'."],
        [
            { kind: "group", principal: "a/../b" },
            "Group can't have the parts '.' or '..'.",
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
        expect(accessError(failure(409, { code: "last-owner" }))).toBe(
            "Add another owner first, or delete the service.",
        );
        expect(
            accessError(
                failure(409, { detail: "Rule set.", code: "conflict" }),
            ),
        ).toBe("Rule set.");
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

describe("role holders", () => {
    const holders = [
        { user_id: "bob@example.org", name: "Bob Builder", role: "owner" },
        { user_id: "carol@example.org", role: "maintainer" },
        { group: "urn:example:compute-team", role: "maintainer" },
    ] as const;

    it("names users by their display name, if known", () => {
        expect(userName(holders[0])).toBe("Bob Builder");
        expect(userName(holders[1])).toBeUndefined();
        expect(userName({ user_id: "u", name: "  ", role: "owner" })).toBe(
            undefined,
        );
        expect(userName({ user_id: "u", name: " N ", role: "owner" })).toBe(
            "N",
        );
    });

    it("filters by name, user ID, group and role, ignoring case", () => {
        const found = (query: string) =>
            filterHolders([...holders], query).map((val) =>
                isGroup(val) ? val.group : val.user_id,
            );
        expect(found("")).toHaveLength(3);
        expect(found("  ")).toHaveLength(3);
        expect(found("builder")).toEqual(["bob@example.org"]);
        expect(found(" CAROL ")).toEqual(["carol@example.org"]);
        expect(found("compute")).toEqual(["urn:example:compute-team"]);
        expect(found("maintainer")).toEqual([
            "carol@example.org",
            "urn:example:compute-team",
        ]);
        expect(found("nobody")).toEqual([]);
    });
});
