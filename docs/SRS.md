# CORE: Real-Time Crisis Response & Community Resilience Network

## Software Requirements Specification (SRS)

---

### Project Overview

| Field | Details |
|:---|:---|
| **Project Title** | CORE: Real-Time Crisis Response & Community Resilience Network |
| **Institution** | BRAC University |
| **Course** | CSE471: System Analysis and Design |
| **Section** | Lab Section 11 |
| **Semester** | Spring 2026 |
| **Group No.** | 05 |

---

### Team Members

| ID | Name | Primary Responsibilities |
|:---|:---|:---|
| 23301692 | Farhan Zarif | Emergency Reporting, Real-Time Dashboard, Live Crisis Updates, Targeted Push Notifications |
| 23241090 | Al Irfan Alve | Resource Registration, Interactive Crisis Map, Resource Status Management, Resource Reservation |
| 22301317 | Ishaq Ahnaf Khan | Secure Documentation, Visual Evidence Gallery, NGO Summary Reports, Disaster Damage OCR |
| 23101531 | Mahia Mahzabin | Volunteer Reviews & Fraud Detection, Volunteer Directory Search, Automated Dispatch SMS, Volunteer Timesheet & Gamification |

---

### Technology Stack

| Layer | Technology |
|:---|:---|
| **Language** | JavaScript / TypeScript |
| **Frontend Framework** | React.js |
| **Backend Framework** | Express.js |
| **Styling** | Tailwind CSS |
| **Database** | MongoDB |
| **ORM** | Prisma |
| **Deployment** | Render |

### External APIs & Services

| Service | Purpose |
|:---|:---|
| **OpenAI API** | Incident credibility evaluation, severity classification, AI-generated situation summaries, context-aware survival instructions |
| **OpenAI Whisper API** | Multilingual voice-note transcription and translation (Bangla / Banglish → English) |
| **Google Maps API** | Interactive geolocation mapping of active crises and available resources |
| **Google Vision OCR API** | Optical character recognition for extracting text data from disaster-damage images |
| **Twilio API** | Automated SMS dispatch for emergency coordination alerts |

---

### System Roles

| Role | Description | Account Creation |
|:---|:---|:---|
| **User** | A general community member who can report incidents, register resources, reserve resources, review volunteers, store documentation, and receive notifications. | Self-registration |
| **Volunteer** | A community member who has registered with specialized skills to actively respond to crises. Inherits all User capabilities and additionally can update crisis statuses, receive dispatch SMS, and log volunteer hours. | Self-registration (selects "Volunteer" role during sign-up) |
| **Admin** | The platform administrator with full system oversight. Can moderate content, verify/ban accounts, verify volunteer tasks, generate NGO reports, and manage all system data. | Seeded into the database on initial deployment. Cannot self-register. |

---

## Functional Requirements

---

### Module 0 — Foundation: Landing Page, Authentication & User Management

> *These features are **prerequisites** for all other modules. They are not counted as primary functional requirements but are essential for the platform to operate. Every team member collaborates on this module before proceeding to Modules 1–3.*

---

#### 0.1 Public Landing Page

| Aspect | Detail |
|:---|:---|
| **Description** | A publicly accessible landing page that introduces the CORE platform, communicates its mission, highlights key features, and provides clear call-to-action buttons for registration and login. |
| **Key Elements** | Hero section with tagline and CTA → Feature overview cards → "How It Works" walkthrough → Testimonials / impact statistics → Footer with contact and social links. |
| **Actors** | Any visitor (unauthenticated). |

**Functional Details:**

- The page shall render without requiring any authentication.
- The page shall contain a **"Get Started / Sign Up"** button that navigates to the registration page.
- The page shall contain a **"Login"** button that navigates to the login page.
- The page shall display a concise overview of the platform's core capabilities (Emergency Reporting, Crisis Map, Volunteer Network, Resource Hub).
- The page shall be fully responsive across mobile, tablet, and desktop viewports.

---

#### 0.2 User Registration (Sign Up)

| Aspect | Detail |
|:---|:---|
| **Description** | New users can create an account by providing their personal information and selecting a primary role. |
| **Actors** | Unregistered visitor. |

**Functional Details:**

- The system shall provide a registration form collecting the following **required** fields:
  - Full Name
  - Email Address
  - Phone Number
  - Password (with confirmation)
  - Location / Area (city, sub-district, or GPS coordinates)
  - Role Selection: **`User`** or **`Volunteer`**
- If the user selects **`Volunteer`**, the form shall expand to collect:
  - Skills / Specializations (e.g., First Aid, Search & Rescue, Counseling)
  - Availability Schedule
  - Any prior training or certifications (optional)
- The system shall validate all inputs (email format, phone format, password strength ≥ 8 characters with mixed types).
- The system shall check for duplicate email/phone before creating the account.
- Upon successful registration, the system shall hash the password (bcrypt) and store the user record in MongoDB via Prisma.
- The system shall send a **welcome confirmation email** (or display an on-screen confirmation) and redirect the user to the login page.

---

#### 0.3 User Login & Authentication

| Aspect | Detail |
|:---|:---|
| **Description** | Registered users and volunteers can securely log in to access role-appropriate features of the platform. |
| **Actors** | User, Volunteer, Admin. |

**Functional Details:**

- The system shall provide a login form accepting **Email/Phone** and **Password**.
- Upon successful credential verification, the system shall issue a **JSON Web Token (JWT)** containing:
  - User ID
  - Role (`user`, `volunteer`, `admin`)
  - Expiration timestamp
- The JWT shall be stored as an **httpOnly cookie** or in secure client-side storage.
- The system shall deny access and display an appropriate error message for invalid credentials.
- The system shall support a **"Remember Me"** option to extend session duration.
- After login, the user shall be redirected to their **role-specific dashboard**:
  - `User` → Community Dashboard (Module 2.1)
  - `Volunteer` → Volunteer Dashboard with task log, dispatch opt-in, and leaderboard access
  - `Admin` → Admin Panel with full system management tools

