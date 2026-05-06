import { z } from "zod";

export const formDataSchema = z.object({
  name: z.string(),
  url: z.string(),
  organization: z.object({
    name: z.string(),
    url: z.url(),
  }),
  type: z.object({
    group: z.string(),
    artifact: z.string(),
    version: z.string(),
  }),
  version: z.string(),
  description: z.string(),
  contactUrl: z.url().or(z.email()),
  documentationUrl: z.url(),
  environment: z.string(),
});

export type FormData = z.infer<typeof formDataSchema>;

export function normalizeFormData(data?: Partial<FormData>): FormData {
  return {
    name: data?.name ?? "",
    url: data?.url ?? "",
    version: data?.version ?? "",
    description: data?.description ?? "",
    contactUrl: data?.contactUrl ?? "",
    documentationUrl: data?.documentationUrl ?? "",
    environment: data?.environment ?? "",
    organization: {
      name: data?.organization?.name ?? "",
      url: data?.organization?.url ?? "",
    },

    type: {
      group: data?.type?.group ?? "org.ga4gh",
      artifact: data?.type?.artifact ?? "",
      version: data?.type?.version ?? "",
    },
  };
}