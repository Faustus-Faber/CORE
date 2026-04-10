import ResourceMap from "../components/ResourceMap";

export default function MapPage() {
  return (
    <section className="w-full h-full flex flex-col overflow-hidden">
      <div className="shrink-0 p-5 bg-white border-b">
        <h1 className="text-2xl font-bold text-ink">🗺️ Emergency Resources Map</h1>
        <p className="mt-2 text-slate-700">
          View all available emergency resources on the map. Click on a marker to see details and reserve resources.
        </p>
      </div>
      <div className="flex-1 w-full overflow-hidden">
        <ResourceMap />
      </div>
    </section>
  );
}