---

#### 0.4 Password Recovery

| Aspect | Detail |
|:---|:---|
| **Description** | Users who forget their password can securely reset it. |
| **Actors** | Any registered user. |

**Functional Details:**

- The system shall provide a **"Forgot Password?"** link on the login page.
- The user shall enter their registered email address.
- The system shall generate a **time-limited reset token** (valid for 15 minutes) and send a password-reset link to the email.
- Upon clicking the link, the user shall be presented with a form to enter and confirm a new password.
- The system shall invalidate the reset token after successful use or expiration.

---

#### 0.5 User Profile Management

| Aspect | Detail |
|:---|:---|
| **Description** | Authenticated users can view and update their personal profile information. |
| **Actors** | User, Volunteer. |

**Functional Details:**

- The system shall display the user's current profile data (name, email, phone, location, role, avatar).
- The user shall be able to **edit** their name, phone, location, and avatar image.
- **Volunteers** shall additionally be able to update their skills, availability, and certifications.
- The user shall be able to **change their password** by providing the current password and a new password.
- All profile updates shall be persisted to the database immediately upon submission.

---

#### 0.6 Role-Based Access Control (RBAC)

| Aspect | Detail |
|:---|:---|
| **Description** | The system enforces feature access based on the authenticated user's role. |
| **Actors** | System (middleware). |

**Functional Details:**

- The system shall define the following roles and their permissions:

| Feature / Action | User | Volunteer | Admin |
|:---|:---:|:---:|:---:|
| Submit Incident Report | ✅ | ✅ | ✅ |
| Register Resources | ✅ | ✅ | ✅ |
| Submit Volunteer Reviews | ✅ | ❌ | ✅ |
| Secure Documentation (own) | ✅ | ✅ | ✅ |
| View Dashboard & Map | ✅ | ✅ | ✅ |
| Search Volunteer Directory | ✅ | ✅ | ✅ |
| Update Crisis Status | ❌ | ✅ | ✅ |
| Manage Resource Stock | Owner Only | Owner Only | ✅ |
| Opt-in Dispatch SMS | ❌ | ✅ | ❌ |
| Generate NGO Report | ❌ | ❌ | ✅ |
| Reserve Resources | ✅ | ✅ | ✅ |
| Log Volunteer Hours | ❌ | ✅ | ❌ |
| Verify Volunteer Tasks | ❌ | ❌ | ✅ |
| Access Leaderboard | ✅ | ✅ | ✅ |
| Moderate / Ban Users | ❌ | ❌ | ✅ |
| Admin Panel | ❌ | ❌ | ✅ |

- All protected API routes shall validate the JWT and check the user's role via **Express middleware** before processing the request.
- Unauthorized access attempts shall return `HTTP 403 Forbidden`.

---

#### 0.7 Admin Seed Account

| Aspect | Detail |
|:---|:---|
| **Description** | A default administrator account is seeded into the database on initial deployment for platform oversight. The Admin role cannot be obtained through self-registration. |
| **Actors** | System (on deployment). |

**Functional Details:**

- The system shall create one default admin account during database seeding with pre-configured credentials.
- The admin shall have full access to all features, including user management, report moderation, volunteer task verification, NGO report generation, and system configuration.
- The admin shall be able to **verify or ban** user accounts, **moderate** flagged reports, and **override** crisis statuses.
- The admin shall be able to **promote** a regular User to Volunteer or **demote** a Volunteer to User if necessary.

---

#### 0.8 Logout

| Aspect | Detail |
|:---|:---|
| **Description** | Authenticated users can securely end their session. |
| **Actors** | Any authenticated user. |

**Functional Details:**

- The system shall provide a **"Logout"** button accessible from the navigation bar.
- Upon logout, the system shall invalidate/clear the JWT from the client.
- The user shall be redirected to the public landing page.
- Any subsequent requests with the invalidated token shall be rejected.

---

#### 0.9 Responsive Navigation & Layout Shell

| Aspect | Detail |
|:---|:---|
| **Description** | A persistent, responsive application shell that adapts based on authentication state and user role. |
| **Actors** | All users. |

**Functional Details:**

- **Unauthenticated state:** The navbar shall display: Logo, Home, About, Login, Sign Up.
- **Authenticated state (User):** The navbar shall display: Logo, Dashboard, Map, Resources, Volunteers, Profile, Notifications Bell, Logout.
- **Authenticated state (Volunteer):** All User nav items plus: "My Tasks", "Leaderboard", and the "🔔 Dispatch Alert" bell button.
- **Authenticated state (Admin):** All User nav items plus: "Admin Panel", "Generate Reports".
- The layout shall include a mobile-responsive hamburger menu.
- A global **notification badge** shall indicate unread push notifications.

---

### Module 1 — Core Data Entry & Submission

> *This module covers the primary data-ingestion features — submitting incident reports, registering resources, reviewing volunteers, and storing crisis evidence.*

---

#### 1.1 Emergency Reporting — *Farhan Zarif*

| Aspect | Detail |
|:---|:---|
| **Description** | Authenticated users can submit incident reports describing an ongoing or imminent crisis. Reports can be submitted via structured text forms or multilingual voice notes (supporting Bangla and Banglish). The system automatically processes each submission through an AI pipeline that transcribes audio, translates non-English content, evaluates credibility to filter spam or false reports, and classifies the incident by severity level and disaster type. |
| **Actors** | User, Volunteer. |
| **External APIs** | OpenAI API (credibility scoring, severity classification), OpenAI Whisper API (voice transcription & translation). |

