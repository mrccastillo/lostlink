export default function WorkspaceLoading() {
  return (
    <div className="discover-main" role="status">
      <span className="sr-only">Loading workspace content</span>
      <div aria-hidden="true">
        <div className="sk mb-6 h-10 w-64 max-w-full" />
        <div className="sk mb-10 h-4 w-96 max-w-full" />
        <div className="sk h-64 w-full" />
      </div>
    </div>
  );
}
