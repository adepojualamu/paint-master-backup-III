# Admin Training Manual

You are the dispatcher — the human in the loop between customers and Paint Masters. Most of your time goes into three things: getting new bookings into the right Master's hands, keeping the kanban moving, and fielding the messages that come in from both sides.

This manual walks you through every screen of the admin console, in the order you'll typically use them through the day.

---

## 1. Signing in

Open `paintmasters.gh/login.html` and sign in with your admin phone number and password. The platform routes you to `/admin/index.html` automatically.

If you're a new admin, the founder creates your account through the server-side `create-admin.js` script — there's no admin self-signup by design. Your first sign-in forces a password change (same flow as Paint Masters), then you land on the dashboard.

The sidebar's role card under the Paint Masters logo always shows the currently signed-in admin. Click your name → goes to **Settings → Account** where you can edit your name, phone, and region. Changes save automatically as you type — the sidebar updates live, and a small green ✓ Saved chip flashes when the change persists.

## 2. The dashboard

`/admin/index.html`. Five sections, top to bottom:

### KPI grid

Five cards: Month revenue, Pending assignment, Active jobs, QA queue, Avg rating. The numbers refresh every time you load the page.

### Revenue chart

14 / 30 / 90-day chips above the chart swap the data. Selection persists across pages within the session.

### Today's schedule

The next six dispatched/on-site/QA jobs. Click any row to jump straight to the job board with that card open.

### Pending assignment

Top-right column. Lists new bookings with no Master yet — your morning queue. Click a card to open the job and assign someone.

### Live activity

Below the painter status block. Streams every meaningful action across the platform: customer photo requests, scope changes, concerns, painter check-ins, customer reviews. Each event is tagged with who fired it (customer / painter / admin / system) and how long ago. Click "Mark all read" to clear the unread count.

The same events also drive the **🔔 bell** in the topbar — number badge shows unread, click to open the dropdown.

## 3. The topbar search

Type any of these into the search box:

- A booking ref like `PM-481905`
- A customer name (any part)
- A painter name or specialty
- A region or city

Results appear in a grouped dropdown (Jobs / Customers / Paint Masters) with up to 30 hits. ↓↑ to navigate, Enter to open. Click-outside to close.

This is the fastest way to find anything. Use it instead of clicking through nav links.

## 4. Job board (`/admin/jobs.html`)

The kanban with eight columns: New Request → Inspection → Scheduled → Dispatched → On site → QA → Completed (plus deleted, hidden by default).

### Filters and density

Top row of chips lets you focus on one stage. **Hide empty stages** is on by default so columns with no cards collapse out of view. **Compact cards** trims padding so you can scan twice as many cards per column.

Search filters by ref / customer / service / address. Region, master, and service filters narrow further.

### Per-card actions

Hover any card and a small **🗑** button appears in the bottom-right — single-card delete. Click it; you'll see a typed-confirmation modal asking you to type the booking ref before the destructive button enables. Soft-delete only — the card moves to a hidden "Deleted" state and can be restored from "Show deleted".

Click the card body to open the **detail modal**. Inside, you can:
- Change the stage from a dropdown.
- Pick or change the assigned Paint Master from the picker (skill-match is highlighted).
- **Dispatch →** to send the job to the assigned Master (flips stage to dispatched, marks Master as on_job, fires a notification to the Master).
- **Delete** — same typed-confirmation flow as the per-card button.

### Bulk operations

Tick the checkbox on multiple cards. A floating action bar at the bottom appears:

- **Assign master…** — assign all ticked jobs to one Master in one click.
- **Move to stage…** — bulk stage change.
- **Dispatch →** — bulk dispatch (skips any without an assigned Master).
- **🗑 Delete** — bulk soft-delete with a typed-confirm: type `delete N` to wipe all ticked jobs at once.
- **✕** — clear selection.

### Adding a new job

**+ Add Job** button top-right. Modal collects customer name, service, address, city, **start date + duration in days + auto-computed end date**, window (Morning/Afternoon/All-day), area, quoted total, and tags. Submit lands the new card at the **New Request** column with no Master assigned. The customer + Master get notified once you dispatch.

## 5. Painter roster (`/admin/artisans.html`)

The grid of Paint Master cards. Each card shows avatar, name, region, years, rating, current status (Available / On job / On leave).

Click a card to open the painter modal. Inside:

