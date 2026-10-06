# Implementation Prompt: Complete Frontend Phase

## Goal
Complete the frontend-only Municipal Service Issue Reporter experience for residents and municipal staff, using localStorage persistence and a shared report source of truth.

## Scope
- Resident registration/login screens
- Resident report form with category, description, city, municipality, pin location, image upload, and priority
- South African map with click/tap location selection and coordinate capture
- Resident dashboard with stats, issue feed, and map view
- Admin dashboard with summary stats, search/filter, issue list, and interactive map
- Public issue detail page with metadata, map pin, and evidence image
- Zero-report default state at initial app load
- Frontend architecture ready for future backend integration

## Constraints
- Maintain the app in frontend-only mode; no backend or real database should be added
- Keep all dashboard totals calculated from actual report data in localStorage
- Ensure the app starts with 0 reports and 0 map pins
- Use React Context + localStorage for persistence
- Keep the UI responsive and South Africa-focused
- Do not seed fake reports or sample pins

## Acceptance Criteria
- The app builds successfully with `npm run build`
- The app runs locally without errors
- A fresh app instance shows 0 reports and 0 pinned issues before any submission
- Reporting flow stores real latitude/longitude, category, description, location, and evidence image
- Resident and admin dashboards read from the same report data source
- Issue cards and detail pages display generated submissions correctly
