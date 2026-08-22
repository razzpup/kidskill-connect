export default function AdminLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-[var(--line)]" />
      <div className="mt-3 h-4 w-40 rounded-full bg-[var(--line)]" />
      <div className="mt-8 h-80 rounded-2xl border border-line bg-[var(--card)]" />
    </div>
  )
}
