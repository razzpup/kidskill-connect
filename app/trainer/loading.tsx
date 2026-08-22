export default function TrainerLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-40 rounded-full bg-[var(--line)]" />
      <div className="mt-3.5 h-8 w-64 rounded-lg bg-[var(--line)]" />
      <div className="mt-8 space-y-2.5">
        {[0, 1].map((i) => (
          <div key={i} className="h-[11.5rem] rounded-2xl border border-line bg-[var(--card)]" />
        ))}
      </div>
    </div>
  )
}
