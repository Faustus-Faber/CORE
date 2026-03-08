import { useEffect, useState } from "react";

import { getVolunteerReviews } from "../services/api";
import type { Review } from "../types";

type Props = {
    volunteerId: string;
    /** Pass a value that changes whenever a new review is submitted to trigger a refresh. */
    refreshKey?: number;
};

function StarDisplay({ rating }: { rating: number }) {
    return (
        <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((star) => (
                <span
                    key={star}
                    className={star <= rating ? "text-amber-400" : "text-slate-300"}
                >
                    ★
                </span>
            ))}
        </span>
    );
}

function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

const INTERACTION_CONTEXT_LABELS: Record<string, string> = {
    RESCUE_OPERATION: "Rescue Operation",
    MEDICAL_AID: "Medical Aid",
    SUPPLY_DISTRIBUTION: "Supply Distribution",
    SHELTER_MANAGEMENT: "Shelter Management",
    OTHER: "Other"
};

export function ReviewList({ volunteerId, refreshKey = 0 }: Props) {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [averageRating, setAverageRating] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setIsLoading(true);
            setError("");
            try {
                const data = await getVolunteerReviews(volunteerId);
                if (!cancelled) {
                    setReviews(data.reviews);
                    setAverageRating(data.averageRating);
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(
                        loadError instanceof Error ? loadError.message : "Could not load reviews"
                    );
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [volunteerId, refreshKey]);

    if (isLoading) {
        return (
            <p className="py-4 text-center text-sm text-slate-500">Loading reviews…</p>
        );
    }

    if (error) {
        return (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        );
    }

    return (
        <div className="space-y-4">
            {/* Average rating summary */}
            {averageRating !== null && reviews.length > 0 && (
                <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
                    <span className="text-3xl font-bold text-ink">
                        {averageRating.toFixed(1)}
                    </span>
                    <div>
                        <StarDisplay rating={Math.round(averageRating)} />
                        <p className="mt-0.5 text-xs text-slate-500">
                            Based on {reviews.length} review{reviews.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>
            )}

            {reviews.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">
                    No reviews yet. Be the first to review!
                </p>
            ) : (
                <ul className="space-y-3">
                    {reviews.map((review) => (
                        <li
                            key={review.id}
                            className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm"
                        >
                            <div className="mb-2 flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    {review.reviewer?.avatarUrl ? (
                                        <img
                                            src={review.reviewer.avatarUrl}
                                            alt={review.reviewer.fullName}
                                            className="h-8 w-8 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-tide/10 text-sm font-semibold text-tide">
                                            {review.reviewer?.fullName?.charAt(0).toUpperCase() ?? "?"}
                                        </div>
                                    )}
                                    <span className="text-sm font-semibold text-ink">
                                        {review.reviewer?.fullName ?? "Anonymous"}
                                    </span>
                                </div>
                                <div className="flex flex-col items-end gap-0.5">
                                    <StarDisplay rating={review.rating} />
                                    <span className="text-xs text-slate-400">{formatDate(review.createdAt)}</span>
                                </div>
                            </div>
                            
                            <div className="mb-2 flex gap-3 text-xs text-slate-500">
                                <span className="rounded bg-slate-100 px-2 py-1">
                                    {INTERACTION_CONTEXT_LABELS[review.interactionContext]}
                                </span>
                                <span className="rounded bg-slate-100 px-2 py-1">
                                    {formatDate(review.interactionDate)}
                                </span>
                            </div>
                            
                            <p className="text-sm leading-relaxed text-slate-700">{review.text}</p>
                            
                            <div className="mt-2 flex items-center gap-4 text-xs">
                                <span className={review.wouldWorkAgain ? "text-emerald-600" : "text-amber-600"}>
                                    {review.wouldWorkAgain ? "✓ Would work again" : "✗ Would not work again"}
                                </span>
                            </div>
                            
                            {review.isFlagged && (
                                <p className="mt-2 text-xs font-medium text-amber-600">
                                    ⚠ Flagged for review
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
