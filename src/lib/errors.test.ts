import { describe, expect, it, vi } from "vitest";
import { failure } from "@/test/errors";
import {
    duplicateMessage,
    duplicateToast,
    errorField,
    errorMessage,
    isDuplicate,
    isInvitationAccepted,
    isInvitationsLimit,
    isLastOwner,
    isServiceBusy,
    isServiceIdTaken,
    isVerificationMismatch,
    mutationError,
    renameError,
    withFieldLabels,
} from "./errors";

const pendingDetail =
    "The service has a service type that is pending until an admin approves it; until then, it can only be updated to an approved type, or deleted.";

describe("withFieldLabels", () => {
    it.each([
        ["'url' must be unique", "'Service URL' must be unique"],
        [
            "URLs in 'organization.url' need a scheme",
            "URLs in 'Organization URL' need a scheme",
        ],
        [
            "'x' is too long - 'type.version'",
            "'x' is too long - 'Type Version'",
        ],
        [
            "'id' must not contain unpaired surrogates.",
            "'Service ID' must not contain unpaired surrogates.",
        ],
    ])("labels %s", (message, labelled) => {
        expect(withFieldLabels(message)).toBe(labelled);
    });

    it("keeps unknown fields and other text", () => {
        expect(withFieldLabels("'secret' must be set")).toBe(
            "'secret' must be set",
        );
        expect(withFieldLabels("'toString' must be set")).toBe(
            "'toString' must be set",
        );
        expect(withFieldLabels("Something failed")).toBe("Something failed");
    });
});

describe("errorField and errorMessage", () => {
    const err = failure(400, {
        detail: "'environment' must be one of: 'prod'",
    });

    it("finds the named field among the form's", () => {
        expect(errorField(err, ["name", "environment"])).toBe("environment");
        expect(errorField(err, ["name"])).toBeUndefined();
        expect(errorField(new Error("x"), ["name"])).toBeUndefined();
    });

    it("uses the detail with labels, else the fallback", () => {
        expect(errorMessage(err, "Failed")).toBe(
            "'Environment' must be one of: 'prod'",
        );
        expect(errorMessage(failure(500, { detail: 5 }), "Failed")).toBe(
            "Failed",
        );
        expect(errorMessage("x", "Failed")).toBe("Failed");
    });
});

describe("mutationError", () => {
    it("explains logins and roles before details", () => {
        expect(mutationError(failure(401, { detail: "d" }), "f")).toBe(
            "Your session expired. Please log in again.",
        );
        expect(mutationError(failure(403), "f")).toBe(
            "You don't have permission to change this service.",
        );
        expect(mutationError(failure(403), "f", "No.")).toBe("No.");
        expect(mutationError(failure(400, { detail: "d" }), "f")).toBe("d");
        expect(mutationError(failure(500), "f")).toBe("f");
    });

    it("asks to try again while the service is busy", () => {
        expect(
            mutationError(
                failure(409, { detail: "d", code: "service-busy" }),
                "f",
            ),
        ).toBe(
            "The service is being changed by another request. Please try again in a moment.",
        );
    });
});

describe("renameError", () => {
    it("asks for another ID if the new one is taken", () => {
        expect(renameError(failure(409, { code: "service-id-taken" }))).toBe(
            "A service with this ID is already registered. Please choose another ID.",
        );
    });

    it("explains roles, busy services and other failures", () => {
        expect(renameError(failure(403))).toBe(
            "Only admins can change service IDs.",
        );
        expect(renameError(failure(409, { code: "service-busy" }))).toBe(
            "The service is being changed by another request. Please try again in a moment.",
        );
        expect(
            renameError(failure(400, { detail: "'id' must be short" })),
        ).toBe("'Service ID' must be short");
        expect(renameError(failure(405))).toBe(
            "This registry can't change service IDs.",
        );
        expect(renameError(failure(404, { detail: "Not found" }))).toBe(
            "The service was deleted, or this registry can't change service IDs.",
        );
        expect(renameError(failure(500))).toBe(
            "Cannot change the service ID currently.",
        );
    });
});

describe("conflicts", () => {
    const checks = {
        isDuplicate,
        isVerificationMismatch,
        isLastOwner,
        isServiceIdTaken,
        isServiceBusy,
        isInvitationsLimit,
        isInvitationAccepted,
    };

    it.each([
        ["duplicate-service", "isDuplicate"],
        ["verification-mismatch", "isVerificationMismatch"],
        ["last-owner", "isLastOwner"],
        ["service-id-taken", "isServiceIdTaken"],
        ["service-busy", "isServiceBusy"],
        ["invitations-limit", "isInvitationsLimit"],
        ["invitation-accepted", "isInvitationAccepted"],
        ["pending-service", undefined],
        ["conflict", undefined],
        ["added-later", undefined],
    ])("tells %s apart by its code", (code, match) => {
        // the detail of a duplicate, so that only the code decides
        const err = failure(409, { detail: "Registered: 'x'.", code });
        for (const [name, check] of Object.entries(checks))
            expect(check(err), name).toBe(name === match);
    });

    it("tells conflicts apart without codes, as older registries send them", () => {
        for (const err of [failure(409), failure(409, { code: null })]) {
            expect(isDuplicate(err)).toBe(true);
            expect(isVerificationMismatch(err)).toBe(true);
            expect(isLastOwner(err)).toBe(true);
            // registries that rename services send codes
            expect(isServiceIdTaken(err)).toBe(false);
            expect(isServiceBusy(err)).toBe(false);
            // registries with invitations send codes
            expect(isInvitationsLimit(err)).toBe(false);
            expect(isInvitationAccepted(err)).toBe(false);
        }
    });

    it("ignores codes of other failures", () => {
        const err = failure(400, { code: "duplicate-service" });
        expect(isDuplicate(err)).toBe(false);
        expect(isVerificationMismatch(err)).toBe(false);
        expect(isLastOwner(err)).toBe(false);
        expect(isServiceBusy(failure(400, { code: "service-busy" }))).toBe(
            false,
        );
    });
});

describe("duplicates", () => {
    it("tells duplicates from pending conflicts", () => {
        expect(isDuplicate(failure(409))).toBe(true);
        expect(isDuplicate(failure(409, { detail: pendingDetail }))).toBe(
            false,
        );
        expect(
            isDuplicate(
                failure(409, {
                    detail: pendingDetail,
                    code: "duplicate-service",
                }),
            ),
        ).toBe(true);
        expect(isDuplicate(failure(409, { code: "pending-service" }))).toBe(
            false,
        );
        expect(isDuplicate(failure(400))).toBe(false);
        expect(isDuplicate({ status: 409 })).toBe(false);
    });

    it("has no toast for other failures", () => {
        expect(duplicateToast(failure(400))).toBeNull();
    });

    it("asks users who may not read the service to contact an admin", () => {
        expect(duplicateToast(failure(409))).toEqual({
            message:
                "A service with this URL and API type is already registered; contact an admin.",
        });
    });

    it("links the service in a new tab", () => {
        const open = vi.fn();
        vi.stubGlobal("window", { open });
        const toast = duplicateToast(failure(409, { serviceId: "a/b" }));
        expect(toast?.message).toBe(duplicateMessage);
        expect(toast?.description).toBe(
            "Please contact its owner or an admin.",
        );
        const action = toast?.action as unknown as { onClick: () => void };
        action.onClick();
        expect(open).toHaveBeenCalledWith(
            "/dashboard/services/view/a%2Fb",
            "_blank",
            "noopener",
        );
        vi.unstubAllGlobals();
    });
});
