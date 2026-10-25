import type { ServiceType } from "@elixir-cloud/cloud-registry/providers";
import { defaultTypeGroup } from "@/app/dashboard/services/update/_components/form-helper";

export const defaultType: ServiceType = {
    group: defaultTypeGroup,
    artifact: "",
    version: "",
};

export function typeLabel({ group, artifact, version }: ServiceType) {
    return `${group} · ${artifact} · ${version}`;
}

export function typeKey({ group, artifact, version }: ServiceType) {
    return JSON.stringify([group, artifact, version]);
}
