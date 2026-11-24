export default function Loading() {
  return (
    <div role="status">
      <span className="sr-only">Loading items</span>
      <div aria-hidden="true">
        <div className="discover-search-row"><i className="sk h-[54px] flex-1" /><i className="sk w-24 sm:w-36" /></div>
        <div className="discover-filter-row">{[0, 1, 2, 3].map(i => <div className="min-w-30 flex-1" key={i}><i className="sk mb-2 h-2 w-14" /><i className="sk h-[42px]" /></div>)}</div>
        <div className="discover-results-bar py-4"><i className="sk h-3 w-52" /></div>
        <div className="discover-grid">{[0, 1, 2].map(i => (
          <div key={i}><div className="sk discover-item-photo" /><i className="sk mt-4 h-2 w-16" /><i className="sk my-3 h-5 w-2/3" /><i className="sk h-3 w-2/5" /></div>
        ))}</div>
      </div>
    </div>
  );
}
