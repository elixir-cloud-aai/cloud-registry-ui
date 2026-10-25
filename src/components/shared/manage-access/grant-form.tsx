"use client";
import { useForm } from "@tanstack/react-form";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { defaultGrant, type GrantData, grantSchema } from "./access-helper";
import RoleSelect from "./role-select";

type Props = {
    onGrant: (value: GrantData) => Promise<boolean>;
    disabled?: boolean;
};

function AccessGrantForm({ onGrant, disabled = false }: Props) {
    const form = useForm({
        defaultValues: defaultGrant,
        validators: {
            onChange: grantSchema,
            onSubmit: grantSchema,
        },
        onSubmit: async ({ value }) => {
            // the schema trims only for validation
            const granted = await onGrant({
                ...value,
                principal: value.principal.trim(),
            });
            if (granted) form.reset();
        },
    });

    return (
        <form
            className="space-y-3"
            onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
            }}
        >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr_9rem]">
                <form.Field name="kind">
                    {(field) => (
                        <Field>
                            <FieldLabel htmlFor={field.name}>
                                Grant to
                            </FieldLabel>
                            <Select
                                value={field.state.value}
                                onValueChange={(value) =>
                                    field.handleChange(
                                        value as GrantData["kind"],
                                    )
                                }
                            >
                                <SelectTrigger
                                    id={field.name}
                                    className="w-full"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">User</SelectItem>
                                    <SelectItem value="group">Group</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                    )}
                </form.Field>
                <form.Subscribe selector={(state) => state.values.kind}>
                    {(kind) => (
                        <form.Field name="principal">
                            {(field) => {
                                const isInvalid =
                                    field.state.meta.isTouched &&
                                    !field.state.meta.isValid;

                                return (
                                    <Field data-invalid={isInvalid}>
                                        <FieldLabel htmlFor={field.name}>
                                            {kind === "user"
                                                ? "User ID"
                                                : "Group"}
                                        </FieldLabel>
                                        <Input
                                            id={field.name}
                                            name={field.name}
                                            value={field.state.value}
                                            onBlur={field.handleBlur}
                                            onChange={(e) =>
                                                field.handleChange(
                                                    e.target.value,
                                                )
                                            }
                                            placeholder={
                                                kind === "user"
                                                    ? "abc123@lifescience-ri.eu"
                                                    : "urn:example:group:team#login.example.org"
                                            }
                                            aria-invalid={isInvalid}
                                        />
                                        {isInvalid && (
                                            <FieldError
                                                errors={field.state.meta.errors}
                                            />
                                        )}
                                    </Field>
                                );
                            }}
                        </form.Field>
                    )}
                </form.Subscribe>
                <form.Field name="role">
                    {(field) => (
                        <Field>
                            <FieldLabel htmlFor={field.name}>Role</FieldLabel>
                            <RoleSelect
                                id={field.name}
                                value={field.state.value}
                                onChange={(role) => field.handleChange(role)}
                                className="w-full"
                            />
                        </Field>
                    )}
                </form.Field>
            </div>
            <form.Subscribe selector={(state) => state.values.kind}>
                {(kind) =>
                    kind === "group" && (
                        <p className="flex gap-2 text-sm text-muted-foreground">
                            <TriangleAlert className="size-4 shrink-0 mt-0.5 text-amber-500" />
                            All members of a group get its role, and members of
                            an owner group can manage this service. Don't grant
                            roles to broad groups.
                        </p>
                    )
                }
            </form.Subscribe>
            <div className="flex justify-end">
                <form.Subscribe selector={(state) => state.isSubmitting}>
                    {(isSubmitting) => (
                        <Button
                            type="submit"
                            size="sm"
                            disabled={disabled || isSubmitting}
                        >
                            {isSubmitting ? "Granting..." : "Grant"}
                        </Button>
                    )}
                </form.Subscribe>
            </div>
        </form>
    );
}

export default AccessGrantForm;
