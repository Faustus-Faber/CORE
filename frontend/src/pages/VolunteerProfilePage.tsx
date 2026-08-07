import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ReviewForm } from "../components/ReviewForm";
import { ReviewList } from "../components/ReviewList";
import { TrustTierBadge } from "../components/TrustTierBadge";
import { useAuth } from "../context/AuthContext";
import { createVouchApi, getEligibleReviewCrises, getVolunteerProfile } from "../services/api";
import { normalizeTrustTier, getTierLevel, TRUST_TIER_LABEL } from "../utils/trustTier";
import type { EligibleReviewCrisis, Role, Vouch } from "../types";

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
    trustTier?: string;
    totalPoints?: number;
    totalVerifiedHours?: number;
    vouchesReceived?: Vouch[];
};

export function VolunteerProfilePage() {
    const { volunteerId } = useParams<{ volunteerId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [reviewRefreshKey, setReviewRefreshKey] = useState(0);
    const [volunteer, setVolunteer] = useState<VolunteerProfile | null>(null);
    const [eligibleCrises, setEligibleCrises] = useState<EligibleReviewCrisis[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [vouchReason, setVouchReason] = useState("");
    const [vouchSubmitting, setVouchSubmitting] = useState(false);
    const [vouchMessage, setVouchMessage] = useState("");
    const canReview = user?.role === "USER";

    // Vouching: only RESPONDER+ volunteers can vouch, and not for themselves
    const myTier = user?.trustTier ?? "REPORTER";
    const myTierLevel = user?.role === "ADMIN" ? 4 : getTierLevel(normalizeTrustTier(myTier));
    const canVouch = user?.role === "VOLUNTEER" && myTierLevel >= 2 && user?.id !== volunteerId;
    const volunteerTier = normalizeTrustTier(volunteer?.trustTier);
    const alreadyVouched = volunteer?.vouchesReceived?.some(v => v.vouchedById === user?.id) ?? false;

    useEffect(() => {
        if (!volunteerId) {
            navigate("/volunteers");
            return;
        }

        const loadVolunteer = async () => {
            setIsLoading(true);
            setError("");
            try {
                const [profileResponse, eligibleCrisesResponse] = await Promise.all([
                    getVolunteerProfile(volunteerId),
                    canReview
                        ? getEligibleReviewCrises(volunteerId)
                        : Promise.resolve({ crises: [] })
                ]);

                setVolunteer(profileResponse.volunteer);
                setEligibleCrises(eligibleCrisesResponse.crises);
            } catch (loadError) {
                setError(loadError instanceof Error ? loadError.message : "Could not load volunteer profile");
            } finally {
                setIsLoading(false);
            }
        };

        void loadVolunteer();
    }, [volunteerId, navigate, canReview, reviewRefreshKey]);

    if (!volunteerId) return null;

    const handleVouch = async () => {
        if (!volunteerId || !vouchReason.trim()) return;
        setVouchSubmitting(true);
        setVouchMessage("");
        try {
            await createVouchApi({ vouchedForId: volunteerId, reason: vouchReason.trim() });
            setVouchMessage("Vouch submitted successfully!");
            setVouchReason("");
            // Refresh profile to show the new vouch
            const profileResponse = await getVolunteerProfile(volunteerId);
            setVolunteer(profileResponse.volunteer);
        } catch (err) {
            setVouchMessage(err instanceof Error ? err.message : "Failed to submit vouch");
        } finally {
            setVouchSubmitting(false);
        }
    };

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
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-ink">{volunteer.fullName}</h1>
                            <TrustTierBadge tier={volunteer.trustTier} size="md" />
                        </div>
                        <p className="mt-2 text-slate-700">
                            {volunteer.location || "Earth"}
                        </p>
                        {(volunteer.totalPoints != null || volunteer.totalVerifiedHours != null) && (
                            <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                                {volunteer.totalPoints != null && <span>{volunteer.totalPoints} points</span>}
                                {volunteer.totalVerifiedHours != null && <span>{volunteer.totalVerifiedHours} verified hours</span>}
                                {volunteer.vouchesReceived && volunteer.vouchesReceived.length > 0 && (
                                    <span>{volunteer.vouchesReceived.length} vouch{volunteer.vouchesReceived.length !== 1 ? "es" : ""}</span>
                                )}
                            </div>
                        )}
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
                            Share your crisis-scoped experience working with this volunteer.
                        </p>
                        <p className="mb-4 text-xs text-slate-500">
                            Eligible crisis cards: {eligibleCrises.length}
                        </p>
                        <ReviewForm
                            volunteerId={volunteerId}
                            eligibleCrises={eligibleCrises}
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

            {/* Vouching section */}
            {canVouch && (
                <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
                    <h2 className="mb-2 text-lg font-bold text-ink flex items-center gap-2">
                        <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        Vouch for {volunteer.fullName}
                    </h2>
                    {alreadyVouched ? (
                        <p className="text-sm text-slate-600 bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                            You have already vouched for this volunteer.
                        </p>
                    ) : (
                        <>
                            <p className="mb-3 text-sm text-slate-500">
                                As a {TRUST_TIER_LABEL[normalizeTrustTier(myTier)]}, you can vouch for this volunteer's reliability.
                                A vouch helps them advance to the next trust tier.
                            </p>
                            <textarea
                                value={vouchReason}
                                onChange={(e) => setVouchReason(e.target.value)}
                                rows={3}
                                maxLength={500}
                                placeholder="Describe why you trust this volunteer..."
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-tide focus:outline-none"
                            />
                            {vouchMessage && (
                                <p className={`mt-2 rounded-lg px-3 py-2 text-sm ${
                                    vouchMessage.includes("success")
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-red-50 text-red-700"
                                }`}>
                                    {vouchMessage}
                                </p>
                            )}
                            <button
                                type="button"
                                disabled={vouchSubmitting || !vouchReason.trim()}
                                onClick={() => void handleVouch()}
                                className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                            >
                                {vouchSubmitting ? "Submitting..." : "Submit Vouch"}
                            </button>
                        </>
                    )}
                </section>
            )}

            {/* Vouches received */}
            {volunteer.vouchesReceived && volunteer.vouchesReceived.length > 0 && (
                <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
                    <h2 className="mb-4 text-lg font-bold text-ink">
                        Vouches Received ({volunteer.vouchesReceived.length})
                    </h2>
                    <div className="space-y-3">
                        {volunteer.vouchesReceived.map((vouch) => (
                            <div key={vouch.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-ink">{vouch.vouchedByName}</p>
                                    <p className="text-xs text-slate-600">{vouch.reason}</p>
                                    <p className="mt-1 text-[11px] text-slate-400">{new Date(vouch.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
