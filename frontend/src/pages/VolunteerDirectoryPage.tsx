import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listVolunteers, listCommunityReports } from "../services/api";
import type { IncidentReportListItem } from "../types";

type VolunteerItem = {
    id: string;
    fullName: string;
    email: string;
    location: string;
    skills?: string[];
};

export function VolunteerDirectoryPage() {
    const [volunteers, setVolunteers] = useState<VolunteerItem[]>([]);
    const [reports, setReports] = useState<IncidentReportListItem[]>([]);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    const [searchSkill, setSearchSkill] = useState("");
    const [searchLocation, setSearchLocation] = useState("");

    useEffect(() => {
        async function loadReports() {
            try {
                const response = await listCommunityReports();
                setReports(response.reports);
            } catch (err) {
                console.error("Failed to load reports", err);
            }
        }
        void loadReports();
    }, []);

    useEffect(() => {
        async function load() {
            setIsLoading(true);
            try {
                const response = await listVolunteers({ 
                    skill: searchSkill, 
                    location: searchLocation 
                });
                setVolunteers(response.volunteers);
                setError("");
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load directory");
            } finally {
                setIsLoading(false);
            }
        }
        
        const timeout = setTimeout(() => {
             void load();
        }, 300);
        return () => clearTimeout(timeout);
    }, [searchSkill, searchLocation]);

    return (
        <div className="space-y-6">
            <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
                <h1 className="text-3xl font-bold tracking-tight text-ink">Volunteer Directory</h1>
                <p className="mt-2 text-slate-700">
                    Browse our verified public responders and leave reviews for the community.
                </p>
                
                <div className="mt-6 flex flex-col gap-4 sm:flex-row">
                    <div className="flex-1">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Specialized Skills</label>
                        <input 
                            type="text" 
                            placeholder="Search by skill (e.g. First Aid, Medical)"
                            value={searchSkill}
                            onChange={(e) => setSearchSkill(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Proximity to Event</label>
                        <select 
                            value={searchLocation}
                            onChange={(e) => setSearchLocation(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                        >
                            <option value="">Any Location (No Event Active Filter)</option>
                            {reports.map((report) => (
                                <option key={report.id} value={report.locationText}>
                                    Event: {report.incidentTitle} - {report.locationText}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </section>

            {error && (
                <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
            )}

            {isLoading ? (
                <p className="text-sm text-slate-500">Loading volunteers...</p>
            ) : volunteers.length === 0 ? (
                <p className="text-sm text-slate-500">No volunteers match your criteria.</p>
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
                                <div className="flex-1">
                                    <h3 className="font-bold text-ink group-hover:text-tide line-clamp-1">
                                        {volunteer.fullName}
                                    </h3>
                                    <p className="text-xs text-slate-500 line-clamp-1">{volunteer.location || "Location not provided"}</p>
                                    {volunteer.skills && volunteer.skills.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {volunteer.skills.slice(0, 2).map((skill, idx) => (
                                                <span key={idx} className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                                    {skill}
                                                </span>
                                            ))}
                                            {volunteer.skills.length > 2 && (
                                                <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                                    +{volunteer.skills.length - 2} more
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
