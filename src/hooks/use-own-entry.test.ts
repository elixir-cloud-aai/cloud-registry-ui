import { beforeEach, describe, expect, it, vi } from "vitest";
import { react } from "@/test/react";

type Listing = { listed: boolean; serviceId?: string };

const registry = vi.hoisted(() => ({
    provider: null as null | {
        getSelfListing: (options?: {
            signal?: AbortSignal;
        }) => Promise<Listing>;
    },
}));

// React's hooks, as the tests run in Node without a DOM
vi.mock("react", async () => (await import("@/test/react")).reactMock);
vi.mock("./use-cloud-registry", () => ({
    useCloudRegistry: () => ({ cloudRegistryProvider: registry.provider }),
}));

const { useOwnEntry } = await import("./use-own-entry");

/**
 * A client whose listing is the given one, counting its reads
 * @param listing The listing, or an error to fail with
 * @returns The client, and the signals of its reads
 */
function listingOf(listing: Listing | Error) {
    const signals: (AbortSignal | undefined)[] = [];
    const getSelfListing = async (options: { signal?: AbortSignal } = {}) => {
        signals.push(options.signal);
        if (listing instanceof Error) throw listing;
        return listing;
    };
    return { getSelfListing, signals };
}

/**
 * Render the hook until its read has settled
 * @param serviceId Service identifier
 * @returns What the hook returns then
 */
async function settled(serviceId: string) {
    const render = () => react.render(() => useOwnEntry(serviceId, true));
    render();
    await vi.waitFor(() => expect(render().loading).toBe(false));
    return render();
}

beforeEach(() => {
    react.reset();
    registry.provider = null;
});

describe("useOwnEntry", () => {
    it("reads nothing unless enabled", () => {
        const client = listingOf({ listed: true, serviceId: "self" });
        registry.provider = client;
        expect(react.render(() => useOwnEntry("self", false))).toEqual({
            ownEntry: false,
            loading: false,
        });
        expect(client.signals).toHaveLength(0);
    });

    it("is loading until the listing is read", () => {
        registry.provider = {
            getSelfListing: () => new Promise<never>(() => {}),
        };
        expect(react.render(() => useOwnEntry("self", true))).toEqual({
            ownEntry: false,
            loading: true,
        });
    });

    it("is the registry's own entry if it is listed under the ID", async () => {
        registry.provider = listingOf({ listed: true, serviceId: "self" });
        expect(await settled("self")).toEqual({
            ownEntry: true,
            loading: false,
        });
    });

    it.each([
        ["another entry", { listed: true, serviceId: "self" }],
        ["an unlisted registry", { listed: false }],
    ])("is another service for %s", async (_, listing) => {
        registry.provider = listingOf(listing);
        expect((await settled("other")).ownEntry).toBe(false);
    });

    it("takes the service as another one if the listing can't be read", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        registry.provider = listingOf(new Error("down"));
        expect(await settled("self")).toEqual({
            ownEntry: false,
            loading: false,
        });
        expect(error).toHaveBeenCalledTimes(1);
    });

    it("aborts the read on unmount", () => {
        const client = listingOf({ listed: true, serviceId: "self" });
        registry.provider = client;
        react.render(() => useOwnEntry("self", true));
        expect(client.signals[0]?.aborted).toBe(false);
        react.unmount();
        expect(client.signals[0]?.aborted).toBe(true);
    });
});
