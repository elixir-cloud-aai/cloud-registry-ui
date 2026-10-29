import { describe, expect, it, vi } from "vitest";
import { failure } from "@/test/errors";
import {
    acceptanceLabel,
    acceptInvitationError,
    createInvitationError,
    dropPendingToken,
    invitationLink,
    invitationToken,
    keepPendingToken,
    listInvitationsError,
    pendingToken,
    readInvitation,
    revokeInvitationError,
    sessionStore,
} from "./invitations";

const token = "a".repeat(43);

describe("links", () => {
    it("puts the token in the fragment", () => {
        expect(invitationLink("https://app.example.org", token)).toBe(
            `https://app.example.org/invitations#${token}`,
        );
    });

    it.each([
        [`#${token}`, token],
        [token, token],
        ["#Ab-_0123456789xyzXYZ", "Ab-_0123456789xyzXYZ"],
    ])("reads the token of %s", (hash, expected) => {
        expect(invitationToken(hash)).toBe(expected);
    });

    it.each([
        "",
        "#",
        "#short",
        `#${token}&x=1`,
        `#${token}/`,
        `#${"a".repeat(257)}`,
    ])("rejects %j", (hash) => {
        expect(invitationToken(hash)).toBeUndefined();
    });
});

describe("pending tokens", () => {
    function memoryStorage() {
        const values = new Map<string, string>();
        return {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => {
                values.set(key, value);
            },
            removeItem: (key: string) => {
                values.delete(key);
            },
        } as Storage;
    }

    it("keeps, reads and drops the token", () => {
        const storage = memoryStorage();
        const get = () => storage;
        expect(pendingToken(get)).toBeUndefined();
        keepPendingToken(get, token);
        expect(pendingToken(get)).toBe(token);
        dropPendingToken(get);
        expect(pendingToken(get)).toBeUndefined();
    });

    it("drops only the given token", () => {
        const storage = memoryStorage();
        const get = () => storage;
        keepPendingToken(get, token);
        dropPendingToken(get, "b".repeat(43));
        expect(pendingToken(get)).toBe(token);
        dropPendingToken(get, token);
        expect(pendingToken(get)).toBeUndefined();
    });

    it("ignores invalid stored values", () => {
        const storage = memoryStorage();
        storage.setItem("pendingInvitation", "bad");
        expect(pendingToken(() => storage)).toBeUndefined();
    });

    it("works without storage, e.g. when the browser blocks it", () => {
        const get = (): Storage => {
            throw new Error("blocked");
        };
        expect(() => keepPendingToken(get, token)).not.toThrow();
        expect(pendingToken(get)).toBeUndefined();
        expect(() => dropPendingToken(get)).not.toThrow();
    });
});

describe("readInvitation", () => {
    function memory() {
        const values = new Map<string, string>();
        const storage = {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => {
                values.set(key, value);
            },
            removeItem: (key: string) => {
                values.delete(key);
            },
        } as Storage;
        return () => storage;
    }

    it("reads and keeps the token of the link", () => {
        const storage = memory();
        expect(readInvitation(`#${token}`, storage)).toEqual({
            token,
            scrub: true,
        });
        expect(pendingToken(storage)).toBe(token);
    });

    it("falls back to the kept token without a fragment", () => {
        const storage = memory();
        expect(readInvitation("", storage)).toEqual({
            token: null,
            scrub: false,
        });
        keepPendingToken(storage, token);
        expect(readInvitation("#", storage)).toEqual({ token, scrub: false });
    });

    it("ignores the kept token for an invalid fragment", () => {
        const storage = memory();
        keepPendingToken(storage, token);
        expect(readInvitation("#short", storage)).toEqual({
            token: null,
            scrub: true,
        });
        expect(pendingToken(storage)).toBeUndefined();
    });

    it("works without storage", () => {
        const blocked = (): Storage => {
            throw new Error("blocked");
        };
        expect(readInvitation(`#${token}`, blocked)).toEqual({
            token,
            scrub: true,
        });
        expect(readInvitation("", blocked)).toEqual({
            token: null,
            scrub: false,
        });
    });

    it("uses the session storage of the tab", () => {
        const storage = memory()();
        vi.stubGlobal("window", { sessionStorage: storage });
        expect(sessionStore()).toBe(storage);
        vi.unstubAllGlobals();
    });
});

