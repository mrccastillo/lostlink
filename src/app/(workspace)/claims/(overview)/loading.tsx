export default function Loading() {
  return (
    <div role="status">
      <span className="sr-only">Loading your claims</span>
      <div aria-hidden="true">
        <div className="claim-list">{[0, 1, 2, 3].map(i => (
          <div key={i} className="flex items-center justify-between border-b border-[#c1c1b5] py-5">
            <i className="sk h-4 w-36" /><i className="sk h-3 w-16" />
          </div>
        ))}</div>
      </div>
    </div>
  );
}
