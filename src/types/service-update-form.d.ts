import type { z } from "@/lib/zod";

type FormData = z.infer<typeof formDataSchema>;

type ServiceUpdationFormType = ReactFormExtendedApi<FormData, any>;
