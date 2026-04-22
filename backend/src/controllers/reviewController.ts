import type { NextFunction, Request, Response } from "express";

import {
    approveReview,
    approveVolunteer,
    banVolunteer,
    deleteReview,
    getVolunteerReviews,
    listEligibleReviewCrises,
    listFlaggedReviews,
    listFlaggedVolunteers,
    submitReview
} from "../services/reviewService.js";

export async function createReview(
    request: Request,
    response: Response,
    _next: NextFunction
) {
    const reviewerId = request.authUser?.userId;

    if (!reviewerId) {
        return response.status(401).json({ message: "Authentication required" });
    }

    const review = await submitReview(reviewerId, request.body);
    return response.status(201).json({ message: "Review submitted", review });
}

export async function getVolunteerReviewsHandler(
    request: Request,
    response: Response,
    _next: NextFunction
) {
    const volunteerId = String(request.params.volunteerId);
    const result = await getVolunteerReviews(volunteerId);
    return response.status(200).json(result);
}

export async function getEligibleReviewCrisesHandler(
    request: Request,
    response: Response,
    _next: NextFunction
) {
    const reviewerId = request.authUser?.userId;
    if (!reviewerId) {
        return response.status(401).json({ message: "Authentication required" });
    }

    const volunteerId = String(request.params.volunteerId);
    const crises = await listEligibleReviewCrises(reviewerId, volunteerId);
    return response.status(200).json({ crises });
}

export async function getFlaggedReviewsHandler(
    _request: Request,
    response: Response,
    _next: NextFunction
) {
    const reviews = await listFlaggedReviews();
    return response.status(200).json({ reviews });
}

export async function getFlaggedVolunteersHandler(
    _request: Request,
    response: Response,
    _next: NextFunction
) {
    const volunteers = await listFlaggedVolunteers();
    return response.status(200).json({ volunteers });
}

export async function approveReviewHandler(
    request: Request,
    response: Response,
    _next: NextFunction
) {
    const reviewId = String(request.params.id);
    await approveReview(reviewId);
    return response.status(200).json({ message: "Review approved" });
}

export async function deleteReviewHandler(
    request: Request,
    response: Response,
    _next: NextFunction
) {
    const reviewId = String(request.params.id);
    await deleteReview(reviewId);
    return response.status(200).json({ message: "Review deleted" });
}

export async function approveVolunteerHandler(
    request: Request,
    response: Response,
    _next: NextFunction
) {
    const volunteerId = String(request.params.id);
    await approveVolunteer(volunteerId);
    return response.status(200).json({ message: "Volunteer flag cleared" });
}

export async function banVolunteerHandler(
    request: Request,
    response: Response,
    _next: NextFunction
) {
    const volunteerId = String(request.params.id);
    await banVolunteer(volunteerId);
    return response.status(200).json({ message: "Volunteer banned" });
}
