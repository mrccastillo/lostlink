import { ReportWorkspace } from "@/components/report-workspace";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ReportWorkspace label="THE COMMUNITY BOARD" title="Discover"
      description="Browse lost and found items in one place.">
      {children}
    </ReportWorkspace>
  );
}
