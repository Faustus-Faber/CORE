import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg rounded-xl bg-white p-8 text-center shadow-panel ring-1 ring-slate-200">
      <h1 className="text-4xl font-bold text-ink">404</h1>
      <p className="mt-2 text-slate-700">Page not found.</p>
      <Link to="/" className="mt-5 inline-block rounded-md bg-tide px-4 py-2 text-white">
        Return Home
      </Link>
    </div>
  );
}
