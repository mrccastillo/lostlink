import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "@/components/icons";
import { NavigationPending } from "@/components/navigation-pending";
import { POST_ITEM_LOGIN_PATH } from "@/lib/auth/policy";

export function ReportLoginLink({
  children = "Post an item",
  className,
}: {
  children?: ReactNode;
  className: string;
}) {
  return (
    <Link href={POST_ITEM_LOGIN_PATH} className={className}>
      {children}
      <ArrowUpRight />
      <NavigationPending />
    </Link>
  );
}
