# Footer Information Pages: Help, Contact, Privacy, Terms, About

## Goal

Add user-facing information pages for the five items already shown in the existing footer: Help / FAQ, Contact, Privacy Policy, Terms of Use, and About. Base every statement on the current implementation and repository documentation. Do not invent an organization, contact channel, service guarantee, legal obligation, or product capability.

## Required workflow

- Read the repository and client `AGENTS.md` instructions and follow the applicable Next.js 16 documentation from the installed package before changing client code.
- Preserve the existing footer layout and styles. Only replace the non-functional footer item text with links to the corresponding information routes. Keep all other footer content, visibility behavior, spacing, and styles unchanged.
- Create only routes that are missing. Current footer items have no destinations: Help / FAQ, Contact, Privacy Policy, and Terms of Use are rendered as text; About is also plain text. There are no matching information routes in `client/app/`.
- Use the existing Next.js app router and the project's Geist font, slate/emerald palette, Tailwind conventions, page widths, headings, spacing, responsive behavior, and shared navigation/footer. Do not add a new footer or redesign the existing one.
- A shared small content-page component is acceptable if it reduces repetition without adding unnecessary abstraction. The information routes should remain readable, accessible, and navigable.
- Do not change authentication, report, API, database, deployment, or existing unrelated page behavior.
- Do not seed, create, or display demonstration reports or pins.

## Verified implementation facts to use

- Product name: **Municipal Service Issue Reporter**. The current footer calls it an “Information Technology project.” No legal entity, company, named developer, version, support contact, postal address, support schedule, response target, or governing jurisdiction is identified. Use `[COMPANY NAME]`, `[SUPPORT EMAIL]`, `[SUPPORT PHONE]`, `[PHYSICAL ADDRESS]`, `[SUPPORT HOURS]`, `[EXPECTED RESPONSE TIME]`, `[WEBSITE]`, `[GOVERNING LAW / JURISDICTION]`, and `[EFFECTIVE DATE]` where applicable. Do not turn placeholders into working mail links or forms.
- Purpose: residents submit municipal service issue reports with a selected map location; municipal staff review and triage reports. The staff/admin workspace includes municipality and staff access management. A fresh app starts with zero reports and map pins.
- Roles: residents, municipal staff, and super-admins. Residents register with name, email, password, and optional phone number. Staff registration uses an invite/registration key; the first super-admin is bootstrapped through a protected process. Do not describe invite/bootstrap secrets.
- Resident and staff login use server-side authentication. Passwords are stored as salted scrypt hashes. A signed session token is held in an HttpOnly cookie named `msr_session`, with a one-hour max age, `SameSite` configured by the server (defaults to `lax`), and `Secure` in production. Do not expose signing secrets or configuration values.
- Email verification and password recovery are not implemented. There is no profile editing page or account deletion workflow. Users can log out. Do not claim account self-service that does not exist.
- Residents submit a report with a title, description, issue category, priority, exact map location, city/municipality resolved by the server, and optional JPEG/PNG/WebP evidence image up to 3 MB. The encoded evidence is stored with the report in PostgreSQL; file data is not stored in browser local storage. The project README identifies durable object storage as a future launch requirement.
- Reports are served by the API from the shared data source. PostgreSQL/Neon is required in production; a JSON file store is used only for local development/isolated tests. The report schema includes user-generated content, issue category, location coordinates, status, priority, evidence, timestamps, and staff-side operational data. Account records include name, email, password hash, and optional resident phone; staff records include name, email, password hash, role, and active state. Municipality/staff assignments and audit records are also persisted. Do not expose internal staff-only notes/assignment information as public report data.
- Residents can view their own reports; the public map/feed shows reports without reporter identity and omits staff-only data. The public issue feed supports searching/filtering by title/category/city, category, and status. Staff can triage/assign reports and post report updates. Resident report editing/deletion is not implemented; deletion endpoints are super-admin-only.
- Location features use Leaflet, OpenStreetMap map tiles and browser place search via Nominatim. The server also resolves submitted coordinates through a geocoding/boundary workflow using OpenStreetMap Nominatim by default and Municipal Demarcation Board boundary data. Be clear that location searches and map requests use these external services; do not claim those providers' retention practices. Project documentation says public Nominatim has usage limits and advises another approved provider or self-hosting for sustained public service.
- Browser local storage is used for the selected interface language. Legacy local auth keys are removed. Reports and authentication are not persisted in local storage. Do not claim analytics or tracking cookies: none are configured in the application. Do not claim email, contact-form, or payment processing: none is implemented.
- The server applies request rate limits to authentication, report submission, location lookup, and access-code checks. Do not claim a particular IP retention practice; hosting/provider operational logs are not specified by the project.
- `README.md` says the application is not live or cleared for unrestricted public registration and lists email recovery/verification, privacy review, verified municipal contact, retention/deletion policy, durable evidence storage, migration verification, credential rotation, and hosting setup as launch gates. Keep wording honest and avoid describing it as a live municipal service.

## Page content

### Help / FAQ (`/help`)

