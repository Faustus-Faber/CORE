import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listVolunteers } from "../services/api";

type VolunteerItem = {
    id: string;
    fullName: string;
    email: string;
    location: string;
};

export function VolunteerDirectoryPage() {
    const [volunteers, setVolunteers] = useState<VolunteerItem[]>([]);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const response = await listVolunteers();
                setVolunteers(response.volunteers);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load directory");
            } finally {
                setIsLoading(false);
            }
        }
        void load();
    }, []);

    return (
        <div className="space-y-6">
            <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
                <h1 className="text-3xl font-bold tracking-tight text-ink">Volunteer Directory</h1>
                <p className="mt-2 text-slate-700">
                    Browse our verified public responders and leave reviews for the community.
                </p>
            </section>

            {error && (
                <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
            )}

            {isLoading ? (
                <p className="text-sm text-slate-500">Loading volunteers...</p>
            ) : volunteers.length === 0 ? (
                <p className="text-sm text-slate-500">No volunteers found in the system yet.</p>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {volunteers.map((volunteer) => (
                        <Link
                            key={volunteer.id}
                            to={`/volunteers/${volunteer.id}`}
                            className="group block rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md hover:ring-tide"
                        >
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-500 group-hover:bg-tide/10 group-hover:text-tide">
                                    {volunteer.fullName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-ink group-hover:text-tide">
                                        {volunteer.fullName}
                                    </h3>
                                    <p className="text-xs text-slate-500">{volunteer.location || "Earth"}</p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