**Functional Details:**

1. The system shall present a report-submission form with the following fields:
   - **Incident Title** (text, required, max 120 characters)
   - **Description** (text area, required, max 2000 characters)
   - **Incident Type** (dropdown: Flood, Fire, Earthquake, Building Collapse, Road Accident, Violence, Medical Emergency, Other)
   - **Location** (text input with optional GPS auto-detect via browser geolocation)
   - **Photo / Video Upload** (optional, max 5 files, each ≤ 10 MB)
   - **Voice Note Upload** (optional, audio file ≤ 5 minutes, formats: .mp3, .wav, .webm)
2. If a voice note is uploaded, the system shall:
   - Send the audio to the **Whisper API** for transcription.
   - Detect the source language; if Bangla or Banglish, translate the transcript to English.
   - Auto-populate the **Description** field with the translated transcript and store the original transcript as metadata.
3. Upon submission, the system shall send the report text to the **OpenAI API** with a structured prompt to:
   - Assign a **Credibility Score** (0–100). Reports scoring below 30 shall be flagged as `Suspected Spam` and held for admin review rather than published.
   - Assign a **Severity Level**: `Critical`, `High`, `Medium`, or `Low`.
   - Confirm or adjust the **Incident Type** classification.
4. The processed report shall be saved to the database with the following stored fields:
   - Reporter's User ID, timestamp, location, all form inputs, AI-generated metadata (credibility score, severity, classified type), and processing status.
5. Reports that pass credibility screening shall immediately appear on the **Real-Time Dashboard** (Module 2.1) and **Interactive Crisis Map** (Module 2.2).
6. The reporter shall receive an on-screen confirmation with a summary of the submitted report and its assigned severity.

---

#### 1.2 Resource Registration — *Al Irfan Alve*

| Aspect | Detail |
|:---|:---|
| **Description** | Authenticated users can register emergency resources they have available and are willing to share with the community during a crisis. Resources are catalogued in a community database and made visible on the crisis map for others to locate and reserve. |
| **Actors** | User, Volunteer. |

**Functional Details:**

1. The system shall provide a resource-registration form with the following fields:
   - **Resource Name** (text, required, max 100 characters)
   - **Category** (dropdown: Medical Supplies, Food & Water, Shelter, Clothing, Transportation, Tools & Equipment, Other)
   - **Quantity Available** (numeric, required, minimum 1)
   - **Unit** (dropdown: pieces, packs, liters, kg, units, seats, etc.)
   - **Condition** (dropdown: New, Good, Fair)
   - **Pickup Location** (text address + GPS coordinates via map pin or auto-detect)
   - **Availability Window** (start date-time and end date-time, optional — defaults to "Until Further Notice")
   - **Contact Preference** (phone call, SMS, in-app message)
   - **Photo of Resource** (optional, max 3 images, each ≤ 5 MB)
   - **Additional Notes** (text area, optional, max 500 characters)
2. Upon submission, the system shall:
   - Validate all required fields and data types.
   - Store the resource record linked to the registrant's User ID.
   - Set the initial resource status to **`Available`**.
   - Geo-index the resource location for map queries.
3. The registered resource shall immediately appear as a **resource pin** on the **Interactive Crisis Map** (Module 2.2) and in the resource-search listings.
4. The registrant shall be able to view all their registered resources in a **"My Resources"** section on their profile, with options to **edit**, **deactivate**, or **delete** each entry.

---

#### 1.3 Volunteer Reviews & Fraud Detection — *Mahia Mahzabin*

| Aspect | Detail |
|:---|:---|
| **Description** | Users who have directly interacted with a volunteer during a crisis can submit a structured review. The system aggregates reviews to compute a trust rating for each volunteer and employs pattern-based fraud detection to identify and flag volunteers with suspicious behavior patterns. |
| **Actors** | User (as reviewer); Volunteer (as the reviewed subject); Admin (for moderation of flagged profiles). |

**Functional Details:**

1. The system shall allow a User to submit a review for a Volunteer, accessible from the volunteer's profile page or the Volunteer Directory (Module 2.3). The review form shall include:
   - **Star Rating** (1–5 stars, required)
   - **Review Text** (text area, required, 20–1000 characters)
   - **Interaction Context** (dropdown: Rescue Operation, Medical Aid, Supply Distribution, Shelter Management, Other)
   - **Date of Interaction** (date picker, required, cannot be a future date)
   - **Would you work with this volunteer again?** (Yes / No)
2. The system shall prevent:
   - A user from reviewing the same volunteer more than once per unique crisis event.
   - A volunteer from reviewing themselves.
   - Other volunteers from submitting reviews (only the `User` role can review).
3. Upon submission, the system shall:
   - Recalculate the volunteer's **aggregate trust score** (weighted average of all ratings).
   - Store the review linked to the reviewer's User ID, the volunteer's User ID, and the crisis event ID (if applicable).
4. **Fraud Detection Logic:** The system shall run automated checks including:
   - If a volunteer's average rating drops below **2.0 stars** across a minimum of **5 reviews**, the volunteer's profile shall be flagged as `Under Review`.
   - If more than **40%** of a volunteer's reviews contain the keyword indicators of fraud (e.g., "scam", "fake", "not present", "took supplies"), the system shall auto-flag the profile and notify the admin.
   - If a single volunteer receives **3 or more** "Would not work again" responses within a 30-day window, an alert shall be generated for admin review.
5. Flagged volunteer profiles shall display a visible **⚠ Warning Badge** to other users and shall be temporarily restricted from accepting new dispatch assignments until an admin resolves the flag.
6. Volunteers shall be able to view their own reviews and aggregate score but shall **not** be able to delete or edit reviews submitted by others.
7. The Admin shall be able to review all flagged profiles from the Admin Panel and take action: **clear the flag**, **issue a warning**, or **ban the volunteer**.

