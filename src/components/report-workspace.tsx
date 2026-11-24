import { Suspense, type ReactNode } from "react";
import { ReportButton } from "@/features/landing/report-button";
import { PostModal } from "@/features/post/post-modal";

type Props = { label: string; title: string; description: string; children: ReactNode };

export function ReportWorkspace({ label, title, description, children }: Props) {
  return (
    <>
      <header className="discover-topbar"><span>{label}</span></header>
      <main className="discover-main" id="workspace-main">
        <div className="discover-heading">
          <div><h1>{title}</h1><p>{description}</p></div>
          <ReportButton />
        </div>
        {children}
      </main>
      <Suspense fallback={null}><PostModal /></Suspense>
    </>
  );
}
