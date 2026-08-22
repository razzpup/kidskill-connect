/**
 * The spine's skeleton keeps the rail, because the rail is the thing being waited for.
 * A generic three-grey-bars skeleton would tell the parent nothing about what is coming.
 */
export default function ParentLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-24 rounded-full bg-[var(--line)]" />
      <div className="mt-3.5 h-8 w-40 rounded-lg bg-[var(--line)]" />
      <div className="mt-3.5 h-4 w-64 rounded-full bg-[var(--line)]" />

      <div className="mt-6 h-[4.75rem] rounded-2xl border border-line bg-[var(--card)]" />

      <div className="mt-9 space-y-7">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid grid-cols-[3.25rem_1.75rem_1fr]">
            <div className="pt-3">
              <div className="ml-auto h-4 w-6 rounded bg-[var(--line)]" />
              <div className="ml-auto mt-1.5 h-2.5 w-7 rounded bg-[var(--line)]" />
            </div>
            <div className="relative flex justify-center">
              <span className="absolute inset-y-0 w-[3px] rounded-full bg-[var(--line)]" />
              <span className="absolute top-[0.85rem] h-[9px] w-[9px] rounded-full bg-[var(--line)]" />
            </div>
            <div className="h-28 rounded-2xl border border-line bg-[var(--card)]" />
          </div>
        ))}
      </div>
    </div>
  )
}
