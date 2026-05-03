import ResourceMap from "../components/ResourceMap";

export default function MapPage() {
  return (
    <section className="fixed inset-0 top-[57px] flex flex-col overflow-hidden sm:top-[64px]">
      <div className="shrink-0 border-b bg-white p-3 sm:p-5">
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Emergency Resources Map</h1>
        <p className="mt-1 text-sm text-slate-700 sm:mt-2 sm:text-base">
          View all available emergency resources on the map. Click on a marker to see details and reserve resources.
        </p>
      </div>
      <div className="min-h-0 flex-1 w-full overflow-hidden">
        <ResourceMap />
      </div>
    </section>
  );
}
