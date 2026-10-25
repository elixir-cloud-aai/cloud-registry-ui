import type { Me } from "@/lib/cloud-registry.types";

type Props = {
    me: Me | null;
    loading?: boolean;
    guest: string;
    user?: string;
    admin: string;
};

function PageSubtitle({ me, loading, guest, user, admin }: Props) {
    if (loading) return <p className="leading-7 mt-2 invisible">{guest}</p>;

    if (me?.admin)
        return (
            <p className="leading-7 mt-2">
                <span className="font-semibold text-[#b93f31] dark:text-[salmon]">
                    ADMIN MODE:
                </span>{" "}
                {admin}
            </p>
        );

    return <p className="leading-7 mt-2">{me && user ? user : guest}</p>;
}

export default PageSubtitle;
