import { AppSidebar } from "@/components/app-sidebar";
import "../discover/discover.css";
import "./skeleton.css";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="discover-shell">
      <a className="skip-link" href="#workspace-content">Skip to workspace content</a>
      <AppSidebar />
      <div className="discover-workspace" id="workspace-content" tabIndex={-1}>{children}</div>
    </div>
  );
}
