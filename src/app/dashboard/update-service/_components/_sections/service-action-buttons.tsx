import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

type Props = {
    form: any;
    updating: boolean;
};

function ActionButton({ form, updating }: Props) {
    return (
        <Field orientation="horizontal" className="justify-end mt-4">
            <Button type="button" variant="outline" onClick={() => form.reset()}>
                Reset
            </Button>
            <Button type="submit" form="service-updation-form" disabled={updating}>
                {updating ? "Updating..." : "Submit"}
            </Button>
        </Field>
    );
}

export default ActionButton;
