import Link from "next/link";

interface Props {
    searchParams: Promise<{
        type?:
            | "params"
            | "state"
            | "internal"
            | "issuer"
            | "logout-err"
            | "logout-origin"
            | "provider";
    }>;
}

async function Page({ searchParams }: Props) {
    const { type } = await searchParams;
    let message = "Internal server error occured.";

    if (type === "params") message = "Invalid request parameters found.";
    else if (type === "state") message = "The login is invalid or has expired.";
    else if (type === "issuer")
        message =
            "The login response came from another login provider than the one you chose.";
    else if (type === "provider")
        message = "Unknown login provider. Please choose one from the list.";
    else if (type === "logout-err")
        message =
            "An internal server error occurred while logging you out. Please try logging out again.";
    else if (type === "logout-origin")
        message =
            "Could not log you out: use the Log out button of the app, at the address it was set up for.";

    return (
        <div className="flex w-full h-screen justify-center items-center">
            <div className="flex flex-col items-center space-y-2">
                <p className="font-medium text-lg">{message}</p>
                <p>Please try to login in again.</p>
                <Link
                    href={"/auth/login"}
                    className="font-bold underline underline-offset-8"
                >
                    Go to Login
                </Link>
            </div>
        </div>
    );
}

export default Page;
