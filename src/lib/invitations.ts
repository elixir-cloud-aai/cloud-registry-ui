/**
 * @description invitations to services (cloud-registry#101): links with the
 * token in the fragment, which browsers don't send to servers, the token
 * of a guest kept in the tab while they log in, and messages for failures
 */
import type {
    Invitation,
    InvitationCreated,
    InvitationRegister,
    InvitationStatus,
    Role,
} from "./cloud-registry.types";
import {
    errorDetail,
    isInvitationAccepted,
    isTimedOut,
    isInvitationsLimit,
    isLastOwner,
    mutationError,
} from "./errors";
import { hasStatus } from "./permissions";

/** Path of the page that accepts invitations */
const invitationPath = "/invitations";

// the registry's tokens are 43 characters (`secrets.token_urlsafe(32)`);
// any base64url text of a sensible length is passed on
const tokenPattern = /^[\w-]{16,256}$/;

// the token of a guest, while they log in; in the tab's session storage,
// which the browser doesn't send anywhere
const pendingKey = "pendingInvitation";

// the registry's limit for labels, in characters
const maxLabelLength = 100;

// what the registry refuses in labels (`InvitationLabel` in its API):
// control and direction-changing characters
const forbiddenInLabel =
    // biome-ignore lint/suspicious/noControlCharactersInRegex: what it finds
    /[\u0000-\u001F\u007F-\u009F\u061C\u200B\u200E\u200F\u2028-\u202E\u2060\u2066-\u2069\uFEFF]/;

// failures of removing expired invitations named in a message
const maxNamedFailures = 3;

/**
 * Get the link of an invitation
 * @param origin Origin of the app, e.g. `https://app.example.org`
 * @param token Token of the invitation
 * @returns The link, with the token in the fragment
 */
function invitationLink(origin: string, token: string) {
    return `${origin}${invitationPath}#${token}`;
}

/**
 * Get the token of an invitation link's fragment
 * @param hash Fragment, with or without `#`
 * @returns The token, if the fragment is one
 */
