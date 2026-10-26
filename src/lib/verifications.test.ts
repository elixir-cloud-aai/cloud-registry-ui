import { describe, expect, it } from "vitest";
import type {
    ExternalService,
    ServiceVerification,
} from "./cloud-registry.types";
import { matchesVerification, verifiedServices } from "./verifications";

const type = { group: "org.ga4gh", artifact: "tes", version: "1.1.0" };
const service = (id: string, url = "https://tes.example.org") =>
    ({ id, url, type }) as ExternalService;
const verification = (service_id: string, url = "https://tes.example.org") =>
    ({ service_id, url, type }) as unknown as ServiceVerification;

describe("matchesVerification", () => {
    const verified = verification("s1");

    it("matches the same URL and API type", () => {
        expect(matchesVerification(service("s1"), verified)).toBe(true);
    });

    it("compares the type as the registry does: trimmed, case-folded", () => {
        for (const group of [
            " ORG.GA4GH\u0085",
            "org.ga4gh\x1c",
            "Org.Ga4gh\t",
        ])
            expect(
                matchesVerification(
                    { url: verified.url, type: { ...type, group } },
                    verified,
                ),
            ).toBe(true);
        const strasse = { ...verified, type: { ...type, artifact: "straße" } };
        expect(
            matchesVerification(
                { url: verified.url, type: { ...type, artifact: "STRASSE" } },
                strasse,
            ),
        ).toBe(true);
    });

    it("doesn't trim U+FEFF, nor the URL", () => {
        expect(
            matchesVerification(
                { url: verified.url, type: { ...type, group: "﻿org.ga4gh" } },
                verified,
            ),
        ).toBe(false);
        expect(
            matchesVerification(
                service("s1", "https://tes.example.org/"),
                verified,
            ),
        ).toBe(false);
    });

    it("ignores the version", () => {
        expect(
            matchesVerification(
                { url: verified.url, type: { ...type, version: "2.0.0" } },
                verified,
            ),
        ).toBe(true);
    });
});

describe("verifiedServices", () => {
    it("keeps verifications of existing, unchanged services", () => {
        const result = verifiedServices(
            [service("s1"), service("s2", "https://other.example.org")],
            [verification("s1"), verification("s2"), verification("gone")],
        );
        expect([...result.keys()]).toEqual(["s1"]);
    });
});
