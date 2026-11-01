import type { ServiceType } from "@elixir-cloud/cloud-registry/providers";
import { defaultTypeGroup } from "@/lib/service-schema";

export const defaultType: ServiceType = {
    group: defaultTypeGroup,
    artifact: "",
    version: "",
};