---

#### 1.4 Secure Documentation — *Ishaq Ahnaf Khan*

| Aspect | Detail |
|:---|:---|
| **Description** | Authenticated users can create a personal, secure digital folder to store post-crisis evidence (photos, videos) alongside timestamped operational text notes. This serves as a private evidence locker that can later be shared with authorities or used for reporting. |
| **Actors** | User, Volunteer. |

**Functional Details:**

1. The system shall allow the user to create a new **Secure Folder** with the following properties:
   - **Folder Name** (text, required, max 80 characters)
   - **Linked Crisis Event** (optional dropdown of active/recent crises from the system database)
   - **Description** (text area, optional, max 500 characters)
2. Within a folder, the user shall be able to:
   - **Upload files**: images (.jpg, .png, .webp) and videos (.mp4, .webm), each ≤ 20 MB, maximum 20 files per folder.
   - **Add text notes**: timestamped operational notes (text area, max 2000 characters each), with no limit on the number of notes.
3. Each uploaded file and note shall be automatically stamped with:
   - Upload/creation **date and time** (UTC and local).
   - The **uploader's User ID**.
   - The **GPS coordinates** at the time of upload (if browser geolocation is available and permitted).
4. The folder and its contents shall be **private by default**, visible only to the owner.
5. The owner shall be able to **generate a shareable read-only link** for a specific folder, with an optional **expiration time** (1 hour, 24 hours, 7 days, or no expiry).
6. The owner shall be able to **revoke** any previously generated shareable link at any time.
7. The system shall provide a **"My Documents"** page listing all the user's secure folders with metadata (folder name, linked crisis, number of files, last modified date).
8. The user shall be able to **delete** individual files, notes, or entire folders. Deletion shall be a soft-delete (moved to a 30-day trash) with an option to permanently delete.

---

### Module 2 — Data Visualization, Search & Discovery

> *This module transforms the data collected in Module 1 into actionable, visual, and searchable interfaces for community situational awareness.*

---

#### 2.1 Real-Time Dashboard — *Farhan Zarif*

| Aspect | Detail |
|:---|:---|
| **Description** | Authenticated users can access a localized, real-time feed of incident reports relevant to their community. The system uses AI to cluster duplicate or overlapping reports about the same incident into a single "Master Incident" card, reducing information noise. Additionally, the dashboard dynamically generates and displays a Situation Report (SitRep) summarizing the current crisis landscape for the user's locality. |
| **Actors** | User, Volunteer, Admin. |
| **External APIs** | OpenAI API (duplicate clustering, SitRep generation). |

**Functional Details:**

1. Upon loading, the dashboard shall **auto-detect** the user's location (from their profile or browser GPS) and fetch all active incidents within a configurable radius (default: 10 km).
2. The system shall display incidents as a **scrollable feed of incident cards**, each showing:
   - Incident Title, Type icon, Severity badge (color-coded: Critical = red, High = orange, Medium = yellow, Low = green).
   - Brief description excerpt (first 150 characters).
   - Location name, time since report, number of clustered reports, reporter count.
   - Thumbnail of attached media (if any).
3. **AI Duplicate Clustering:**
   - When a new report is submitted, the system shall compare it against existing active incidents using the **OpenAI API** (semantic similarity analysis on title + description + location proximity).
   - If the similarity score exceeds a threshold (≥ 0.80), the new report shall be **merged** into the existing Master Incident rather than creating a new card.
   - The Master Incident card shall display a **"X reports merged"** indicator and allow users to expand and view individual contributing reports.
4. **Situation Report (SitRep):**
   - The dashboard shall feature a prominent **SitRep panel** at the top.
   - The SitRep shall be generated by sending all active local incident summaries to the **OpenAI API** with a prompt to produce a concise (200–400 word), structured community briefing.
   - The SitRep shall include: current active incident count, most critical ongoing events, areas to avoid, resources available nearby, and general safety advisories.
   - The SitRep shall **auto-refresh** every 10 minutes or when a new Critical-severity incident is reported in the user's area.
5. Users shall be able to **filter** the feed by: incident type, severity level, and time range (last 1 hour, 6 hours, 24 hours, 7 days).
6. Users shall be able to **sort** the feed by: most recent, highest severity, or most reports merged.
7. Clicking on an incident card shall navigate to a **detailed incident view** showing full description, all media, location on an embedded map, contributing reports, and the current crisis status.

---

#### 2.2 Interactive Crisis Map — *Al Irfan Alve*

| Aspect | Detail |
|:---|:---|
| **Description** | Authenticated users can view a geographic map displaying the exact locations of all active crisis incidents and available community resources. The map provides an at-a-glance spatial overview of the crisis landscape, enabling users to identify nearby dangers and resources. |
| **Actors** | User, Volunteer, Admin. |
| **External APIs** | Google Maps API (map rendering, markers, geolocation). |

**Functional Details:**

1. The system shall render a **full-screen interactive map** using the **Google Maps JavaScript API**.
2. The map shall auto-center on the user's current location (profile location or browser GPS) with a default zoom level appropriate for a city-level view.
3. **Crisis Incident Markers:**
   - Each active incident shall be displayed as a **map marker/pin**.
   - Marker icons shall be visually distinct by **incident type** (e.g., flame icon for fire, water icon for flood).
   - Marker color shall reflect **severity level** (Critical = red, High = orange, Medium = yellow, Low = green).
   - Clicking a marker shall open an **info window popup** showing: Incident Title, Type, Severity, brief description, time since report, and a "View Details" link to the full incident page.
4. **Resource Markers:**
   - Each available resource shall be displayed as a **distinct marker** (e.g., a green cross for medical supplies, a food icon for food/water).
   - Clicking a resource marker shall open an info window showing: Resource Name, Category, Quantity available, Pickup Location, and a "Reserve" button (linking to Module 3.6).
