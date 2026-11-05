import { describe, expect, it, vi } from "vitest";
import { failure } from "@/test/errors";
import type { Invitation } from "./cloud-registry.types";
import {
    acceptInvitationError,
    createInvitationError,
    createLabelledInvitation,
    dropPendingToken,
    invitationLabelError,
    invitationLink,
    invitationStatus,
    invitationToken,
    isDeadInvitation,
    isExpiredInvitation,
    keepPendingToken,
    listInvitationsError,
    pendingToken,
    readInvitation,
    removedExpiredMessage,
    removeExpiredError,
    removeInvitationError,
    removeInvitations,
    renewInvitationError,
    renewRemoveError,
    renewRevokeError,
    revokeInvitationError,
    sessionStore,
    shownInvitations,
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
            "This service has reached its limit of invitations, which also counts accepted ones until they expire. Revoke open invitations, or wait until invitations expire.",
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

describe("invitation lists", () => {
    const invitation = (
        id: string,
        createdAt: string,
        accepted = false,
    ): Invitation => ({
        id,
        serviceId: "s",
        role: "maintainer",
        createdBy: "u",
        createdAt: createdAt,
        expiresAt: "2026-11-08T00:00:00Z",
        ...(accepted && {
            accepted: { userId: "v", acceptedAt: "2026-11-02T00:00:00Z" },
        }),
    });
    const ids = (invitations: Invitation[]) => invitations.map((val) => val.id);

    it("lists invitations, newest first", () => {
        expect(
            ids(
                shownInvitations([
                    invitation("a", "2026-11-01T08:00:00Z"),
                    invitation("b", "2026-11-01T09:00:00Z"),
                    invitation("c", "2026-11-01T10:00:00Z"),
                ]),
            ),
        ).toEqual(["c", "b", "a"]);
    });

    it("orders by the time, not as listed", () => {
        expect(
            ids(
                shownInvitations([
                    invitation("b", "2026-11-01T09:00:00Z"),
                    invitation("c", "2026-11-01T10:00:00Z"),
                    invitation("a", "2026-11-01T08:00:00Z"),
                ]),
            ),
        ).toEqual(["c", "b", "a"]);
    });

    it("compares times, not their text", () => {
        expect(
            ids(
                shownInvitations([
                    invitation("a", "2026-11-01T09:30:00+02:00"),
                    invitation("b", "2026-11-01T08:00:00Z"),
                ]),
            ),
        ).toEqual(["b", "a"]);
    });

    it("takes the later listed as newer at the same time", () => {
        const time = "2026-11-01T08:00:00Z";
        expect(
            ids(
                shownInvitations([
                    invitation("a", time),
                    invitation("b", time),
                    invitation("c", time),
                ]),
            ),
        ).toEqual(["c", "b", "a"]);
    });

    it("leaves out accepted invitations", () => {
        expect(
            ids(
                shownInvitations([
                    invitation("a", "2026-11-01T08:00:00Z", true),
                    invitation("b", "2026-11-01T09:00:00Z"),
                    invitation("c", "2026-11-01T10:00:00Z", true),
                ]),
            ),
        ).toEqual(["b"]);
        expect(shownInvitations([])).toEqual([]);
    });

    it("leaves out what the registry marks as accepted", () => {
        expect(
            ids(
                shownInvitations([
                    {
                        ...invitation("a", "2026-11-01T08:00:00Z"),
                        status: "accepted",
                    },
                    {
                        ...invitation("b", "2026-11-01T09:00:00Z"),
                        status: "open",
                    },
                ]),
            ),
        ).toEqual(["b"]);
    });

    it("keeps expired invitations in the order of the others", () => {
        expect(
            ids(
                shownInvitations([
                    {
                        ...invitation("a", "2026-11-01T08:00:00Z"),
                        status: "open",
                    },
                    {
                        ...invitation("b", "2026-11-01T09:00:00Z"),
                        status: "expired",
                    },
                    {
                        ...invitation("c", "2026-11-01T10:00:00Z"),
                        status: "open",
                    },
                ]),
            ),
        ).toEqual(["c", "b", "a"]);
    });

    it("leaves the given list as it is", () => {
        const listed = [
            invitation("a", "2026-11-01T08:00:00Z"),
            invitation("b", "2026-11-01T09:00:00Z"),
        ];
        shownInvitations(listed);
        expect(ids(listed)).toEqual(["a", "b"]);
    });

    it("tells revocations that show the link is dead", () => {
        expect(isDeadInvitation(failure(404))).toBe(true);
        expect(
            isDeadInvitation(failure(409, { code: "invitation-accepted" })),
        ).toBe(true);
        expect(isDeadInvitation(failure(409))).toBe(false);
        expect(isDeadInvitation(failure(500))).toBe(false);
    });

    it("words failed renewals", () => {
        expect(
            renewInvitationError(failure(409, { code: "invitations-limit" })),
        ).toBe(
            "This service has reached its limit of invitations: no new link was created, and the old one still works. Revoke this invitation, then create a new link.",
        );
        expect(renewInvitationError(failure(500))).toBe(
            "Cannot create an invitation currently.",
        );
    });

    it("words failed renewals of expired invitations", () => {
        // expired invitations don't count towards the limit, and don't work
        expect(
            renewInvitationError(
                failure(409, { code: "invitations-limit" }),
                true,
            ),
        ).toBe(
            "This service has reached its limit of invitations: no new link was created. Revoke open invitations, or wait until invitations expire.",
        );
        expect(renewInvitationError(failure(500), true)).toBe(
            "Cannot create an invitation currently.",
        );
    });

    it("words failed removals of renewed expired invitations", () => {
        expect(renewRemoveError(failure(500))).toBe(
            "Created the new link, but the expired invitation is still listed: Cannot remove the invitation currently.",
        );
        expect(renewRemoveError(failure(404))).toBe(
            "Created the new link; the expired invitation was removed already.",
        );
    });

    it("words failed revocations of renewed invitations", () => {
        expect(renewRevokeError(failure(500))).toBe(
            "Created the new link, but the old one still works: Cannot revoke the invitation currently.",
        );
        expect(renewRevokeError(failure(404))).toBe(
            "Created the new link; the old invitation had expired or was revoked already.",
        );
        expect(
            renewRevokeError(failure(409, { code: "invitation-accepted" })),
        ).toBe(
            "Created the new link, but the old invitation was accepted meanwhile: revoke the new one if it isn't needed.",
        );
    });
});

describe("invitation status", () => {
    const base: Invitation = {
        id: "a",
        serviceId: "s",
        role: "maintainer",
        createdBy: "u",
        createdAt: "2026-10-20T00:00:00Z",
        expiresAt: "2026-11-08T00:00:00Z",
    };
    const past = "2000-01-01T00:00:00Z";

    it.each(["open", "expired", "accepted"] as const)(
        "takes the registry's %s",
        (status) => {
            expect(invitationStatus({ ...base, status })).toBe(status);
        },
    );

    it("takes the registry's word over the time", () => {
        expect(
            invitationStatus({ ...base, status: "open", expiresAt: past }),
        ).toBe("open");
    });

    it("tells expired invitations", () => {
        expect(isExpiredInvitation({ ...base, status: "expired" })).toBe(true);
        expect(isExpiredInvitation({ ...base, status: "open" })).toBe(false);
    });

    describe("of registries without it", () => {
        it("is open", () => {
            expect(invitationStatus(base)).toBe("open");
        });

        // they don't list expired invitations, and the clock of the browser
        // mustn't make open ones removable
        it("is open also after the time of the browser passed", () => {
            expect(invitationStatus({ ...base, expiresAt: past })).toBe("open");
            expect(isExpiredInvitation({ ...base, expiresAt: past })).toBe(
                false,
            );
        });

        it("is accepted with who accepted it", () => {
            expect(
                invitationStatus({
                    ...base,
                    accepted: {
                        userId: "v",
                        acceptedAt: "2026-11-02T00:00:00Z",
                    },
                }),
            ).toBe("accepted");
        });
    });
});

describe("invitation labels", () => {
    it.each(["", "  "])("requires a label for %j if set to", (text) => {
        expect(invitationLabelError(text, true)).toBe("Label is required.");
        expect(invitationLabelError(text, false)).toBeUndefined();
    });

    it.each([
        "Bob (variant calling team)",
        "  Bob  ",
        "x".repeat(100),
        // characters, not UTF-16 units, as the registry counts them
        "\u{1F600}".repeat(100),
        ` ${"x".repeat(100)} `,
    ])("accepts %j", (text) => {
        expect(invitationLabelError(text, true)).toBeUndefined();
    });

    it("limits the length", () => {
        expect(invitationLabelError("x".repeat(101), true)).toBe(
            "Label can't be longer than 100 characters.",
        );
    });

    it.each([
        "a\tb",
        "a\u0000b",
        "a\u007Fb",
        "a\u0085b",
        "a\u061Cb",
        "a\u200Bb",
        "a\u200Eb",
        "a\u200Fb",
        "a\u2028b",
        "a\u202Eb",
        "a\u2060b",
        "a\u2066b",
        "a\u2069b",
        "a\uFEFFb",
    ])("refuses what the registry refuses: %j", (text) => {
        expect(invitationLabelError(text, false)).toBe(
            "Label can't contain control or direction-changing characters.",
        );
    });
});

describe("createLabelledInvitation", () => {
    const created = { id: "a", token };

    it("sends the role and the label", async () => {
        const create = vi.fn().mockResolvedValue(created);
        await expect(
            createLabelledInvitation(create, "owner", "Bob"),
        ).resolves.toEqual({ created, labelKept: true });
        expect(create).toHaveBeenCalledExactlyOnceWith({
            role: "owner",
            label: "Bob",
        });
    });

    it("sends only the role without a label", async () => {
        const create = vi.fn().mockResolvedValue(created);
        await expect(
            createLabelledInvitation(create, "owner"),
        ).resolves.toEqual({ created, labelKept: true });
        expect(create).toHaveBeenCalledExactlyOnceWith({ role: "owner" });
    });

    it("tries without the label if the registry has no labels", async () => {
        const create = vi
            .fn()
            .mockRejectedValueOnce(
                failure(400, {
                    detail: "Additional properties are not allowed ('label' was unexpected)",
                }),
            )
            .mockResolvedValueOnce(created);
        await expect(
            createLabelledInvitation(create, "owner", "Bob"),
        ).resolves.toEqual({ created, labelKept: false });
        expect(create).toHaveBeenCalledTimes(2);
        expect(create).toHaveBeenLastCalledWith({ role: "owner" });
    });

    it.each([
        [failure(400, { detail: "'Bob' does not match" })],
        [failure(400)],
        [failure(500)],
    ])("doesn't try again after other failures (%#)", async (err) => {
        const create = vi.fn().mockRejectedValue(err);
        await expect(
            createLabelledInvitation(create, "owner", "Bob"),
        ).rejects.toBe(err);
        expect(create).toHaveBeenCalledOnce();
    });
});

describe("removing expired invitations", () => {
    const expired = (id: string, label?: string): Invitation => ({
        id,
        serviceId: "s",
        role: "maintainer",
        status: "expired",
        createdBy: "u",
        createdAt: "2026-10-20T00:00:00Z",
        expiresAt: "2026-10-27T00:00:00Z",
        ...(label && { label }),
    });

    it("sends one request per invitation, one at a time", async () => {
        const order: string[] = [];
        const failures = await removeInvitations(
            [expired("a"), expired("b")],
            async (id) => {
                order.push(`start ${id}`);
                await Promise.resolve();
                order.push(`end ${id}`);
            },
        );
        expect(failures).toEqual([]);
        expect(order).toEqual(["start a", "end a", "start b", "end b"]);
    });

    it("goes on after a failure and reports them all", async () => {
        const err = failure(500);
        const a = expired("a");
        const b = expired("b");
        const c = expired("c");
        const remove = vi.fn(async (id: string) => {
            if (id !== "b") throw err;
        });
        await expect(removeInvitations([a, b, c], remove)).resolves.toEqual([
            { invitation: a, error: err },
            { invitation: c, error: err },
        ]);
        expect(remove).toHaveBeenCalledTimes(3);
    });

    it("counts those that are gone already as removed", async () => {
        await expect(
            removeInvitations([expired("a")], async () => {
                throw failure(404);
            }),
        ).resolves.toEqual([]);
    });

    it("words the result", () => {
        expect(removedExpiredMessage(1)).toBe("Removed the expired invitation");
        expect(removedExpiredMessage(3)).toBe("Removed 3 expired invitations");
    });

    it("words failures, with each reason once", () => {
        const failures = [
            { invitation: expired("a", "Bob"), error: failure(500) },
            { invitation: expired("b"), error: failure(500) },
            { invitation: expired("c", "Eve"), error: failure(403) },
        ];
        expect(removeExpiredError(5, failures)).toBe(
            "Cannot remove 3 of 5 expired invitations (Bob, maintainer invitation without a label, Eve): Cannot remove the invitation currently. Only owners and admins can remove invitations.",
        );
    });

    it("names only the first failures of many", () => {
        const failures = ["a", "b", "c", "d", "e"].map((id) => ({
            invitation: expired(id, id.toUpperCase()),
            error: failure(500),
        }));
        expect(removeExpiredError(5, failures)).toBe(
            "Cannot remove 5 of 5 expired invitations (A, B, C and 2 more): Cannot remove the invitation currently.",
        );
    });

    it("words failed removals", () => {
        expect(removeInvitationError(failure(404))).toBe(
            "The invitation was removed already.",
        );
        expect(removeInvitationError(failure(405))).toBe(
            "This registry has no invitations.",
        );
        expect(removeInvitationError(failure(401))).toBe(
            "Your session expired. Please log in again.",
        );
        expect(removeInvitationError(failure(403))).toBe(
            "Only owners and admins can remove invitations.",
        );
        expect(removeInvitationError(failure(500))).toBe(
            "Cannot remove the invitation currently.",
        );
    });
});

describe("renewals without an answer", () => {
    const noAnswer = Object.assign(new Error("x"), { timedOut: true });

    it("don't claim what became of the old invitation", () => {
        expect(renewRevokeError(noAnswer)).toContain("may still work");
        expect(renewRemoveError(noAnswer)).toContain("may still be listed");
    });

    it("treat a failed connection alike, but not a refused ID", () => {
        expect(renewRevokeError(new TypeError("Failed to fetch"))).toContain(
            "may still work",
        );
        expect(renewRevokeError(new Error("Invalid ID"))).toContain(
            "still works",
        );
    });

    it("say so if the registry answered", () => {
        const refused = Object.assign(new Error("x"), { status: 500 });
        expect(renewRevokeError(refused)).toContain("still works");
        expect(renewRemoveError(refused)).toContain("is still listed");
    });
});
