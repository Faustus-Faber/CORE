# Module 1 Feature 3: Volunteer Reviews & Fraud Detection - Implementation Plan

## Scope
Deliver the comprehensive volunteer review system with multi-level fraud detection from Module 1.3 in `docs/SRS.md`:
- Structured review submission with 6 fields (rating, context, date, text, would-work-again, crisis-event-ID)
- Review-level fraud detection (4 rules)
- Volunteer-level fraud detection (3 rules)
- Admin moderation for flagged reviews and volunteers
- Warning badges on flagged volunteer profiles
- Average rating calculation and display

## Architecture
- `backend/`: Express + TypeScript + Prisma (MongoDB) API with fraud detection service logic
- `frontend/`: React + TypeScript + Tailwind UI with interactive review forms and admin moderation tables
- Fraud detection runs automatically on every review submission and moderation action

## Backend Design

### Prisma Schema Extensions
```prisma
enum InteractionContext {
  RESCUE_OPERATION
  MEDICAL_AID
  SUPPLY_DISTRIBUTION
  SHELTER_MANAGEMENT
  OTHER
}

model User {
  // ... existing fields
  isFlagged            Boolean  @default(false)
  volunteerFlagReasons String[]
  reviewsGiven         Review[] @relation("ReviewsGiven")
  reviewsReceived      Review[] @relation("ReviewsReceived")
}

model Review {
  id                 String   @id @default(auto()) @map("_id") @db.ObjectId
  reviewerId         String   @db.ObjectId
  volunteerId        String   @db.ObjectId
  rating             Int
  text               String
  interactionContext InteractionContext @default(OTHER)
  interactionDate    DateTime
  wouldWorkAgain     Boolean
  crisisEventId      String?
  isFlagged          Boolean  @default(false)
  flagReasons        String[]
  createdAt          DateTime @default(now())
  reviewer           User     @relation("ReviewsGiven", fields: [reviewerId], references: [id])
  volunteer          User     @relation("ReviewsReceived", fields: [volunteerId], references: [id])
}
```

### Review Service (`services/reviewService.ts`)
- `submitReview(reviewerId, payload)`: Creates review with fraud detection
- `checkAndFlagVolunteer(volunteerId)`: Runs volunteer-level fraud detection
- `getVolunteerReviews(volunteerId)`: Fetches reviews with average rating
- `listFlaggedReviews()`: Returns all flagged reviews for admin
- `listFlaggedVolunteers()`: Returns all flagged volunteers for admin
- `approveReview(reviewId)`: Removes flag, re-evaluates volunteer
- `deleteReview(reviewId)`: Deletes review, re-evaluates volunteer
- `approveVolunteer(volunteerId)`: Clears volunteer flag
- `banVolunteer(volunteerId)`: Bans volunteer from platform

### Fraud Detection Rules

**Review-Level (triggered on submission):**
1. Account less than 24 hours old
2. Review text shorter than 20 characters
3. 3+ reviews submitted in last 24 hours
4. Contains fraud keywords (scam, fake, fraud, not present, took supplies, stole, liar, dishonest, corrupt, bribe)

**Volunteer-Level (triggered after each review):**
1. Average rating below 2.0 across 5+ reviews
2. 40%+ reviews contain fraud keywords
3. 3+ "Would not work again" responses in 30 days

### Validation Schema (`utils/validation.ts`)
```typescript
createReviewSchema = z.object({
  volunteerId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(20).max(2000),
  interactionContext: z.enum([...]),
  interactionDate: z.string().refine(date => new Date(date) <= new Date()),
  wouldWorkAgain: z.boolean(),
  crisisEventId: z.string().optional().nullable()
});
```

### API Endpoints
- `POST /api/reviews` - Submit review (authenticated USER only)
- `GET /api/reviews/volunteer/:volunteerId` - Get volunteer's reviews
- `GET /api/reviews/flagged` - Get flagged reviews (ADMIN only)
- `GET /api/reviews/flagged-volunteers` - Get flagged volunteers (ADMIN only)
- `PATCH /api/reviews/:id/approve` - Approve flagged review (ADMIN only)
- `DELETE /api/reviews/:id` - Delete review (ADMIN only)
- `PATCH /api/reviews/volunteer/:id/approve` - Clear volunteer flag (ADMIN only)
- `POST /api/reviews/volunteer/:id/ban` - Ban volunteer (ADMIN only)
- `GET /api/volunteers` - List all volunteers (authenticated)
- `GET /api/volunteers/:volunteerId` - Get volunteer profile with flag status

