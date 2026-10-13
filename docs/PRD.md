## 1. Overview
Daily Sales Log is a small browser app for shop owners to record sales and see the value sold for a selected day. It uses Supabase to store transactions and has no build step.

## 2. Problem and user
The user is a shop owner recording a sale between customers. They need to enter it in seconds and trust the total without doing accounting or analysis. A short form, accurate money handling, and a table that agrees with the total matter more than extra features.

## 3. Goals
- **Log a sale:** Success means an item, positive amount, and editable sale time are saved with clear validation and failure feedback.
- **Show a running total:** Success means the total and cumulative table values match the sales for the selected local calendar day.

## 4. Non-goals
- **Edit:** Existing sales are not editable. The form records new transactions only.
- **Delete:** Excluded in the original scope, but deletion is implemented in the current app. See Differences from plan.
- **Auth:** No sign-in is required for the demo.
- **Categories:** Item names are entered directly, with no category management.
- **Inventory:** Sales do not update stock.
- **Multi-user:** The app has no per-shop or per-user separation.
- **Reports:** There are no accounting or analytical reports.
- **Payments:** The app records amounts only, not payment methods or processing.
- **Charts:** Sales are presented as a total and table, not visualizations.

## 5. User stories and acceptance criteria

**As a shop owner, I want to log a sale quickly so that I can return to serving customers.**
- Item name receives focus; item name and a positive amount are required.
- Invalid fields show inline errors, and the save button is disabled while the insert is pending.
- An insert failure shows a clear message and keeps the form values for retry.

**As a shop owner, I want to set the sale time so that I can record a late entry.**
- The editable date and time defaults to the current local time.
- A successful sale appears in the selected day only when its timestamp falls within that day.

**As a shop owner, I want each sale and the total to agree so that I can trust the dashboard.**
- The table shows individual sales newest first with a cumulative amount.
- After a successful insert, the table, total, and ticker update from the same in-memory sales array.

**As a shop owner, I want today to mean my local day so that sales near midnight are counted correctly.**
- The default dashboard date is the viewer's local date.
- Queries use local midnight through the next local midnight, converted to timestamps; past days can be selected.

**As a shop owner, I want a clear empty state so that I know when there are no sales.**
- A successful empty query shows “No sales yet. Go sell something.”
- The total for that day displays ₦0.00.

**As a shop owner, I want quick-add chips so that I can reuse recent item names.**
- Up to five recently sold distinct names appear under the item field.
- Selecting a chip fills the item name and focuses the amount field.

## 6. Key decisions and tradeoffs
- `amount` is PostgreSQL `numeric(12,2)`. JavaScript parses and sums integer cents with `BigInt`, avoiding floating-point drift.
- Day queries use the viewer's local midnight and next midnight, then send those instants to Supabase.
- One `render()` derives the table, total, and ticker from one sales array so displayed values stay consistent.
- Plain HTML, CSS, and vanilla JavaScript keep the app static, small, and free of a build step.
- There is no auth. RLS allows anonymous select and insert; a second migration also allows anonymous delete. This is a deliberate demo shortcut. Production should add sign-in and per-shop ownership policies, and restrict deletion to the authorized shop.

## 7. Design rationale
The sticky heads-up ticker keeps the selected day's total visible, and the “SOLD” stamp confirms a successful entry, so both support the app's core jobs. The neo-brutalist layout uses Bricolage Grotesque for display text, DM Sans for labels, DM Mono for money, and cream, ink, yellow, green, red, and blue accents. Dark ink and deep-green amounts sit on high-contrast surfaces, focus rings stay visible, and reduced-motion preferences make the ticker static and replace the stamp movement with a fade.

## 8. Seed data and verification
Enter these rows through the form to verify the dashboard. They are a manual test set, not database seed records.

| Time | Item | Amount |
| --- | --- | ---: |
| 08:05 | Bread loaf | ₦1,500.00 |
| 08:25 | Sachet water bag | ₦3,000.00 |
| 09:00 | Indomie carton | ₦15,500.00 |
| 09:40 | Peak milk sachets pack | ₦2,400.00 |
| 10:15 | Sugar 1 kg | ₦2,800.00 |
| 11:05 | Groundnut oil 1 L | ₦3,700.00 |
| 11:50 | Coca-Cola crate | ₦7,200.00 |
| 12:35 | Rice 5 kg | ₦10,500.00 |
| 13:20 | Milo sachets pack | ₦4,800.00 |
| 14:10 | Spaghetti carton | ₦12,000.00 |
| 15:25 | Eggs crate | ₦6,500.00 |
| 17:40 | Yam tubers | ₦5,000.00 |

**Expected total: ₦74,900.00**

## 9. Future work
- Add editing for a mistaken sale. Deletion already exists in the current app.
- Add authentication and RLS ownership for per-shop data.
- Add an end-of-day close summary.
- Add CSV export for the selected day.

## 10. Differences from plan
- Delete was listed as a non-goal, but the app includes a confirmed delete action and an anonymous delete policy.
- A date picker with previous and next day navigation was listed as future work, but it is already implemented.
- A copy-total clipboard button is implemented, although it was not in the supplied feature notes.
