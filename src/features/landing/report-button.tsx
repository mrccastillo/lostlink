import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "@/components/icons";
import { POST_ITEM_LOGIN_PATH } from "@/lib/auth/policy";

type ReportButtonProps = { children?: ReactNode; className?: string };

export function ReportButton({
  children = "Post an item",
  className = "button button-yellow",
}: ReportButtonProps) {
  return (
    <Link className={className} href={POST_ITEM_LOGIN_PATH}>
      {children}
      <ArrowUpRight />
    </Link>
  );
}
