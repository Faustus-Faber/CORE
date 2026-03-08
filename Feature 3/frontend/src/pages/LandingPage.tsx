import { Link } from "react-router-dom";

const features = [
  {
    title: "Emergency Reporting",
    description: "Submit incidents with text, media, and AI-assisted severity tagging."
  },
  {
    title: "Interactive Crisis Map",
    description: "See active incidents and available local resources in real time."
  },
  {
    title: "Volunteer Network",
    description: "Coordinate trusted volunteers and dispatch support quickly."
  },
  {
    title: "Resource Hub",
    description: "Register, reserve, and track emergency supplies across communities."
  }
];

export function LandingPage() {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-white/80 p-8 shadow-panel ring-1 ring-slate-200">
        <p className="mb-2 text-sm font-bold uppercase tracking-wider text-moss">CORE Platform</p>
        <h1 className="max-w-2xl text-4xl font-bold leading-tight text-ink md:text-5xl">
          Real-time crisis response that starts at the community level
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-700">
          CORE helps people report emergencies, locate resources, and coordinate volunteers with
          role-based access and secure authentication.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/signup"
            className="rounded-md bg-tide px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700"
          >
            Get Started / Sign Up
          </Link>
          <Link
            to="/login"
            className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-slate-50"
          >
            Login
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold text-ink">Core Capabilities</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-xl bg-white p-5 shadow-panel ring-1 ring-slate-200">
              <h3 className="text-xl font-semibold text-ink">{feature.title}</h3>
              <p className="mt-2 text-slate-700">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-ink p-6 text-white">
        <h2 className="text-2xl font-bold">How It Works</h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          <li className="rounded-lg bg-white/10 p-4">1. Register as a User or Volunteer</li>
          <li className="rounded-lg bg-white/10 p-4">2. Report incidents or contribute resources</li>
          <li className="rounded-lg bg-white/10 p-4">3. Coordinate actions from your dashboard</li>
        </ol>
      </section>

      <section className="grid gap-4 rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200 md:grid-cols-3">
        <div>
          <p className="text-3xl font-bold text-ember">10K+</p>
          <p className="text-slate-700">Concurrent users supported</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-ember">99%</p>
          <p className="text-slate-700">Target uptime for active crisis periods</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-ember">24/7</p>
          <p className="text-slate-700">Role-aware monitoring and access controls</p>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-300 py-5 text-sm text-slate-600">
        <span>Contact: support@core.local</span>
        <div className="flex gap-4">
          <a href="https://x.com" target="_blank" rel="noreferrer">
            X
          </a>
          <a href="https://facebook.com" target="_blank" rel="noreferrer">
            Facebook
          </a>
          <a href="https://linkedin.com" target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </div>
      </footer>
    </div>
  );
}