- **KPIs** — completed jobs, average rating, on-time %, QA pass rate.
- **Specialties + certifications.**
- **Availability mini-calendar** for the next 28 days.
- **Current assignment** card if they're on a job.
- **Quick actions** — four buttons.

### Quick actions

- **💬 Message Kofi** — channel-aware composer (📱 SMS / 🟢 WhatsApp / 💬 In-platform). Recipient locked to this painter. SMS opens your phone's messaging app pre-filled; WhatsApp opens wa.me; in-platform posts to their notification feed.
- **📅 View full calendar** — opens a 28-day grid in a stacked sub-modal (so closing it returns you to the painter detail). Today outlined in navy, booked days in gold with the booking ref shown, busy/leave days in red. Includes a "Next up" table of the next 5 jobs.
- **📋 Assign new job** — lists every unassigned/pending job, with a region-match badge. Click Assign → routes the job to this painter, dispatches it, marks them on_job, and the painter's notifications panel ticks up.
- **🔄 Toggle availability** — cycles status: Available → On a job → On leave → Available. Confirms before applying.

### Adding a new Paint Master

**+ Add Paint Master** button top-right. Modal collects name, phone, email, region, years, specialties. On submit:

- Creates the painter in the in-memory store, the shared `pmUsers` store, and (best-effort) the real backend via `POST /api/auth/register`.
- Generates a temporary password.
- Shows a **confirmation modal with a Copy SMS text** button — copies a pre-filled message you can SMS to the new painter with their login details.

The painter then signs in with the temp password and is forced through the change-password flow on first sign-in.

## 6. Customers (`/admin/customers.html`)

The 360-view of every customer. Two-pane layout: list on the left, detail on the right.

### Per-customer actions

In the detail header (right pane):

- **✎ Edit** — opens an edit modal for name / phone / email / city / type. Changes apply immediately. Has a delete-customer button at the bottom that requires you to type the customer's full name to confirm (linked job history is unaffected).
- **+ New booking** — opens the customer-side booking flow with this customer's name and phone pre-filled. Useful for booking on a phone call.
- **💬 Message** — same channel-aware composer as the painter modal (SMS / WhatsApp / In-platform).

### Top-bar actions

- **+ Add Customer** — modal for creating a customer record outside of a booking. Useful when you're adding a known property manager who hasn't booked yet.
- **⬇ Export** — CSV download of currently-filtered customers (honours the search and type filter).

The detail panel also shows the customer's job history (upcoming + past), notes, preferences, and warranty certificates.

## 7. Approvals (`/admin/approvals.html`)

Two queues on one page.

### Painter applications

