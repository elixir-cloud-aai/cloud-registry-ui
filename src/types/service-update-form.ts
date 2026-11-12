import type {
    DeepKeysOfType,
    FormAsyncValidateOrFn,
    FormValidateOrFn,
    ReactFormExtendedApi,
} from "@tanstack/react-form";
import type { ReactNode } from "react";
import type {
    FormData,
    serviceFormSchema,
} from "@/app/dashboard/services/update/_components/form-helper";

// the parts of a field with a text value that the field components use
export type TextFieldApi = {
    name: string;
    state: {
        value: string;
        meta: {
            isTouched: boolean;
            isValid: boolean;
            errors: Array<{ message?: string } | undefined>;
        };
    };
    handleBlur: () => void;
    handleChange: (value: string) => void;
};

// the parts of a form (`useForm()`) with values of type `T` that the field
// components use, for any validators: TanStack's form types are invariant
// in them (e.g. the edit form of a service, or the form of a new type)
export type TextFieldForm<T> = {
    Field: (props: {
        name: TextFieldName<T>;
        children: (field: TextFieldApi) => ReactNode;
    }) => ReactNode | Promise<ReactNode>;
    options: { defaultValues?: T };
};

// the names of a form's fields with text values
export type TextFieldName<T> = DeepKeysOfType<T, string>;

type Sync = FormValidateOrFn<FormData> | undefined;
type Async = FormAsyncValidateOrFn<FormData> | undefined;

// the edit form of a service, as `useForm()` of `ServiceUpdationForm`
// returns it: it checks the values on change with `serviceFormSchema()`
export type ServiceUpdationFormType = ReactFormExtendedApi<
    FormData,
    Sync,
    ReturnType<typeof serviceFormSchema>,
    Async,
    Sync,
    Async,
    Sync,
    Async,
    Sync,
    Async,
    Async,
    unknown
>;
