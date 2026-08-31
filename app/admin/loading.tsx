export default function AdminLoading() {
  return (
    <div className="p-6 space-y-4 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-44 rounded-lg bg-gray-200" />
      <div className="h-4 w-72 rounded bg-gray-100" />
      <div className="h-52 rounded-xl bg-gray-100" />
    </div>
  );
}
