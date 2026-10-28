import { describe, expect, it } from "vitest";
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
    revokeInvitationError,
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
            "This invitation was accepted already. Ask the owner of the service for a new one.",
            true,
        ],
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
