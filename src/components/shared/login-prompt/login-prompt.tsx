"use client";
import { LogIn } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { loginHref } from "@/lib/links";
import { cn } from "@/lib/utils";

type Props = {
    message: string;
    /** The app's path to return to after the login (default: this page) */
    next?: string;
    /** Classes of the container, e.g. a smaller top margin in modals */
    className?: string;
};

function LoginPrompt({ message, next, className }: Props) {
    const pathname = usePathname();
    const target = next ?? pathname;
    return (
        <div
            className={cn(
                "flex flex-col items-center space-y-4 mt-20 w-full",
                className,
            )}
        >
            <p className="font-medium text-lg text-center">{message}</p>
            <Button asChild>
                <Link href={loginHref(target)}>
                    <LogIn />
                    Log in
                </Link>
            </Button>
        </div>
    );
}

export default LoginPrompt;