5. **Map Controls:**
   - Users shall be able to **toggle layers** on/off: Crisis Incidents layer, Resources layer.
   - Users shall be able to **filter markers** by incident type, severity, or resource category using a sidebar filter panel.
   - Users shall be able to use a **search bar** to search for a specific location and re-center the map.
6. **Clustering:** When zoomed out, nearby markers shall automatically cluster into grouped markers showing a count, which expand into individual markers upon zooming in.
7. The map data shall **auto-refresh** every 60 seconds to reflect new incidents or resource updates without requiring a page reload.

---

#### 2.3 Volunteer Directory Search — *Mahia Mahzabin*

| Aspect | Detail |
|:---|:---|
| **Description** | Authenticated users can search and browse a directory of all registered community volunteers. The directory supports filtering by specialized skills, proximity to the user's location, availability status, and trust rating, enabling efficient volunteer discovery and coordination. |
| **Actors** | User, Volunteer, Admin. |

**Functional Details:**

1. The system shall display a **searchable, paginated list** of all registered volunteers (users with role `volunteer`).
2. Each volunteer entry in the list shall display:
   - Profile photo / avatar.
   - Full Name.
   - Skills / Specializations (as tags, e.g., "First Aid", "Search & Rescue").
   - Location / Area.
   - Distance from the user's current location (in km).
   - Aggregate Trust Rating (stars out of 5, with review count).
   - Current Availability Status badge: `Available`, `Busy`, or `Offline`.
   - Any fraud warning badge (if flagged per Module 1.3).
