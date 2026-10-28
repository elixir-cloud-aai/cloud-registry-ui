"use client";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
    oldId: string;
    // undefined while the dialog is closed
    newId?: string;
    onConfirm: () => void;
    onCancel: () => void;
};

function ServiceRenameDialog({ oldId, newId, onConfirm, onCancel }: Props) {
    return (
        <AlertDialog
            open={newId !== undefined}
            onOpenChange={(open) => {
                if (!open) onCancel();
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Change service ID</AlertDialogTitle>
                    <AlertDialogDescription>
                        Change the ID from{" "}
                        <span className="font-mono break-all">{oldId}</span> to{" "}
                        <span className="font-mono break-all">{newId}</span>?
                        Its roles and verification move with it, and links to
                        the old ID stop working.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm}>
                        Change ID
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default ServiceRenameDialog;
