/**
 * @description invitations to services (cloud-registry#101): links with the
 * token in the fragment, which browsers don't send to servers, the token
 * of a guest kept in the tab while they log in, and messages for failures
 */
import type { InvitationAcceptance } from "./cloud-registry.types";
import {
    errorDetail,
    isInvitationAccepted,
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

/**
 * Name the user who accepted an invitation
 * @param acceptance Acceptance of the invitation
 * @returns Name and email address, as far as known, else the identifier
 */
function acceptanceLabel(acceptance: InvitationAcceptance) {
    const { name, email, user_id } = acceptance;
    if (name && email) return `${name} (${email})`;
    return name || email || user_id;
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
        return "This service has as many invitations as allowed. Revoke open ones, or wait until they expire.";
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
    acceptanceLabel,
    acceptInvitationError,
    createInvitationError,
    dropPendingToken,
    invitationLink,
    invitationPath,
    invitationToken,
    keepPendingToken,
    listInvitationsError,
    pendingToken,
    readInvitation,
    revokeInvitationError,
    sessionStore,
};
