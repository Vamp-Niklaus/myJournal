# Architecture & Development Rules

## 1. Backend & Data Synchronization Architecture
We use Supabase for our cloud database and localStorage for local persistence (offline-first capability). All data mutation features must implement a "Write-Through Sync" pattern:

*   **Optimistic Local Save:** Every user mutation (create, update, delete) must instantly apply to `localStorage` first to ensure zero UI latency.
*   **Unique Identifiers:** Every record must be stamped with a client-side generated UUID (`crypto.randomUUID()`) and an `updated_at` ISO timestamp.
*   **Asynchronous Background Sync:** Immediately after writing locally, trigger a background async call to Supabase using `.upsert()` with `onConflict: 'id'`.
*   **Auth Enforcement:** Always wrap cloud operations with an authentication check via `supabase.auth.getUser()`. If the user is unauthenticated, log a warning and retain the data locally.
*   **Error Resilience:** Wrap the cloud sync in `try/catch`. If the network is offline or the sync fails, do not roll back the local data. Instead, mark the local record with a flag (`synced: false`) so it can be retried later.

## 2. UI & Mobile Responsiveness Guidelines
The layout must look polished and clean across both desktop and mobile screens.
*   **Mobile-First Cleanup:** On smaller screens (mobile views), heavy UI components like "Directories" and "Calendar" views must be hidden by default to prevent a cluttered layout.
*   **Navigation:** Introduce a clean, mobile-friendly navigation trigger (such as a slide-out drawer or a bottom navigation bar) to let users toggle hidden components on demand.
*   **Flow:** Ensure grid systems collapse into single-column layouts gracefully on mobile viewports without breaking containment.