3. **Search & Filter Options:**
   - **Text Search:** by volunteer name or skill keyword.
   - **Skill Filter:** multi-select dropdown of all skill categories in the system.
   - **Proximity Filter:** radius slider (1 km – 50 km from user's location).
   - **Availability Filter:** checkbox for Available, Busy, Offline.
   - **Minimum Rating Filter:** slider (1–5 stars).
4. **Sorting Options:**
   - Nearest first (default).
   - Highest rated first.
   - Alphabetical (A–Z).
5. Clicking on a volunteer entry shall navigate to the **volunteer's detailed profile page**, showing:
   - Full bio and skills description.
   - Complete review history (from Module 1.3).
   - Total volunteer hours logged (from Module 3.7).
   - Badges and leaderboard rank (from Module 3.7).
   - A **"Write a Review"** button (visible only to users with the `User` role, linking to Module 1.3).

---

#### 2.4 Visual Evidence Gallery — *Ishaq Ahnaf Khan*

| Aspect | Detail |
|:---|:---|
| **Description** | Authenticated users can access a centralized, chronologically organized gallery of all verified visual evidence (photos and videos) associated with a specific ongoing or resolved crisis event. The gallery aggregates media from incident reports and secure documentation folders that have been linked to the crisis. It also provides AI-generated contextual recommendations based on the observed evidence. |
| **Actors** | User, Volunteer, Admin. |

**Functional Details:**

1. The gallery shall be accessible from a **crisis event's detail page** (linked from the Dashboard or Map).
2. The system shall aggregate and display all visual media (photos, videos) that have been:
   - Uploaded as part of **incident reports** (Module 1.1) associated with that crisis.
   - Shared from **secure documentation folders** (Module 1.4) that are linked to that crisis and have sharing enabled.
3. Media shall be displayed in a **grid/masonry layout** sorted **chronologically** (oldest to newest by default), with an option to reverse the sort order.
4. Each media item shall display:
   - Thumbnail preview.
   - Upload timestamp (date and time).
   - Uploader's display name.
   - Location where the media was captured (if GPS data available).
   - A **verification badge** if the media has been reviewed and approved by an admin.
5. Clicking on a media item shall open a **lightbox/full-screen viewer** with:
   - Full-resolution image or video player.
   - All metadata (timestamp, uploader, location, linked report ID).
   - Navigation arrows to browse through the gallery sequentially.
6. **AI-Generated Recommendations:**
   - The gallery page shall include a **"Recommendations" panel** that provides contextual advisories generated by sending a summary of the crisis event and evidence descriptions to the **OpenAI API**.
   - Recommendations may include: safety precautions, damage assessment observations, suggested next steps for responders, or resource needs inferred from visual evidence patterns.
7. Users shall be able to **filter** the gallery by: media type (photos only, videos only), date range, and uploader.
8. Users shall be able to **report** inappropriate or irrelevant media to the admin for removal.

---

### Module 3 — Operations, Coordination & Advanced Features

> *This module enables active crisis management operations, resource coordination, volunteer engagement, and advanced AI/OCR-powered tools.*

---

#### 3.1 Live Crisis Updates — *Farhan Zarif*

| Aspect | Detail |
|:---|:---|
| **Description** | Volunteers can update the details and operational status of an active crisis event. Status changes trigger the AI to regenerate a revised live situation summary, ensuring the community stays informed with a concise, up-to-date overview without being overwhelmed by raw data. |
| **Actors** | Volunteer, Admin. |
| **External APIs** | OpenAI API (revised situation summary generation). |

**Functional Details:**

1. On the detailed incident view page, authorized users (Volunteers and Admin) shall see an **"Update Crisis"** panel with the following editable fields:
   - **Status** (dropdown): `Reported` → `Verified` → `Under Investigation` → `Response in Progress` → `Contained` → `Resolved` → `Closed`.
   - **Situation Update Note** (text area, required when changing status, max 1000 characters): a brief description of what has changed.
   - **Updated Severity** (optional re-classification): Critical, High, Medium, Low.
   - **Affected Area Update** (optional): revised radius or boundary description.
   - **Casualty / Impact Estimates** (optional): fields for injured count, displaced count, structural damage notes.
2. Upon submitting an update, the system shall:
   - Log the update as a new entry in the crisis event's **update timeline/history** with the updater's User ID, timestamp, and all changed fields.
   - Send the complete crisis event data (original report + all updates) to the **OpenAI API** to generate a **revised live situation summary** (150–300 words).
   - Replace the previous summary on the incident's detail page and the dashboard SitRep.
3. If the status is changed to **`Resolved`** or **`Closed`**:
   - The incident marker shall be removed from the active crisis map layer (or moved to a "Resolved" layer).
   - The incident card on the dashboard shall be visually muted and moved to the bottom of the feed.
   - If the user is an Admin, the system shall prompt them to **trigger NGO Summary Report generation** (Module 3.4).
4. All status changes shall be **immutable** once saved (append-only log); users cannot delete or retroactively edit past updates.
5. Each update shall trigger relevant **push notifications** (Module 3.5) to users subscribed to that crisis's type or location.

---

#### 3.2 Resource Status Management — *Al Irfan Alve*

| Aspect | Detail |
|:---|:---|
| **Description** | Resource owners can update the real-time availability status and remaining stock levels of the emergency resources they have previously registered (Module 1.2). This ensures the community has accurate, up-to-date information about what is actually available. |
| **Actors** | Resource Owner (the user who registered the resource), Admin. |

**Functional Details:**

1. From the **"My Resources"** section in the user's profile, the owner shall be able to select any of their registered resources and access an **"Update Resource"** form.
2. The form shall allow the following updates:
   - **Status** (dropdown): `Available` → `Low Stock` → `Reserved` → `Depleted` → `Unavailable`.
   - **Remaining Quantity** (numeric input): the updated count of available units. Must be ≤ the original registered quantity.
   - **Updated Availability Window** (optional): modify the start or end date-time.
   - **Notes** (text area, optional, max 300 characters): e.g., "Only distributing to families with children."
3. Upon saving the update, the system shall:
   - Update the resource record in the database.
   - Reflect the change immediately on the **Interactive Crisis Map** (Module 2.2) resource marker info window.
   - If the status changes to **`Depleted`** or **`Unavailable`**, the resource marker shall be **grayed out or removed** from the active map layer.
4. The system shall maintain an **update history log** for each resource showing all status and quantity changes with timestamps.
5. If a resource's quantity reaches **0**, the system shall automatically set its status to **`Depleted`**.

---

#### 3.3 Automated Dispatch SMS — *Mahia Mahzabin*

| Aspect | Detail |
|:---|:---|
| **Description** | Volunteers can opt in to receive automated SMS dispatch messages when a new crisis is reported in their area. The SMS contains emergency coordination instructions, including the incident summary, location, and suggested actions. A "bell button" UI element provides a one-click opt-in/opt-out toggle. |
| **Actors** | Volunteer. |
| **External APIs** | Twilio API (SMS delivery). |

**Functional Details:**

1. The system shall display a visible **"🔔 Dispatch Alert" bell button** in the navigation bar for users with the `Volunteer` role only.
2. Clicking the bell button shall **toggle** the user's dispatch opt-in status:
   - **Opted In** (bell highlighted/active): the volunteer will receive SMS alerts.
   - **Opted Out** (bell muted/inactive): the volunteer will not receive SMS alerts.
   - The current opt-in state shall be persisted in the user's profile record.
3. When a new incident with severity **`Critical`** or **`High`** is reported and verified:
   - The system shall query all opted-in volunteers whose registered location is within a **15 km radius** of the incident.
   - For each matching volunteer, the system shall send an **SMS via the Twilio API** containing:
     - `[CORE DISPATCH ALERT]`
     - Incident Type and Title.
     - Severity Level.
     - Location (address or coordinates).
     - Brief description (first 100 characters of the report).
     - Suggested immediate action (e.g., "Medical responders needed at location. Report to staging area at [address].").
     - A short link to view the full incident details in the app.
4. The system shall **log** every SMS sent: recipient User ID, phone number (masked in logs), incident ID, timestamp, and Twilio delivery status (sent, delivered, failed).
5. Volunteers shall be able to view their **SMS dispatch history** in their profile settings under a "My Alerts" section.
6. The system shall enforce a **rate limit** of maximum 10 SMS per volunteer per 24-hour period to prevent alert fatigue.

---

#### 3.4 NGO Summary Reports — *Ishaq Ahnaf Khan*

| Aspect | Detail |
|:---|:---|
| **Description** | The Admin can generate a compiled, professionally formatted PDF summary report for a resolved or closed crisis event. The report aggregates all relevant data — incident details, timeline of updates, resource usage, volunteer involvement, and visual evidence — into a document suitable for submission to NGOs, government agencies, or donor organizations. |
| **Actors** | Admin. |

**Functional Details:**

1. On the detail page of a crisis event with status **`Resolved`** or **`Closed`**, the system shall display a **"Generate NGO Report"** button visible only to the Admin.
2. Clicking the button shall trigger the system to compile a PDF report containing the following sections:
   - **Cover Page:** CORE platform logo, report title (crisis event name), date range of the event, generated date, generated by (admin name).
   - **Executive Summary:** A concise overview of the crisis (auto-generated from the most recent AI situation summary).
   - **Incident Details:** Original report data — type, severity, location, description, reporter info.
   - **Timeline of Events:** A chronological list of all status updates (from Module 3.1) with timestamps, updater names, and situation notes.
   - **Resource Utilization:** A table of all resources that were linked to or reserved for this crisis (from Modules 1.2, 3.2, 3.6), including quantities distributed and remaining.
   - **Volunteer Involvement:** A list of volunteers who were dispatched or logged hours for this crisis (from Modules 3.3, 3.7), including total hours contributed.
   - **Visual Evidence Summary:** Thumbnail grid of key verified images from the evidence gallery (Module 2.4), with captions and timestamps.
   - **Impact Assessment:** Casualty/displacement estimates, area affected, damage notes (from crisis update data).
   - **Appendix:** Any OCR-extracted text data (from Module 3.8) relevant to the crisis.
3. The generated PDF shall use a **professional, branded template** with consistent formatting, headers, page numbers, and the CORE logo watermark.
4. Upon generation, the system shall:
   - Provide an immediate **in-browser preview** of the PDF.
   - Offer a **"Download PDF"** button.
   - Store the generated PDF in the system database linked to the crisis event for future access.
5. Previously generated reports shall be accessible from a **"Reports Archive"** section in the Admin Panel.

---

#### 3.5 Targeted Push Notifications — *Farhan Zarif*

| Aspect | Detail |
|:---|:---|
| **Description** | Users can subscribe to specific crisis categories (e.g., Flood, Fire, Earthquake) and geographic areas to receive targeted push notifications. When a new incident matching their subscription criteria is reported locally, they receive a notification containing AI-generated, context-aware survival instructions such as hazard warnings, evacuation tips, or safety precautions. |
| **Actors** | User, Volunteer. |
| **External APIs** | OpenAI API (context-aware survival instruction generation). |

**Functional Details:**

1. The system shall provide a **"Notification Preferences"** page accessible from the user's profile settings.
2. On this page, the user shall be able to:
   - **Subscribe to crisis categories** via multi-select checkboxes: Flood, Fire, Earthquake, Building Collapse, Road Accident, Violence, Medical Emergency, Other.
   - **Set a notification radius** (slider: 5 km – 50 km from their location).
   - **Enable/disable** push notifications globally with a master toggle.
3. When a new incident is reported and passes credibility screening (Module 1.1):
   - The system shall query all users whose subscribed categories include the incident's type **AND** whose location is within their configured notification radius of the incident.
   - For each matching user, the system shall:
     - Send the incident type, severity, and location context to the **OpenAI API** with a prompt to generate a **concise survival instruction** (50–150 words) tailored to the specific disaster type and local conditions.
     - Deliver a **push notification** (browser notification or in-app notification) containing:
       - Notification title: `⚠ [Severity] [Incident Type] Alert`
       - Body: Brief incident summary + AI-generated survival instruction.
       - Action button: "View Details" linking to the incident page.
4. The system shall maintain a **notification inbox** (accessible from the bell icon in the navbar) showing all past notifications with:
   - Read/unread status.
   - Timestamp.
   - Link to the relevant incident.
   - Option to mark as read or dismiss.
5. Notifications shall be stored in the database for history and shall be paginated (20 per page).

---

#### 3.6 Resource Reservation — *Al Irfan Alve*

| Aspect | Detail |
|:---|:---|
| **Description** | Authenticated users can reserve or claim specific quantities of listed emergency resources from a mapped location. The reservation system ensures fair community distribution by enforcing per-user limits and providing resource owners with reservation management capabilities. |
| **Actors** | User, Volunteer (as requesters); Resource Owner (as approver); Admin (can override). |

**Functional Details:**

1. From the resource marker info window on the **Crisis Map** (Module 2.2) or from a **resource detail page**, users shall see a **"Reserve"** button (visible only when the resource status is `Available` or `Low Stock`).
2. Clicking "Reserve" shall open a reservation form with:
   - **Requested Quantity** (numeric, required, minimum 1, maximum = remaining available quantity).
   - **Purpose / Justification** (text area, required, max 300 characters): e.g., "Needed for 5-member family displaced by flood."
   - **Preferred Pickup Time** (date-time picker, optional).
3. Upon submission, the system shall:
   - Create a reservation record with status **`Pending`**, linked to the requester's User ID, the resource ID, and the requested quantity.
   - **Temporarily hold** the requested quantity (deducted from the "available to reserve" count but not from actual stock until confirmed).
   - Send an **in-app notification** to the resource owner about the new reservation request.
4. The resource owner shall be able to view all incoming reservations in their **"My Resources" → "Reservations"** tab and take one of the following actions:
   - **Approve:** Confirms the reservation. The requested quantity is formally deducted from the resource's remaining stock. The requester is notified with pickup instructions.
   - **Decline:** Rejects the reservation with an optional reason. The held quantity is released back to the available pool. The requester is notified of the decline.
5. **Fair Distribution Rules:**
   - The system shall enforce a **maximum reservation limit** per user per resource: no single user can reserve more than **30%** of the total listed quantity of a resource.
   - A user cannot have more than **3 active (Pending or Approved) reservations** for the same resource simultaneously.
6. Approved reservations that are not picked up within **24 hours** of the preferred pickup time shall be automatically **expired** and the quantity released.
7. The system shall display the resource's **reservation history** to the resource owner, showing all past and active reservations.

---

#### 3.7 Volunteer Timesheet & Gamification — *Mahia Mahzabin*

| Aspect | Detail |
|:---|:---|
| **Description** | Volunteers can log their completed helping tasks and hours into a digital community service timesheet. The system uses these logs to power a gamification engine that awards points, ranks volunteers on a public leaderboard, and grants achievement badges — incentivizing sustained community participation. |
| **Actors** | Volunteer (for logging tasks); Admin (for verifying tasks); All authenticated users (for viewing leaderboard). |

**Functional Details:**

1. Volunteers shall have access to a **"Log Task"** form from their dashboard or profile, with the following fields:
   - **Task Title** (text, required, max 100 characters)
   - **Task Description** (text area, required, max 500 characters)
   - **Linked Crisis Event** (optional dropdown of active/recent crises)
   - **Task Category** (dropdown: Rescue, Medical Aid, Supply Distribution, Shelter Setup, Cleanup, Counseling, Transportation, Other)
   - **Hours Spent** (numeric, required, minimum 0.5, maximum 24, in 0.5 increments)
   - **Date of Task** (date picker, required, cannot be a future date)
   - **Supporting Evidence** (optional: photo upload, max 2 images)
2. Upon submission, the system shall:
   - Store the task log linked to the volunteer's User ID.
   - Set the task status to **`Pending Verification`**.
   - An Admin can verify the task from the Admin Panel, changing its status to **`Verified`** or **`Rejected`**.
3. **Points System:**
   - Each **verified** task shall award points based on: `Hours Spent × Category Multiplier`.
   - Category Multipliers: Rescue = 3x, Medical Aid = 2.5x, Supply Distribution = 2x, Shelter Setup = 2x, Cleanup = 1.5x, Counseling = 2x, Transportation = 1.5x, Other = 1x.
   - Base point rate: **10 points per hour**.
   - Example: 4 hours of Rescue work = 4 × 10 × 3 = **120 points**.
4. **Leaderboard:**
   - The system shall maintain a **public leaderboard** page displaying the top-ranked volunteers sorted by total points.
   - The leaderboard shall show: Rank, Volunteer Name, Avatar, Total Points, Total Verified Hours, Number of Badges, and Trust Rating.
   - Filtering options: All-time, This Month, This Week.
   - The leaderboard shall be accessible to **all authenticated users** from the navigation menu.
5. **Badge Achievement System:**
   - The system shall award badges automatically when milestones are reached:

   | Badge Name | Criteria |
   |:---|:---|
   | 🌱 First Responder | Complete first verified task |
   | ⭐ Rising Star | Accumulate 100 points |
   | 🔥 Crisis Hero | Log 50+ verified hours |
   | 🛡️ Community Guardian | Maintain a trust rating ≥ 4.5 with 10+ reviews |
   | 🏆 Elite Volunteer | Reach Top 10 on the all-time leaderboard |
   | 💯 Century | Complete 100 verified tasks |
   | 🤝 Team Player | Log tasks across 5+ different crisis events |

   - Earned badges shall be displayed on the volunteer's profile page and on leaderboard entries.
6. Volunteers shall have a **"My Timesheet"** page showing a log of all submitted tasks with statuses, points earned, and a summary of total hours and points.

---

#### 3.8 Disaster Damage OCR — *Ishaq Ahnaf Khan*

| Aspect | Detail |
|:---|:---|
| **Description** | Users can upload images of disaster-damaged areas or objects, and the system will automatically extract vital text data visible in the images — such as license plate numbers, hazard warning labels, building addresses, road signs, or any other readable text. This uses the Google Vision OCR API and provides structured extracted data that can be attached to incident reports or documentation. |
| **Actors** | User, Volunteer. |
| **External APIs** | Google Vision OCR API (optical character recognition). |

**Functional Details:**

1. The system shall provide an **"OCR Scan"** feature accessible from:
   - The **Secure Documentation** module (Module 1.4) as an action on uploaded images.
   - A dedicated **"OCR Tool"** page accessible from the navigation menu.
2. The user shall be able to:
   - **Upload an image** (.jpg, .png, .webp, max 10 MB) or select an existing image from their secure folders.
   - Click a **"Extract Text"** button to initiate the OCR process.
3. Upon initiation, the system shall:
   - Send the image to the **Google Vision OCR API**.
   - Receive the OCR response containing detected text, text locations (bounding boxes), and confidence scores.
4. The system shall display the OCR results in a structured format:
   - **Annotated Image View:** The original image with bounding box overlays highlighting where text was detected.
   - **Extracted Text Panel:** A list of all detected text strings, each with:
     - The extracted text.
     - Confidence score (as a percentage).
     - Category auto-tag (if detectable): `License Plate`, `Street Address`, `Warning Label`, `Sign`, `General Text`.
5. The user shall be able to:
   - **Copy** individual extracted text strings to clipboard.
   - **Edit** or correct any extracted text (for OCR inaccuracies).
   - **Save** the OCR results: the extracted data shall be stored in the database linked to the source image and the user's account.
   - **Attach** the OCR result to an existing incident report or secure documentation folder.
6. The system shall maintain an **"OCR History"** page for the user, listing all past scans with thumbnails, extracted text previews, and dates.
7. Saved OCR data shall be available for inclusion in **NGO Summary Reports** (Module 3.4) as an appendix.

---

### Non-Functional Requirements

| Category | Requirement |
|:---|:---|
| **Performance** | The dashboard and map shall load initial data within 3 seconds on a standard broadband connection. API responses for non-AI features shall return within 500ms. |
| **Scalability** | The system architecture shall support up to 10,000 concurrent users without degradation, leveraging MongoDB's horizontal scalability. |
| **Security** | All passwords shall be hashed using bcrypt (salt rounds ≥ 10). All API communication shall occur over HTTPS. JWTs shall expire within 24 hours (extendable with "Remember Me"). Sensitive data (OCR results, secure documents) shall be access-controlled. |
| **Availability** | The deployed application on Render shall target 99% uptime during the academic demonstration period. |
| **Usability** | The UI shall be fully responsive (mobile, tablet, desktop). All forms shall provide real-time validation feedback. Error messages shall be user-friendly and non-technical. |
| **Internationalization** | The Whisper API integration shall support Bangla and Banglish voice input. The UI shall be in English with potential for future localization. |
| **Data Integrity** | All crisis updates and resource changes shall use append-only logs to maintain a complete audit trail. Soft-delete shall be used for user-facing deletions. |
| **Compliance** | User location data shall only be collected with explicit browser permission. Users shall be informed of data usage in a privacy notice accessible from the landing page. |
