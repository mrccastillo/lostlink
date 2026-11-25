import { Directory } from "@/features/admin/directory";

export default function Page({ searchParams }: PageProps<"/admin/audit">) {
  return <Directory section="audit" query={searchParams} />;
}
