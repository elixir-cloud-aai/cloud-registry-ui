import { redirect } from "next/navigation";

/** Links to the former create page open the create form, the modal
 * "Register Service" of the Services page */
function Page() {
    redirect("/dashboard/services?register");
}

export default Page;
