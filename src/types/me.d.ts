// response of GET /me; not in the package's types yet (cloud-components gap)
type Me = {
    user_id: string;
    admin: boolean;
    services: {
        service_id: string;
        role: "owner" | "maintainer";
        group?: string;
    }[];
};
