import { Directory } from "@/features/admin/directory";

export default function Page({ searchParams }: PageProps<"/admin/users">) {
  return <Directory section="users" query={searchParams} />;
}
