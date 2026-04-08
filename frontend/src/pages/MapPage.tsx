import ResourceMap from "../components/ResourceMap";

export default function MapPage() {
  return (
    <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
      <h1 className="text-2xl font-bold text-ink">🗺️ Emergency Resources Map</h1>
      <p className="mt-2 text-slate-700">
        View all available emergency resources on the map. Click on a marker to see details and reserve resources.
      </p>
      <div className="mt-6">
        <ResourceMap />
      </div>
    </section>
  );
}