function invitationToken(hash: string) {
    const value = hash.replace(/^#/, "");
    return tokenPattern.test(value) ? value : undefined;
}

/**
 * Keep the token of an invitation for after the login
 * @param storage Getter of the storage, e.g. of `sessionStorage`; browsers
 * may block it, in which case the token isn't kept
 * @param token Token of the invitation
 */
function keepPendingToken(storage: () => Storage, token: string) {
    try {
        storage().setItem(pendingKey, token);
    } catch {
        // the guest opens the link again after logging in
    }
}

/**
 * Get the token of an invitation kept for after the login
 * @param storage Getter of the storage
 * @returns The token, if one is kept
 */
function pendingToken(storage: () => Storage) {
    try {
        return invitationToken(storage().getItem(pendingKey) ?? "");
    } catch {
        return undefined;
    }
}

/**
 * Forget the token of an invitation kept for after the login
 * @param storage Getter of the storage
 * @param token Forget it only if it is this one, e.g. the one accepted,
 * not one of a link opened meanwhile
 */
function dropPendingToken(storage: () => Storage, token?: string) {
    try {
        if (token !== undefined && storage().getItem(pendingKey) !== token)
            return;
        storage().removeItem(pendingKey);
    } catch {
        // nothing was kept
    }
}

/** The tab's session storage, for the token of a guest */
const sessionStore = () => window.sessionStorage;

/**
 * Read the token of the invitation page: from the link's fragment, which
 * is kept for after the login, else the one kept earlier
 * @param hash Fragment of the page's URL, with or without `#`
 * @param storage Getter of the storage
 * @returns The token (null without a valid one), and whether to remove
 * the fragment from the address bar
 */
function readInvitation(hash: string, storage: () => Storage) {
    const value = hash.replace(/^#/, "");
    if (!value) return { token: pendingToken(storage) ?? null, scrub: false };
    const token = invitationToken(value) ?? null;
    // an invalid link mustn't fall back to another invitation later
    if (token) keepPendingToken(storage, token);
    else dropPendingToken(storage);
    return { token, scrub: true };
}

// registries before cloud-registry 1.0.0 have no invitations (404 or 405)
const isMissing = (err: unknown) => hasStatus(err, 404) || hasStatus(err, 405);

/** Get the message for a failed listing of invitations */
function listInvitationsError(err: unknown) {
    if (isMissing(err))
        return "Cannot load the invitations: the service was deleted, or this registry has no invitations.";
    return mutationError(
        err,
        "Cannot load the invitations. Please try again later.",
        "Only owners and admins can see the invitations.",
    );
}

/** Get the message for a failed creation of an invitation */
function createInvitationError(err: unknown) {
    if (isInvitationsLimit(err))
        return "This service has reached its limit of invitations, which also counts accepted ones until they expire. Revoke open invitations, or wait until invitations expire.";
    if (isMissing(err))
        return "The service was deleted, or this registry has no invitations.";
    return mutationError(
        err,
        "Cannot create an invitation currently.",
        "Only owners and admins can invite users.",
    );
}

/** Get the message for a failed revocation of an invitation */
function revokeInvitationError(err: unknown) {
    if (isInvitationAccepted(err))
        return "This invitation was accepted already; remove the user's role instead.";
    if (hasStatus(err, 404))
        return "The invitation has expired or was revoked already.";
    if (hasStatus(err, 405)) return "This registry has no invitations.";
    return mutationError(
        err,
        "Cannot revoke the invitation currently.",
        "Only owners and admins can revoke invitations.",
    );
}

/** Get the message for a failed removal of an expired invitation */
function removeInvitationError(err: unknown) {
    if (hasStatus(err, 404)) return "The invitation was removed already.";
    if (hasStatus(err, 405)) return "This registry has no invitations.";
    return mutationError(
        err,
        "Cannot remove the invitation currently.",
        "Only owners and admins can remove invitations.",
    );
}

/**
 * Get the message for a failed revocation of an invitation that got a new
 * link: the new invitation exists already
 */
function renewRevokeError(err: unknown) {
    if (hasStatus(err, 404))
        return "Created the new link; the old invitation had expired or was revoked already.";
    if (isInvitationAccepted(err))
        return "Created the new link, but the old invitation was accepted meanwhile: revoke the new one if it isn't needed.";
    if (isTimedOut(err))
        return `Created the new link, but the old one may still work: ${revokeInvitationError(err)}`;
    return `Created the new link, but the old one still works: ${revokeInvitationError(err)}`;
}

/**
 * Get the message for a failed removal of an expired invitation that got a
 * new link: the new invitation exists already
 */
function renewRemoveError(err: unknown) {
    if (hasStatus(err, 404))
        return "Created the new link; the expired invitation was removed already.";
    return `Created the new link, but the expired invitation is still listed: ${removeInvitationError(err)}`;
}

/**
 * Tell whether a failed revocation shows that the invitation's link no
 * longer works: it expired, was revoked, or was accepted
 */
function isDeadInvitation(err: unknown) {
    return hasStatus(err, 404) || isInvitationAccepted(err);
}

/**
 * Get the message for a failed creation of the new invitation of a
 * renewal: the old one is unchanged
 * @param err Error of the request
 * @param expired Whether the old invitation has expired: then its link
 * doesn't work, and it doesn't count towards the limit
 */
function renewInvitationError(err: unknown, expired = false) {
    if (isInvitationsLimit(err) && expired)
        return "This service has reached its limit of invitations: no new link was created. Revoke open invitations, or wait until invitations expire.";
    // the old invitation fills a slot, too
    if (isInvitationsLimit(err))
        return "This service has reached its limit of invitations: no new link was created, and the old one still works. Revoke this invitation, then create a new link.";
    return createInvitationError(err);
}

/**
 * Get the status of an invitation
 * @param invitation Invitation, as listed
 * @returns Its status, as the registry tells it. Registries up to
 * cloud-registry 1.0.0rc1 don't, and they don't list expired invitations: the
 * others are open if nobody accepted them. The time isn't compared, as the
 * browser's clock may be off, and expired invitations can be removed
 */
function invitationStatus(invitation: Invitation): InvitationStatus {
    if (invitation.accepted) return "accepted";
    return invitation.status ?? "open";
}

/** Tell whether an invitation has expired */
const isExpiredInvitation = (invitation: Invitation) =>
    invitationStatus(invitation) === "expired";

/**
 * Get the invitations to show: open and expired ones, as accepted ones are
 * users with a role, newest first
 * @param invitations Invitations, as listed (the registry lists them oldest
 * first)
 * @returns The invitations, by the time of their creation; of those created
 * at the same time, the later listed first
 */
function shownInvitations(invitations: Invitation[]) {
    return invitations
        .filter((val) => invitationStatus(val) !== "accepted")
        .reverse()
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/**
 * Check the text of a label, as the registry would
 * @param text Text of the label; whitespace around it doesn't count, as it
 * isn't sent
 * @param required Whether a label is required
 * @returns The message for what is wrong with it, if anything
 */
function invitationLabelError(text: string, required: boolean) {
    const label = text.trim();
    if (!label) return required ? "Label is required." : undefined;
    // characters, as the registry counts them, not UTF-16 units
    if ([...label].length > maxLabelLength)
        return `Label can't be longer than ${maxLabelLength} characters.`;
    if (forbiddenInLabel.test(label))
        return "Label can't contain control or direction-changing characters.";
    return undefined;
}

// registries up to cloud-registry 1.0.0rc1 refuse labels as unknown fields;
// the words are those of the API validation (Connexion, with jsonschema) there:
// "Additional properties are not allowed ('label' was unexpected)"
const isLabelRefused = (err: unknown) =>
    hasStatus(err, 400) &&
    errorDetail(err)?.includes("'label' was unexpected") === true;

/**
 * Create an invitation, with a label if the registry has labels
 * @param create Sends the request
 * @param role Role of the invitation
 * @param label Label of the invitation, if any
 * @returns The invitation, and whether its label was kept
 */
async function createLabelledInvitation(
    create: (invitation: InvitationRegister) => Promise<InvitationCreated>,
    role: Role,
    label?: string,
) {
    try {
        const created = await create({ role, ...(label && { label }) });
        return { created, labelKept: true };
    } catch (err) {
        if (!isLabelRefused(err)) throw err;
    }
    return { created: await create({ role }), labelKept: false };
}

/** An invitation that couldn't be removed, and why */
type RemovalFailure = {
    invitation: Invitation;
    error: unknown;
};

/**
 * Remove invitations, one request each and one at a time; a failure doesn't
 * stop the others, and those that are gone already count as removed
 * @param invitations Invitations to remove
 * @param remove Sends the request for an invitation's identifier
 * @returns The failures
 */
async function removeInvitations(
    invitations: Invitation[],
    remove: (id: string) => Promise<unknown>,
) {
    const failures: RemovalFailure[] = [];
    for (const invitation of invitations) {
        try {
            await remove(invitation.id);
        } catch (error) {
            if (!hasStatus(error, 404)) failures.push({ invitation, error });
        }
    }
    return failures;
}

/** Get the message for removed expired invitations */
function removedExpiredMessage(count: number) {
    return count === 1
        ? "Removed the expired invitation"
        : `Removed ${count} expired invitations`;
}

/**
 * Get the message for expired invitations that couldn't be removed
 * @param total Number of invitations that were to be removed
 * @param failures Those that couldn't be
 * @returns The message, with the first of them and each reason once
 */
function removeExpiredError(total: number, failures: RemovalFailure[]) {
    const names = failures
        .slice(0, maxNamedFailures)
        .map(
            ({ invitation }) =>
                invitation.label ??
                `${invitation.role} invitation without a label`,
        )
        .join(", ");
    const others = failures.length - maxNamedFailures;
    const more = others > 0 ? ` and ${others} more` : "";
    const reasons = [
        ...new Set(failures.map((val) => removeInvitationError(val.error))),
    ].join(" ");
    return `Cannot remove ${failures.length} of ${total} expired invitations (${names}${more}): ${reasons}`;
}

/**
 * Get the message for a failed acceptance of an invitation
 * @param err Error of the request
 * @returns The message, and whether trying again can't help (`final`), so
 * that the token can be forgotten
 */
function acceptInvitationError(err: unknown) {
    const ask = "Ask the owner of the service for a new one.";
    if (isInvitationAccepted(err))
        return {
            // e.g. by this user, if the response to an acceptance was lost
            message:
                "This invitation was accepted already. If you accepted it, the service is in your services; otherwise ask the owner of the service for a new one.",
            final: true,
        };
    if (hasStatus(err, 405))
        return { message: "This registry has no invitations.", final: true };
    if (isLastOwner(err))
        return {
            message:
                "You are the last owner of this service, so this invitation can't change your role.",
            final: true,
        };
    if (hasStatus(err, 404))
        return {
            message: `This invitation doesn't exist, was revoked or has expired. ${ask}`,
            final: true,
        };
    if (hasStatus(err, 400)) {
        const detail = errorDetail(err);
        return {
            message: detail
                ? `Your account can't accept invitations: ${detail}`
                : "Your account can't accept invitations.",
            final: true,
        };
    }
    return {
        message: mutationError(
            err,
            "Cannot accept the invitation currently. Please try again later.",
            "You can't accept invitations.",
        ),
        // e.g. after logging in again, or once the service isn't busy
        final: hasStatus(err, 403),
    };
}

export {
    acceptInvitationError,
    createInvitationError,
    createLabelledInvitation,
    dropPendingToken,
    invitationLabelError,
    invitationLink,
    invitationPath,
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
};
