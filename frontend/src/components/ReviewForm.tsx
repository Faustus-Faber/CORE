import { FormEvent, useState } from "react";

import { submitReview } from "../services/api";
import type { InteractionContext } from "../types";

type Props = {
    volunteerId: string;
    onSuccess?: () => void;
};

function StarPicker({
    value,
    onChange
}: {
    value: number;
    onChange: (rating: number) => void;
}) {
    const [hovered, setHovered] = useState(0);

    return (
        <div className="flex gap-1" role="group" aria-label="Star rating">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    aria-label={`${star} star${star !== 1 ? "s" : ""}`}
                    onClick={() => onChange(star)}
                    onMouseEnter={() => setHovered(star)}
                    onMouseLeave={() => setHovered(0)}
                    className="text-2xl leading-none transition-transform hover:scale-110 focus:outline-none"
                >
                    <span
                        className={
                            star <= (hovered || value)
                                ? "text-amber-400"
                                : "text-slate-300"
                        }
                    >
                        ★
                    </span>
                </button>
            ))}
        </div>
    );
}

const INTERACTION_CONTEXT_LABELS: { value: InteractionContext; label: string }[] = [
    { value: "RESCUE_OPERATION", label: "Rescue Operation" },
    { value: "MEDICAL_AID", label: "Medical Aid" },
    { value: "SUPPLY_DISTRIBUTION", label: "Supply Distribution" },
    { value: "SHELTER_MANAGEMENT", label: "Shelter Management" },
    { value: "OTHER", label: "Other" }
];

export function ReviewForm({ volunteerId, onSuccess }: Props) {
    const [rating, setRating] = useState(0);
    const [text, setText] = useState("");
    const [interactionContext, setInteractionContext] = useState<InteractionContext>("OTHER");
    const [interactionDate, setInteractionDate] = useState("");
    const [wouldWorkAgain, setWouldWorkAgain] = useState<boolean | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError("");
        setSuccessMessage("");

        if (rating === 0) {
            setError("Please select a star rating.");
            return;
        }

        if (wouldWorkAgain === null) {
            setError("Please select if you would work with this volunteer again.");
            return;
        }

        setIsSubmitting(true);
        try {
            await submitReview(
                volunteerId,
                rating,
                text,
                interactionContext,
                interactionDate,
                wouldWorkAgain
            );
            setSuccessMessage("Your review has been submitted. Thank you!");
            setRating(0);
            setText("");
            setInteractionContext("OTHER");
            setInteractionDate("");
            setWouldWorkAgain(null);
            onSuccess?.();
        } catch (submitError) {
            setError(
                submitError instanceof Error ? submitError.message : "Could not submit review"
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const maxDate = new Date().toISOString().split("T")[0];

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <p className="mb-1 text-sm font-medium text-ink">Your Rating</p>
                <StarPicker value={rating} onChange={setRating} />
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium text-ink">
                    Interaction Context
                </label>
                <select
                    value={interactionContext}
                    onChange={(e) => setInteractionContext(e.target.value as InteractionContext)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-ink focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                >
                    {INTERACTION_CONTEXT_LABELS.map((ctx) => (
                        <option key={ctx.value} value={ctx.value}>
                            {ctx.label}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium text-ink">
                    Date of Interaction
                </label>
                <input
                    type="date"
                    value={interactionDate}
                    onChange={(e) => setInteractionDate(e.target.value)}
                    max={maxDate}
                    required
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-ink focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                />
            </div>

            <label className="block space-y-1 text-sm font-medium text-ink">
                Your Review
                <textarea
                    id="review-text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    required
                    minLength={20}
                    rows={4}
                    placeholder="Share your experience with this volunteer (minimum 20 characters)…"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-ink placeholder-slate-400 focus:border-tide focus:outline-none focus:ring-1 focus:ring-tide"
                />
            </label>

            <div>
                <p className="mb-2 text-sm font-medium text-ink">Would you work with this volunteer again?</p>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                        <input
                            type="radio"
                            name="wouldWorkAgain"
                            value="yes"
                            checked={wouldWorkAgain === true}
                            onChange={() => setWouldWorkAgain(true)}
                            className="h-4 w-4 text-tide focus:ring-tide"
                        />
                        <span className="text-sm text-ink">Yes</span>
                    </label>
                    <label className="flex items-center gap-2">
                        <input
                            type="radio"
                            name="wouldWorkAgain"
                            value="no"
                            checked={wouldWorkAgain === false}
                            onChange={() => setWouldWorkAgain(false)}
                            className="h-4 w-4 text-amber-600 focus:ring-amber-600"
                        />
                        <span className="text-sm text-ink">No</span>
                    </label>
                </div>
            </div>

            {successMessage && (
                <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
                    {successMessage}
                </p>
            )}
            {error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <button
                type="submit"
                id="submit-review-btn"
                disabled={isSubmitting}
                className="w-full rounded-md bg-tide px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
                {isSubmitting ? "Submitting…" : "Submit Review"}
            </button>
        </form>
    );
}
