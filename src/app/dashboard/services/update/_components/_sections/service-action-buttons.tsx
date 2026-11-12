import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { ServiceUpdationFormType } from "@/types/service-update-form";

type Props = {
    form: ServiceUpdationFormType;
    updating: boolean;
};

function ActionButton({ form, updating }: Props) {
    return (
        <Field orientation="horizontal" className="justify-end mt-4">
            <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
            >
                Reset
            </Button>
            <Button
                type="submit"
                form="service-updation-form"
                disabled={updating}
            >
                {updating ? "Updating..." : "Submit"}
            </Button>
        </Field>
    );
}

export default ActionButton;
