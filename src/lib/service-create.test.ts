import { describe, expect, it, vi } from "vitest";
import { failure } from "@/test/errors";
import { duplicateMessage } from "./errors";
import { createError, createFailedToast } from "./service-create";
import { servicesLimitMessage } from "./service-limits";

describe("createError", () => {
    it("is the provider's error, with all its fields", () => {
        const cause = failure(409, { code: "services-limit" });
        expect(createError({ error: "x", status: 409, cause })).toBe(cause);
    });

    it("has the event's status, detail and service ID otherwise", () => {
        const err = createError({
            error: "Already registered",
            status: 409,
            detail: "Already registered",
            serviceId: "tes-north",
            cause: "not an error",
        });
        expect(err).toBeInstanceOf(Error);
        expect(err).toMatchObject({
            message: "Already registered",
            status: 409,
            detail: "Already registered",
            serviceId: "tes-north",
        });
    });

    it("keeps the code of causes that aren't errors", () => {
        const err = createError({
            error: "Too many services",
            status: 409,
            cause: { code: "services-limit" },
        });
        expect(err).toMatchObject({ status: 409, code: "services-limit" });
        expect(
            createError({ error: "x", cause: { code: 1 } }),
        ).not.toHaveProperty("code");
    });

    it("is a plain error for failures without a request", () => {
        const err = createError({ error: "Service name is required" });
        expect(err.message).toBe("Service name is required");
        expect(err).not.toHaveProperty("status");
    });
});

describe("createFailedToast", () => {
    const options = {
        limit: undefined,
        readLimit: vi.fn<() => Promise<number | undefined>>(),
        adminAvailable: false,
    };

    it("shows the duplicate, with a link to it", async () => {
        const cause = failure(409, {
            code: "duplicate-service",
            detail: duplicateMessage,
            serviceId: "tes-north",
        });
        const toast = await createFailedToast(
            { error: duplicateMessage, status: 409, cause },
            options,
        );
        expect(toast.message).toBe(duplicateMessage);
        expect(toast.action).toMatchObject({ label: "View service" });
    });

    it("shows duplicates from the event's fields, too", async () => {
        const toast = await createFailedToast(
            {
                error: duplicateMessage,
                status: 409,
                detail: duplicateMessage,
                serviceId: "tes-north",
            },
            options,
        );
        expect(toast.action).toMatchObject({ label: "View service" });
    });

    it("shows the limit of services", async () => {
        const cause = failure(409, {
            code: "services-limit",
            detail: "Too many services",
        });
        const toast = await createFailedToast(
            { error: "Too many services", status: 409, cause },
            { ...options, limit: 3, adminAvailable: true },
        );
        expect(toast).toEqual({
            message: servicesLimitMessage(3, true),
            duration: 10000,
        });
    });

    it("reads the limit if it isn't known yet", async () => {
        const cause = failure(409, { code: "services-limit" });
        const readLimit = vi.fn().mockResolvedValue(0);
        const toast = await createFailedToast(
            { error: "x", status: 409, cause },
            { ...options, readLimit },
        );
        expect(toast.message).toBe(servicesLimitMessage(0));
        expect(readLimit).toHaveBeenCalledOnce();
    });

    it("shows the limit for causes that aren't errors", async () => {
        const toast = await createFailedToast(
            {
                error: "Too many services",
                status: 409,
                cause: { code: "services-limit" },
            },
            { ...options, limit: 3 },
        );
        expect(toast.message).toBe(servicesLimitMessage(3));
    });

    it("shows other errors with the form's labels", async () => {
        const cause = failure(400, {
            detail: "'url' must use one of the schemes: 'https'",
        });
        const toast = await createFailedToast(
            {
                error: "'url' must use one of the schemes: 'https'",
                status: 400,
                cause,
            },
            options,
        );
        expect(toast).toEqual({
            message: "'Service URL' must use one of the schemes: 'https'",
        });
    });

    it("shows errors without a request as they are", async () => {
        const toast = await createFailedToast(
            { error: "Failed to load service types: offline" },
            options,
        );
        expect(toast).toEqual({
            message: "Failed to load service types: offline",
        });
    });
});
