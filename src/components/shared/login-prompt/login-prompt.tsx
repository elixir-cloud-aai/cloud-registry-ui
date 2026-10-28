import { LogIn } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Props = {
    message: string;
    /** The app's path to return to after the login */
    next?: string;
};

function LoginPrompt({ message, next }: Props) {
    return (
        <div className="flex flex-col items-center space-y-4 mt-20 w-full">
            <p className="font-medium text-lg text-center">{message}</p>
            <Button asChild>
                <Link
                    href={
                        next
                            ? `/auth/login?next=${encodeURIComponent(next)}`
                            : "/auth/login"
                    }
                >
                    <LogIn />
                    Log in
                </Link>
            </Button>
        </div>
    );
}

export default LoginPrompt;
