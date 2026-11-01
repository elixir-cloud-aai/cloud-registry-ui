import type { ExternalServiceRegister } from "@elixir-cloud/cloud-registry/providers";
import { describe, expect, it, vi } from "vitest";
import { failure } from "@/test/errors";
import { duplicateMessage } from "./errors";
import {
    defaultRegistrationRules,
    unknownRegistrationRules,
} from "./registration-rules";
import {
    checkedProvider,
    createError,
    createFailedToast,
} from "./service-create";
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

    it("explains the limit of unused service types", async () => {
        const cause = failure(409, {
            detail: "You have added 0 service types",
            code: "unused-types-limit",
        });
        const toast = await createFailedToast(
            { error: "You have added 0 service types", status: 409, cause },
            options,
        );
        expect(toast.message).toContain(
            "You have added as many service types that no service has as this registry allows.",
        );
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

describe("checkedProvider", () => {
    const service: ExternalServiceRegister = {
        name: "TES North",
        url: "https://tes.example.org/",
        organization: { name: "Example", url: "https://example.org/" },
        type: { group: "org.ga4gh", artifact: "tes", version: "1.1.0" },
        version: "1.0.0",
        description: undefined,
        environment: "test",
    };
    const registry = () => ({
        createService: vi.fn(
            async (_service: ExternalServiceRegister) => "created",
        ),
        createServiceWithId: vi.fn(
            async (id: string, _service: ExternalServiceRegister) => id,
        ),
        getServiceInfo: vi.fn(async () => ({})),
    });

    it("sends valid registrations", async () => {
        const provider = registry();
        const checked = checkedProvider(
            provider,
            () => defaultRegistrationRules,
        );
        await expect(checked.createService(service)).resolves.toBe("created");
        await expect(
            checked.createServiceWithId("tes-north", service),
        ).resolves.toBe("tes-north");
        expect(provider.createService).toHaveBeenCalledWith(service);
        expect(provider.createServiceWithId).toHaveBeenCalledWith(
            "tes-north",
            service,
        );
    });

    it("rejects invalid ones with the first problem, unsent", async () => {
        const provider = registry();
        const checked = checkedProvider(
            provider,
            () => defaultRegistrationRules,
        );
        const invalid = {
            ...service,
            url: "http://tes.example.org/",
            documentationUrl: "docs",
        };
        await expect(checked.createService(invalid)).rejects.toThrow(
            "Service URL must be an https URL, e.g. https://example.org/.",
        );
        await expect(
            checked.createServiceWithId("tes-north", {
                ...service,
                environment: "qa",
            }),
        ).rejects.toThrow(
            "Environment must be one of: 'prod', 'test', 'dev', 'staging'.",
        );
        expect(provider.createService).not.toHaveBeenCalled();
        expect(provider.createServiceWithId).not.toHaveBeenCalled();
    });

    it("follows the current rules", async () => {
        const provider = registry();
        let rules = defaultRegistrationRules;
        const checked = checkedProvider(provider, () => rules);
        const http = { ...service, url: "http://tes.example.org/" };
        await expect(checked.createService(http)).rejects.toThrow(
            "Service URL must be an https URL",
        );
        rules = { ...defaultRegistrationRules, urlSchemes: ["https", "http"] };
        await expect(checked.createService(http)).resolves.toBe("created");
    });

    it("leaves the rules to the registry if they are unknown", async () => {
        const provider = registry();
        const checked = checkedProvider(
            provider,
            () => unknownRegistrationRules,
        );
        await expect(
            checked.createService({
                ...service,
                url: "http://tes.example.org/",
                environment: "qa",
            }),
        ).resolves.toBe("created");
        // checks that don't depend on the rules still apply
        await expect(
            checked.createService({
                ...service,
                description: "x".repeat(4097),
            }),
        ).rejects.toThrow("Description must be at most 4096 characters.");
    });

    it("passes on the client's other methods and fields", async () => {
        class Registry {
            readonly baseUrl = "https://registry.example.org";
            createService = vi.fn(
                async (_service: ExternalServiceRegister) => "created",
            );
            createServiceWithId = vi.fn(
                async (id: string, _service: ExternalServiceRegister) => id,
            );
            async getServiceInfo() {
                return { url: this.baseUrl };
            }
        }
        const provider = new Registry();
        const { createService } = provider;
        const checked = checkedProvider(
            provider,
            () => defaultRegistrationRules,
        );
        expect(checked.baseUrl).toBe(provider.baseUrl);
        await expect(checked.getServiceInfo()).resolves.toEqual({
            url: provider.baseUrl,
        });
        // the client itself stays as it is
        expect(provider.createService).toBe(createService);
        await checked.createService(service);
        expect(createService).toHaveBeenCalledWith(service);
    });
});
