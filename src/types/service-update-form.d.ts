import z from "zod";

type FormData = z.infer<typeof formDataSchema>;

type ServiceUpdationFormType = ReactFormExtendedApi<FormData, any>;
