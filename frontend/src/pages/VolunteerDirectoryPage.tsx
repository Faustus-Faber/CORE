import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listVolunteers } from "../services/api";
import type { AuthUser } from "../types";

export function VolunteerDirectoryPage() {
    const [volunteers, setVolunteers] = useState<AuthUser[]>([]);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    // Filter States
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
    const [availability, setAvailability] = useState<string[]>([]);
    const [minRating, setMinRating] = useState<number>(0);
    const [radiusKm, setRadiusKm] = useState<number>(50);
    const [sortBy, setSortBy] = useState<string>("alphabetical");

    // Geolocation
    const [lat, setLat] = useState<number | null>(null);
    const [lng, setLng] = useState<number | null>(null);

    const PRESET_SKILLS = ["First Aid", "Search & Rescue", "Medical", "Logistics", "Shelter", "Communications"];
    const AVAILABILITY_OPTS = ["Available", "Busy", "Offline"];

    function requestLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setLat(pos.coords.latitude);
                    setLng(pos.coords.longitude);
                    if (sortBy === "alphabetical") setSortBy("nearest");
                },
                (err) => {
                    alert("Could not access location. Please enable it in your browser.");
                }
            );
        } else {
            alert("Geolocation is not supported by your browser.");
        }
    }

    const toggleSkill = (skill: string) => {
        setSelectedSkills(prev => 
            prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
        );
    };

    const toggleAvailability = (opt: string) => {
        setSelectedSkills(prev => prev); // dummy
        setAvailability(prev => 
            prev.includes(opt) ? prev.filter(a => a !== opt) : [...prev, opt]
        );
    };

    useEffect(() => {
        async function load() {
            setIsLoading(true);
            try {
                const response = await listVolunteers({ 
                    search: searchQuery,
                    skills: selectedSkills,
                    availability: availability,
                    minRating: minRating > 0 ? minRating : undefined,
                    lat,
                    lng,
                    radiusKm: radiusKm,
                    sortBy
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
    }, [searchQuery, selectedSkills, availability, minRating, lat, lng, radiusKm, sortBy]);

    return (
        <div className="flex flex-col gap-6 md:flex-row">
            {/* Sidebar Filters */}
            <aside className="w-full shrink-0 md:w-64 space-y-6">
                <div className="rounded-xl bg-white p-5 shadow-panel ring-1 ring-slate-200">
                    <h2 className="mb-4 text-lg font-bold text-ink">Filters</h2>
                    
                    {/* Text Search */}
                    <div className="mb-5">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Search</label>
                        <input 
                            type="text" 
                            placeholder="Name or keyword..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                        />
                    </div>

                    {/* Proximity Slider */}
                    <div className="mb-5">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Proximity</label>
                        {!lat ? (
                            <button 
                                onClick={requestLocation}
                                className="w-full rounded bg-slate-100 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                            >
                                📍 Use My Location
                            </button>
                        ) : (
                            <div>
                                <p className="text-xs text-green-600 mb-2">✓ Location Active</p>
                                <input 
                                    type="range" 
                                    min="1" max="50" 
                                    value={radiusKm} 
                                    onChange={e => setRadiusKm(Number(e.target.value))}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>1 km</span>
                                    <span>{radiusKm} km</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sorting */}
                    <div className="mb-5">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Sort By</label>
                        <select 
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                        >
                            <option value="alphabetical">Alphabetical (A-Z)</option>
                            <option value="highest_rated">Highest Rated</option>
                            {lat && <option value="nearest">Nearest First</option>}
                        </select>
                    </div>

                    {/* Minimum Rating */}
                    <div className="mb-5">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Mimimum Rating</label>
                        <input 
                            type="range" 
                            min="0" max="5" 
                            value={minRating} 
                            onChange={e => setMinRating(Number(e.target.value))}
                            className="w-full"
                        />
                        <div className="text-xs text-slate-500 text-center">
                            {minRating === 0 ? "Any Rating" : `${minRating} Stars & Up`}
                        </div>
                    </div>

                    {/* Skills Filter */}
                    <div className="mb-5">
                        <label className="mb-2 block text-sm font-medium text-slate-700">Skills</label>
                        <div className="space-y-2">
                            {PRESET_SKILLS.map(skill => (
                                <label key={skill} className="flex items-center gap-2 text-sm text-slate-700">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedSkills.includes(skill)}
                                        onChange={() => toggleSkill(skill)}
                                        className="rounded border-slate-300 text-tide focus:ring-tide"
                                    />
                                    {skill}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Availability Filter */}
                    <div className="mb-2">
                        <label className="mb-2 block text-sm font-medium text-slate-700">Availability</label>
                        <div className="space-y-2">
                            {AVAILABILITY_OPTS.map(opt => (
                                <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                                    <input 
                                        type="checkbox" 
                                        checked={availability.includes(opt)}
                                        onChange={() => toggleAvailability(opt)}
                                        className="rounded border-slate-300 text-tide focus:ring-tide"
                                    />
                                    {opt}
                                </label>
                            ))}
                        </div>
                    </div>

                </div>
            </aside>

            {/* Results Area */}
            <main className="flex-1 space-y-6">
                <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
                    <h1 className="text-2xl font-bold tracking-tight text-ink">Volunteer Directory</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Showing {volunteers.length} verified responders
                    </p>
                </section>

                {error && (
                    <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
                )}

                {isLoading ? (
                    <p className="text-sm text-slate-500">Loading volunteers...</p>
                ) : volunteers.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
                        <p className="text-sm font-medium text-slate-500">No volunteers match your criteria.</p>
                        <button 
                            onClick={() => {
                                setSearchQuery("");
                                setSelectedSkills([]);
                                setAvailability([]);
                                setMinRating(0);
                                setRadiusKm(50);
                            }}
                            className="mt-4 text-sm font-bold text-tide hover:underline"
                        >
                            Clear all filters
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                        {volunteers.map((volunteer) => (
                            <Link
                                key={volunteer.id}
                                to={`/volunteers/${volunteer.id}`}
                                className="group relative block rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md hover:ring-tide"
                            >
                                {volunteer.isFlagged && (
                                    <span className="absolute -right-2 -top-2 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 shadow-sm ring-1 ring-red-200">
                                        ⚠️ Flagged
                                    </span>
                                )}

                                <div className="flex items-start gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-500 group-hover:bg-tide/10 group-hover:text-tide">
                                        {volunteer.fullName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="truncate font-bold text-ink group-hover:text-tide">
                                            {volunteer.fullName}
                                        </h3>
                                        <p className="truncate text-xs text-slate-500">{volunteer.location || "Location not provided"}</p>
                                        
                                        <div className="mt-1 flex items-center gap-2 text-xs">
                                            <span className="font-medium text-amber-500">
                                                ★ {volunteer.avgRating || 0}
                                            </span>
                                            <span className="text-slate-400">({volunteer.reviewCount || 0})</span>
                                            
                                            {volunteer.distance !== undefined && (
                                                <>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="text-slate-500">{volunteer.distance}km</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                        (volunteer.availability || "").toLowerCase() === "available" 
                                        ? "bg-green-100 text-green-700"
                                        : (volunteer.availability || "").toLowerCase() === "busy"
                                            ? "bg-amber-100 text-amber-700"
                                            : "bg-slate-100 text-slate-700"
                                    }`}>
                                        {volunteer.availability || "Offline"}
                                    </span>

                                    {volunteer.skills && volunteer.skills.length > 0 && (
                                        <div className="flex -space-x-1">
                                            {volunteer.skills.slice(0, 3).map((skill, idx) => (
                                                <div key={idx} className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600 ring-2 ring-white" title={skill}>
                                                    {skill.substring(0, 1)}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
