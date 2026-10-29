"use client";
import { LogIn } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { loginHref } from "@/lib/links";

type Props = {
    message: string;
    /** The app's path to return to after the login (default: this page) */
    next?: string;
};

function LoginPrompt({ message, next }: Props) {
    const pathname = usePathname();
    const target = next ?? pathname;
    return (
        <div className="flex flex-col items-center space-y-4 mt-20 w-full">
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
