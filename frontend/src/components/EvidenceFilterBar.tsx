interface EvidenceFilterBarProps {
  filter: string;
  setFilter: (f: string) => void;
  sort: string;
  setSort: (s: string) => void;
}

export function EvidenceFilterBar({ filter, setFilter, sort, setSort }: EvidenceFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Show:</span>
        <div className="flex rounded-lg bg-slate-100 p-1">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-md px-3 py-1 text-sm font-medium transition ${
              filter === "all" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("verified")}
            className={`rounded-md px-3 py-1 text-sm font-medium transition ${
              filter === "verified" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Verified Only
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Sort:</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border-none bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
      </div>
    </div>
  );
}