### Middleware
- `requireAuth`: Validates JWT for all review operations
- `requireRole("ADMIN")`: Enforces admin-only access for moderation endpoints
- `requireRole("USER")`: Enforces USER role for review submission (volunteers cannot review)

## Frontend Design

### Type Definitions (`types.ts`)
```typescript
type InteractionContext = 
  | "RESCUE_OPERATION" 
  | "MEDICAL_AID" 
  | "SUPPLY_DISTRIBUTION" 
  | "SHELTER_MANAGEMENT" 
  | "OTHER";

type Review = {
  id: string;
  reviewerId: string;
  volunteerId: string;
  rating: number;
  text: string;
  interactionContext: InteractionContext;
  interactionDate: string;
  wouldWorkAgain: boolean;
  crisisEventId?: string | null;
  isFlagged: boolean;
  flagReasons: string[];
  createdAt: string;
  reviewer?: { fullName: string; avatarUrl?: string | null };
  volunteer?: { id: string; fullName: string; email: string };
};

type FlaggedVolunteer = {
  id: string;
  fullName: string;
  email: string;
  location: string;
  role: "VOLUNTEER";
  isFlagged: true;
  volunteerFlagReasons: string[];
  createdAt: string;
  reviewsReceived: {
    rating: number;
    wouldWorkAgain: boolean;
    isFlagged: boolean;
    createdAt: string;
  }[];
};
```

### Components

**ReviewForm.tsx**
- Star rating picker (1-5 stars with hover effect)
- Interaction context dropdown (5 options)
- Date picker (max = today)
- Text area (20-2000 chars with validation)
- "Would work again?" radio buttons (Yes/No)
- Submit button with loading state
- Success/error message display

**ReviewList.tsx**
- Average rating summary card (stars + count)
- Review cards with:
  - Reviewer avatar + name
  - Star rating + date
  - Interaction context badge
  - Interaction date badge
  - Review text
  - "Would work again" indicator (✓/✗)
  - "⚠ Flagged for review" badge if flagged
- Loading and empty states

### Pages

**VolunteerProfilePage.tsx**
- Volunteer header with name, location, skills badges
- ⚠️ "Volunteer Under Review" warning badge (if flagged)
  - Displays all flag reasons in list format
- Two-column grid:
  - Left: ReviewList component
  - Right: ReviewForm (USER role only) or info message (VOLUNTEER role)
- Loading and error states

**AdminPanelPage.tsx**
- Three tabs: "Users" | "Flagged Reviews" | "Flagged Volunteers"

**Flagged Reviews Tab:**
- Table with columns: Reviewer, Volunteer, Rating, Review Text, Flag Reasons, Date, Actions
- Action buttons: "Approve" (green), "Delete" (red)
- Empty state: "No flagged reviews at this time. 🎉"

**Flagged Volunteers Tab:**
- Table with columns: Volunteer, Location, Flag Reasons, Reviews Stats, Date Joined, Actions
- Review stats: Average rating, review count, negative reviews count
- Action buttons: "Clear Flag" (green), "Ban Volunteer" (red)
- Empty state: "No flagged volunteers at this time. 🎉"

### API Service (`services/api.ts`)
- `submitReview(volunteerId, rating, text, context, date, wouldWorkAgain, crisisEventId?)`
- `getVolunteerReviews(volunteerId)`
- `getFlaggedReviews()`
- `getFlaggedVolunteers()`
- `approveReview(reviewId)`
- `deleteReview(reviewId)`
- `approveVolunteer(volunteerId)`
- `banVolunteer(volunteerId)`
- `getVolunteerProfile(volunteerId)`

## Seed Data (`prisma/seed.ts`)

### Demo Accounts
| Role | Email | Password | Purpose |
|------|-------|----------|---------|
| Admin | admin@core.local | Admin@12345 | Admin panel demo |
| User 1 | alice@core.local | User@12345 | Submit positive reviews |
| User 2 | bob@core.local | User@12345 | Submit reviews |
| User 3 | carol@core.local | User@12345 | Submit reviews |
| User 4 | david@core.local | User@12345 | Submit short review (flagged) |
| User 5 | eve@core.local | User@12345 | Submit reviews |
| User 6 | frank@core.local | User@12345 | New user (<24hrs, flagged reviews) |

### Demo Volunteers
| Name | Email | Status | Flag Reason |
|------|-------|--------|-------------|
| Sarah Rahman (Good) | sarah@core.local | Not flagged | 5.0★ rating, 3 positive reviews |
| Mike Wilson (Flagged) | mike@core.local | Flagged | 1.6★ avg across 5 reviews |
| Tom Harris (Flagged) | tom@core.local | Flagged | 60% reviews with fraud keywords |