Organize concise user-friendly answers under logical headings such as Accounts, Reporting an Issue, Finding and Following Reports, and Troubleshooting. Cover only implemented workflows:

- Explain what the portal does and who uses it.
- Resident registration/login and optional phone field; staff access is separate and invite-controlled.
- State plainly that password recovery/email verification are unavailable; direct users to `[SUPPORT EMAIL]` without implying that address is configured.
- Explain how to submit a report, choose category/priority, select an exact map pin, and optionally attach a supported evidence image up to 3 MB.
- Explain public report browsing, search/filter/map, and resident-owned report view; distinguish staff-only tools and private staff notes.
- Explain that report editing/deletion by residents, profile editing/account deletion, email/push notifications, and a contact form are not available in the current build. Explain that staff updates may appear on report views only if that is confirmed by the current UI; otherwise avoid promising in-app notification behavior.
- Include troubleshooting for location permission/search, missing municipality resolution, supported image type/size, and unavailable API/network.
- Include support placeholder and response-time placeholder. Do not invent instructions or guarantees.

### Contact (`/contact`)

Add a brief professional introduction explaining that users should contact support about access problems, account issues, report submission/location issues, or questions about a report. List placeholders for support email, phone, physical address, hours, and expected response time. Make clear that no contact form or verified support channel is currently configured. Do not create a contact form, fake link, phone number, email, social profile, or business address.

### Privacy Policy (`/privacy`)

Use clear sections for introduction, information collected, purposes, storage, security, cookies/local storage, third-party services, sharing, retention, user rights, children's privacy, policy changes, and contact. Keep the text factual and neutral:

- Distinguish resident/staff account fields, submitted report fields/location/evidence, staff operational data, and technical service processing.
- Explain server-side password hashing and cookie session behavior without disclosing secrets.
- Explain PostgreSQL production storage and JSON development/test storage; state that retention periods and deletion procedure are `[DATA RETENTION PERIOD / DELETION PROCESS]` because none is defined.
- Explain that the app uses local storage for language preference, not authentication or reports; describe the session cookie accurately. Do not make unsupported consent/compliance claims.
- Identify Leaflet/OpenStreetMap tiles, Nominatim location search/geocoding, and Municipal Demarcation Board boundary data as applicable. Say their own policies apply and provider handling is not established by this project.
- State that application analytics, payments, email messaging, and contact form submissions are not implemented. Do not claim no network metadata is processed by infrastructure; exact hosting log practices are unknown and should use `[HOSTING / LOG RETENTION DETAILS]` if needed.
- Explain access controls and that public report responses omit reporter identity and staff-only data. Avoid absolute security promises.
- Use placeholders for effective date, privacy contact, retention/deletion, and any legal specifics that cannot be determined. Do not make legal compliance guarantees.

### Terms of Use (`/terms`)

Create professional, neutral terms with the requested topics: acceptance, service description, user accounts, responsibilities, acceptable/prohibited use, user content, intellectual property, availability, third-party services, suspension/termination, disclaimer, liability, changes, governing law, and contact. State that residents must provide accurate issue/location details and should not submit unlawful, abusive, confidential, or unrelated material. Do not assert that the operator owns users' content or grant unsupported licenses. Do not invent a company, jurisdiction, legal entity, warranty, legal right, or liability rule; use `[COMPANY NAME]`, `[GOVERNING LAW / JURISDICTION]`, `[EFFECTIVE DATE]`, and `[CONTACT DETAILS]` placeholders wherever necessary. Keep the terms clearly marked as requiring review before launch rather than presenting unresolved legal choices as settled.

### About (`/about`)

Describe the product as a project for residents to submit map-located municipal service issues and for municipal staff to review/triage them. Mention the problem it is intended to address, target users, implemented report/map/search/dashboard/staff triage features, and that reports/pins appear only after real submission. The existing footer identifies it as an Information Technology project; do not invent an institution, company, developer, version, or formal mission statement. Technology detail may briefly name Next.js/React, Express, PostgreSQL in production, and Leaflet/OpenStreetMap, without making it a marketing claim.

## Routes and existing footer

- Add routes `/help`, `/contact`, `/privacy`, `/terms`, and `/about` under `client/app/`.
- Update only the existing footer link definitions/rendering so the existing five visible items navigate to those routes. Preserve current item order, layout, classes, footer text, route-based hide behavior, and all other footer content. Do not create a second footer.
- Ensure the existing global navigation/footer layout renders correctly on these routes and that all pages are responsive and keyboard accessible.

## Verification

- Run the client lint and production build, then resolve only errors introduced by this work.
- Check all five routes resolve and each footer link targets the correct route.
- Review the final diff to confirm only the existing footer and new information page implementation files changed, with no API/data/auth/deployment edits.
- Confirm no secrets, fabricated contact details, demo reports/pins, or unsupported claims appear.
- In the completion summary, list changed files, routes, every placeholder requiring replacement, and important unknowns (verified support contacts, legal entity/jurisdiction, retention/deletion procedure, hosting log retention, and production deployment status).