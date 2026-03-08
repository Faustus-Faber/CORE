import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ReviewForm } from "../components/ReviewForm";
import { ReviewList } from "../components/ReviewList";
import { useAuth } from "../context/AuthContext";
import { getVolunteerProfile } from "../services/api";
import type { Role } from "../types";

type VolunteerProfile = {
    id: string;
    fullName: string;
    email: string;
    location: string;
    role: Role;
    skills: string[];
    availability?: string | null;
    certifications?: string | null;
    avatarUrl?: string | null;
    isFlagged: boolean;
    volunteerFlagReasons: string[];
};

export function VolunteerProfilePage() {
    const { volunteerId } = useParams<{ volunteerId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [reviewRefreshKey, setReviewRefreshKey] = useState(0);
    const [volunteer, setVolunteer] = useState<VolunteerProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!volunteerId) {
            navigate("/volunteers");
            return;
        }

        const loadVolunteer = async () => {
            setIsLoading(true);
            setError("");
            try {
                const data = await getVolunteerProfile(volunteerId);
                setVolunteer(data.volunteer);
            } catch (loadError) {
                setError(loadError instanceof Error ? loadError.message : "Could not load volunteer profile");
            } finally {
                setIsLoading(false);
            }
        };

        void loadVolunteer();
    }, [volunteerId, navigate]);

    useEffect(() => {
        if (!volunteerId) {
            navigate("/volunteers");
        }
    }, [volunteerId, navigate]);

    if (!volunteerId) return null;

    const canReview = user?.role === "USER";

    if (isLoading) {
        return (
            <div className="space-y-6">
                <p className="text-center text-slate-500">Loading volunteer profile…</p>
            </div>
        );
    }

    if (error || !volunteer) {
        return (
            <div className="space-y-6">
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error || "Volunteer not found"}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-ink">{volunteer.fullName}</h1>
                        <p className="mt-2 text-slate-700">
                            {volunteer.location || "Earth"}
                        </p>
                    </div>
                    {volunteer.isFlagged && (
                        <div className="rounded-md bg-amber-50 px-4 py-2 ring-1 ring-amber-200">
                            <p className="flex items-center gap-2 text-sm font-medium text-amber-700">
                                ⚠️ Volunteer Under Review
                            </p>
                            <ul className="mt-2 list-inside list-disc text-xs text-amber-600">
                                {volunteer.volunteerFlagReasons.map((reason, idx) => (
                                    <li key={idx}>{reason}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                {volunteer.skills && volunteer.skills.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {volunteer.skills.map((skill, idx) => (
                            <span
                                key={idx}
                                className="rounded-full bg-tide/10 px-3 py-1 text-xs font-medium text-tide"
                            >
                                {skill}
                            </span>
                        ))}
                    </div>
                )}
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Reviews list */}
                <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
                    <h2 className="mb-4 text-lg font-bold text-ink">Reviews</h2>
                    <ReviewList
                        volunteerId={volunteerId}
                        refreshKey={reviewRefreshKey}
                    />
                </section>

                {/* Review form — only for USER role */}
                {canReview && (
                    <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
                        <h2 className="mb-1 text-lg font-bold text-ink">Leave a Review</h2>
                        <p className="mb-4 text-sm text-slate-500">
                            Share your experience working with this volunteer.
                        </p>
                        <ReviewForm
                            volunteerId={volunteerId}
                            onSuccess={() => setReviewRefreshKey((k) => k + 1)}
                        />
                    </section>
                )}

                {!canReview && user?.role === "VOLUNTEER" && (
                    <section className="rounded-xl bg-slate-50 p-6 ring-1 ring-slate-200">
                        <p className="text-sm text-slate-500">
                            Volunteers cannot submit reviews for other volunteers.
                        </p>
                    </section>
                )}
            </div>
        </div>
    );
}
