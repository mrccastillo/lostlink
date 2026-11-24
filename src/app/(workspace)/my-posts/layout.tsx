import "../../my-posts/my-posts.css";

import { ReportWorkspace } from "@/components/report-workspace";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ReportWorkspace label="YOUR REPORTS" title="My posts"
      description="Track the lost and found items you’ve reported.">
      {children}
    </ReportWorkspace>
  );
}
