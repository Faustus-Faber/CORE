import ResourceMap from "../components/ResourceMap";

export default function MapPage() {
  return (
    <div className="space-y-4">
      {/* Header Box Card matching Report Incident Page */}
      <div className="rounded-xl border border-[#0e7490]/30 bg-white p-5 sm:p-6 shadow-panel ring-1 ring-[#0e7490]/20">
        <h1 className="text-2xl font-bold tracking-tight text-ink font-display">
          Emergency Resources Map
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          View all available emergency resources on the map. Click on a marker to see details and reserve resources.
        </p>
      </div>

      {/* Framed Map Container */}
      <div className="relative h-[calc(100vh-250px)] min-h-[500px] w-full overflow-hidden rounded-2xl border border-[#0e7490]/30 bg-white shadow-panel ring-1 ring-[#0e7490]/20">
        <ResourceMap />
      </div>
    </div>
  );
}
