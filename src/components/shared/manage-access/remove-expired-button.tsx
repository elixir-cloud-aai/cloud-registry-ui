"use client";
import { Trash2 } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type Props = {
    /** Expired invitations of the service, on all pages */
    count: number;
    disabled?: boolean;
    onConfirm: () => void;
};

/** A button that removes all expired invitations, after a confirmation */
function RemoveExpiredButton({ count, disabled = false, onConfirm }: Props) {
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={disabled}>
                    <Trash2 />
                    Remove expired
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        Remove expired invitations?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {count === 1
                            ? "The expired invitation of this service is then no longer listed, so you can't give it a new link."
                            : `All ${count} expired invitations of this service, on all pages, are then no longer listed, so you can't give them new links.`}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm}>
                        Remove
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default RemoveExpiredButton;