### Demo Reviews
- **3 positive reviews** for Sarah (5★, 5★, 4★, all "Would work again")
- **5 low-rating reviews** for Mike (2★, 1★, 2★, 1★, 2★, all "Would not work again")
- **3 mixed reviews** for Tom (2 with fraud keywords flagged, 1 clean)
- **2 additional flagged reviews**: new account, short text

## Verification Targets
- Backend: `npm run build`, `npm run seed`
- Frontend: `npm run build`
- Manual testing: Submit review → verify fraud detection → admin moderation flow

## Requirement Mapping

| SRS Requirement | Implementation |
|-----------------|----------------|
| **1.3 Star Rating** | `ReviewForm.tsx` StarPicker component |
| **1.3 Interaction Context** | Dropdown with 5 enum values |
| **1.3 Date of Interaction** | Date picker with future-date validation |
| **1.3 Review Text (20-2000 chars)** | Textarea with minLength validation |
| **1.3 Would Work Again?** | Yes/No radio buttons |
| **1.3 Crisis Event ID** | Optional field in schema |
| **1.3 Prevent Duplicate Reviews** | Backend check in `submitReview()` |
| **1.3 Prevent Self-Reviews** | Backend check in `submitReview()` |
| **1.3 Only USER Role Can Review** | Frontend role check + backend validation |
| **1.3 Review Fraud Detection (4 rules)** | `reviewService.ts` fraud detection logic |
| **1.3 Volunteer Fraud Detection (3 rules)** | `checkAndFlagVolunteer()` function |
| **1.3 Flagged Reviews Storage** | `isFlagged` + `flagReasons` fields |
| **1.3 Flagged Volunteers Storage** | `isFlagged` + `volunteerFlagReasons` fields |
| **1.3 Warning Badge on Profile** | `VolunteerProfilePage.tsx` conditional badge |
| **1.3 Admin: Flagged Reviews Tab** | `AdminPanelPage.tsx` tab with table |
| **1.3 Admin: Approve/Delete Review** | Action buttons with handlers |
| **1.3 Admin: Flagged Volunteers Tab** | `AdminPanelPage.tsx` tab with table |
| **1.3 Admin: Clear Flag/Ban Volunteer** | Action buttons with handlers |
| **1.3 Auto Re-evaluation** | Called in approve/delete review functions |
| **1.3 Average Rating Display** | `ReviewList.tsx` summary card |
| **1.3 Review Display (context, date, would-work-again)** | `ReviewList.tsx` review cards |

## Files Modified/Created

### Backend
- `prisma/schema.prisma` - Extended with InteractionContext enum, Review fields, User flag fields
- `src/utils/validation.ts` - Updated `createReviewSchema`
- `src/services/reviewService.ts` - Complete rewrite with fraud detection
- `src/controllers/reviewController.ts` - Added flagged volunteer handlers
- `src/controllers/volunteerController.ts` - Added `getVolunteerProfile`
- `src/routes/reviewRoutes.ts` - Added flagged volunteer routes
- `src/routes/volunteerRoutes.ts` - Added `/:volunteerId` route
- `prisma/seed.ts` - Complete rewrite with demo data

### Frontend
- `src/types.ts` - Added `InteractionContext`, `FlaggedVolunteer`, extended `Review` and `AuthUser`
- `src/services/api.ts` - Added review/volunteer API functions
- `src/components/ReviewForm.tsx` - Complete rewrite with all fields
- `src/components/ReviewList.tsx` - Extended with context, date, would-work-again display
- `src/pages/VolunteerProfilePage.tsx` - Added warning badge, volunteer profile loading
- `src/pages/AdminPanelPage.tsx` - Added "Flagged Volunteers" tab

### Documentation
- `docs/SRS.md` - Updated Module 1.3 with comprehensive implementation details
- `README.md` - Updated with Feature 3 implementation status
- `docs/plans/2026-03-06-module-1-feature-3-design.md` - This document

## Demo Flow

1. **Login as User** → Browse volunteers → Submit review with all fields
2. **Submit fraudulent review** (short text or from new account) → Review gets flagged
3. **Login as Admin** → Admin Panel → Flagged Reviews tab → Approve/Delete
4. **View flagged volunteer** → See warning badge with flag reasons
5. **Admin Panel → Flagged Volunteers** → Clear Flag or Ban Volunteer
6. **Verify auto re-evaluation** → Delete review → Volunteer flag status updates

## Future Enhancements (Out of Scope)
- Email notifications to volunteers when flagged
- Appeal process for flagged volunteers
- Review editing (currently not allowed)
- Crisis event integration (field exists but no UI)
- Photo upload for reviews
- Helpful/unhelpful voting on reviews