Top section. Anyone who applied via the customer-side **Apply to Academy** form lands here. Each row has View, Approve, Reject. Approving converts their pmUsers record from `pending` to `active` and they can sign in. Rejecting clears them out (no email is sent — that's manual).

### Photo moderation queue

Bottom section. Customers can upload progress photos from their tracker; every upload lands here pending approval. Each row shows a thumbnail, the customer name, booking ref, original filename, file size, and any caption.

- **Approve** → photo becomes visible on the customer's tracker AND on the assigned painter's view.
- **Reject** → asks for a reason (optional, shown to the customer), hides the photo from everyone but admin.

The queue auto-refreshes after each action. Pending photos are marked with a gold "⏳ Pending review" badge on the customer's tracker until you approve.

## 8. Inventory (`/admin/inventory.html`)

Tracks every SKU across paints, primers, specialty, consumables.

### Daily ops

- **Low-stock alert banner** appears when SKUs dip at or below their reorder threshold. **Reorder all** kicks off POs for all flagged SKUs.
- **Per-row Reorder / Adjust** opens a PO modal with a suggested quantity (brings stock to ~2x reorder threshold).
- **+ Add SKU** — modal for new inventory items. Categories and suppliers come from existing entries with a "+ New" inline option.

### Side panels

Recent material usage (last 7 days), supplier summary, and the standing-orders config.

## 9. Painter Payouts (`/admin/payouts.html`)

The end-of-period payment workflow. Period chips (week / month / 90 days) drive the table.

For each painter with earnings in the period:

- **Jobs** — count of completed jobs.
- **Gross** — sum of those jobs' totals.
- **Net 90%** — gross less 10% platform fee.
- **Warranty 5%** — 5% of net held back.
- **Payable now** — net less warranty hold (95% of net).
- **Override** — editable amount if there's a special situation (advance taken, deduction, settlement).
- **Mark paid** button.

When you click Mark paid:
- A typed amount is captured (override or auto-calc).
- The status flips to **Paid** with a green pill.
- A `payment` activity event fires (visible to the painter in their notifications).
- An **↶ Undo** button replaces Mark paid in case of error.

Use **Export CSV** to download the period's payout summary for your bookkeeping.

When Hubtel Send Money ships in Phase 2, the Mark paid button becomes "Send via Hubtel" and the disbursement happens server-side automatically.

## 10. Settings (`/admin/settings.html`)

Seven tabs.

- **Branding** — logo, brand text, colours, kente stripe toggle, hero slider editor (drives the customer-site homepage).
- **Account** — your name / phone / region. Auto-saves on blur. Sidebar updates live as you type.
- **Business** — company name, contact email, contact phone, address, working hours.
- **Pricing** — platform fee % (defaults 10), materials cost per m², refund window in hours.
- **Notifications** — SMS / Email / WhatsApp on-off toggles, plus the **Email setup** panel (provider, credentials, from address, reply-to, test-send button).
- **Security** — password change, active sessions.
- **Data** — pre-launch tools. Lists every localStorage key with byte counts, lets you wipe selected keys, and offers a one-click "Reset to clean production state" wizard.

## 11. Help & Support (`/admin/support.html`)

FAQ on the left, contact + ticket form on the right.

The ticket form has:

- Subject, body
- **Priority** (Low / Normal / High / Urgent — drives the activity event severity)
- **Send via** picker (💬 In-platform / ✉️ Email / 🟢 WhatsApp / 📱 SMS)

In-platform tickets land in the bell + activity feed. The other channels open the device's native app pre-filled.

The "Your tickets" panel below the form lists every ticket you've submitted from this device, with status badges (open / sent / failed / resolved) and re-send / mark-resolved actions.

## 12. Daily checklist

A typical morning takes 15 minutes:

1. **Open the dashboard.** Glance at KPIs. Read the activity feed for anything overnight.
2. **Clear the bell.** Mark anything you've actioned as read.
3. **Pending Assignment column on the dashboard.** Open each card, pick a Master, dispatch.
4. **Approvals page.** Clear any pending painter applications. Clear any pending photos in the moderation queue.
5. **Today's schedule.** Skim the table — anyone running late, anything weird? Catch it before customers do.

A typical afternoon:

1. **Watch the activity feed for `[Concern]` and `[Cash request]` events** — handle immediately, don't batch these.
2. **Reply to support tickets from your queue.**
3. **Check inventory low-stock banner.** Reorder if anything is below threshold.

End of week:

1. **Open Payouts.** Pick the week chip. Verify each painter's auto-calc looks right (cross-check against the activity log if anything is off).
2. **Mark paid** for each painter as you process their MoMo transfer.
3. **Export the payout CSV** for your bookkeeping.

## 13. Things to watch

- **Activity feed for repeated `[Cash request]` events from the same Master.** Two reports = pull them off the platform pending an in-person conversation.
- **Reviews under 4 stars.** Read the comment, identify the pattern, log it in the painter's notes via Customer Settings → Notes (when implemented; for now, message the painter directly).
- **Stuck jobs** — anything in QA for >48 hours. The QA team is short-staffed; nudge them via the support ticket flow with priority "High".
- **Empty calendars** — if a Master has no jobs scheduled for a week, check whether they're on leave or being skipped in assignment. The artisan modal's calendar tells you.

## 14. Pre-launch reset

When you're ready to clear demo data and go live:

1. **Settings → Data → Reset to clean production state.** Type `reset production` to confirm. Wipes every `pm_*` key on this device.
2. **Edit each HTML page's `<meta name="pm-mode">` to `production`.** The reset modal lists the files for you. After this flip, the local-fallback login is disabled — only the real backend can sign anyone in.
3. **Follow `DEPLOYMENT.md`** for the rest of the launch checklist (env vars, systemd, nginx, Hubtel webhook, DNS).

## 15. Getting help

You're the front line for customers and painters, but you're not on your own:

- The founder is on `+233 24 000 0000` for anything urgent.
- Backend issues (the API not responding) — message the engineer; don't try to debug from the admin console.
- Hubtel issues (a payment didn't reconcile) — log a ticket via Help & Support with priority Urgent, then call Hubtel support directly with the booking ref.

You'll get faster at all of this within a week. The platform is designed so that 80% of dispatcher work happens through one of three pages: dashboard, jobs, approvals. Stay on those, and the rest is one search away.
