export default function Loading() {
  return (
    <div role="status">
      <span className="sr-only">Loading your posts</span>
      <div aria-hidden="true">
        <div className="my-posts-tabs py-4"><i className="sk h-3 w-44" /></div>
        <i className="sk my-5 h-3 w-80 max-w-full" />
        <div className="my-posts-list">{[0, 1, 2].map(i => (
          <div className="my-post" key={i}>
            <div className="my-post-top"><i className="sk h-3 w-24" /><i className="sk h-6 w-24" /></div>
            <i className="sk my-3 h-6 w-2/5" /><i className="sk h-3 w-1/3" /><i className="sk mt-5 h-3 w-28" />
          </div>
        ))}</div>
      </div>
    </div>
  );
}
