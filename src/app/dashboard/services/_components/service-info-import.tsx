"use client";
import { DownloadIcon, TriangleAlertIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importError } from "@/lib/service-import";

type Props = {
    /** Until the form is ready to take the values */
    disabled: boolean;
    /** Have the registry fetch the values, and fill in the form */
    onImport: (serviceInfoUrl: string) => Promise<void>;
};

/** The way to fill in the create form that the app recommends: from the
 * address of a service's service-info endpoint, which the registry fetches */
function ServiceInfoImport({ disabled, onImport }: Props) {
    const id = useId();
    const [address, setAddress] = useState("");
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string>();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setImporting(true);
        setError(undefined);
        try {
            await onImport(address.trim());
        } catch (err) {
            setError(importError(err));
        } finally {
            setImporting(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="mb-6 flex flex-col gap-2 rounded-lg border bg-muted/30 p-4"
        >
            <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor={id}>Import from service info</Label>
                <Badge variant={"secondary"}>Recommended</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
                Enter the address of the service's service-info endpoint to fill
                in the form. You can still change the values before you create
                the service.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                    id={id}
                    type="url"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="https://tes.example.org/ga4gh/tes/v1/service-info"
                    aria-invalid={!!error}
                />
                <Button
                    type="submit"
                    variant={"outline"}
                    disabled={disabled || importing || !address.trim()}
                    className="shrink-0"
                >
                    <DownloadIcon />
                    {importing ? "Importing..." : "Import"}
                </Button>
            </div>
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                Only publicly available service info can be imported: no tokens
                are sent.
            </p>
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
        </form>
    );
}

export default ServiceInfoImport;
