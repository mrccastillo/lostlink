import "../../../claims/claims.css";

export default function ClaimsLayout({ children }: { children: React.ReactNode }) {
  return <main className="claim-main" id="workspace-main">
    <header className="claim-page-heading"><p className="eyebrow">YOUR CLAIMS</p><h1>Claim status & verification</h1><p>Your latest 50 ownership requests, visible only to you.</p></header>
    {children}
  </main>;
}
