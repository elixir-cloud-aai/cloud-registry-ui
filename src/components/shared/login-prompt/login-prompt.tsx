import Image from "next/image";
import Link from "next/link";

type Props = {
    message: string;
};

function LoginPrompt({ message }: Props) {
    return (
        <div className="flex flex-col items-center space-y-4 mt-20 w-full">
            <p className="font-medium text-lg text-center">{message}</p>
            <Link href={"/auth/api/login-redirect"}>
                <Image
                    src={"/ls-login-grey-wide.jpg"}
                    width={260}
                    height={58}
                    alt="ls-login-image"
                    loading="eager"
                />
            </Link>
        </div>
    );
}

export default LoginPrompt;