describe("acceptanceLabel", () => {
    it.each([
        [{ user_id: "u", name: "N", email: "e@x" }, "N (e@x)"],
        [{ user_id: "u", name: "N" }, "N"],
        [{ user_id: "u", email: "e@x" }, "e@x"],
        [{ user_id: "u" }, "u"],
    ])("names %j", (acceptance, label) => {
        expect(
            acceptanceLabel({ ...acceptance, accepted_at: "2026-01-01" }),
        ).toBe(label);
    });
});

describe("messages", () => {
    const conflict = (code: string) => failure(409, { code });
    const expired = "Your session expired. Please log in again.";

    it("words failed listings", () => {
        expect(listInvitationsError(failure(404))).toBe(
            "Cannot load the invitations: the service was deleted, or this registry has no invitations.",
        );
        expect(listInvitationsError(failure(405))).toBe(
            listInvitationsError(failure(404)),
        );
        expect(listInvitationsError(failure(401))).toBe(expired);
        expect(listInvitationsError(failure(403))).toBe(
            "Only owners and admins can see the invitations.",
        );
        expect(listInvitationsError(failure(500))).toBe(
            "Cannot load the invitations. Please try again later.",
        );
    });

    it("words failed invitations", () => {
        expect(createInvitationError(conflict("invitations-limit"))).toBe(
            "This service has as many invitations as allowed. Revoke open ones, or wait until they expire.",
        );
        expect(createInvitationError(failure(404))).toBe(
            "The service was deleted, or this registry has no invitations.",
        );
        expect(createInvitationError(failure(403))).toBe(
            "Only owners and admins can invite users.",
        );
        expect(createInvitationError(failure(500, { detail: "D" }))).toBe("D");
        expect(createInvitationError(failure(500))).toBe(
            "Cannot create an invitation currently.",
        );
    });

    it("words failed revocations", () => {
        expect(revokeInvitationError(conflict("invitation-accepted"))).toBe(
            "This invitation was accepted already; remove the user's role instead.",
        );
        expect(revokeInvitationError(failure(404))).toBe(
            "The invitation has expired or was revoked already.",
        );
        expect(revokeInvitationError(failure(405))).toBe(
            "This registry has no invitations.",
        );
        expect(revokeInvitationError(failure(403))).toBe(
            "Only owners and admins can revoke invitations.",
        );
        expect(revokeInvitationError(failure(500))).toBe(
            "Cannot revoke the invitation currently.",
        );
    });

    it.each([
        [
            conflict("invitation-accepted"),
            "This invitation was accepted already. If you accepted it, the service is in your services; otherwise ask the owner of the service for a new one.",
            true,
        ],
        [failure(405), "This registry has no invitations.", true],
        [
            conflict("last-owner"),
            "You are the last owner of this service, so this invitation can't change your role.",
            true,
        ],
        [
            failure(404),
            "This invitation doesn't exist, was revoked or has expired. Ask the owner of the service for a new one.",
            true,
        ],
        [
            failure(400, { detail: "Bad user" }),
            "Your account can't accept invitations: Bad user",
            true,
        ],
        [failure(400), "Your account can't accept invitations.", true],
        [failure(401), expired, false],
        [failure(403), "You can't accept invitations.", true],
        [
            conflict("service-busy"),
            "The service is being changed by another request. Please try again in a moment.",
            false,
        ],
        [
            failure(500),
            "Cannot accept the invitation currently. Please try again later.",
            false,
        ],
        [
            new TypeError("Failed to fetch"),
            "Cannot accept the invitation currently. Please try again later.",
            false,
        ],
    ])("words failed acceptances (%#)", (err, message, final) => {
        expect(acceptInvitationError(err)).toEqual({ message, final });
    });
});
