export function PlaceholderPage({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-2 text-slate-700">{description}</p>
    </section>
  );
}
