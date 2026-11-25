import { Directory } from "@/features/admin/directory";

export default function Page({ searchParams }: PageProps<"/admin/admins">) {
  return <Directory section="admins" query={searchParams} />;
}
