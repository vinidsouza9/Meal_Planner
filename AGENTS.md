<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- AI calls live in `src/lib/ai.functions.ts` (auth-protected server fns) using `src/lib/claude.server.ts`, which streams native /v1/messages, requests strict JSON schema and validates with zod — keeps keys server-side and model output trusted only after validation.
- Hard plan rules are re-enforced in code after the model answers — the saved plan must always obey them.
- Grocery list is computed in the browser from plan + recipes (`src/lib/plan.ts`) and cached in `grocery_lists` — deterministic, no AI cost.
- Recipe photos are resized client-side (`src/lib/image-resize.ts`) and sent as base64 to `parseRecipePhotosWithAI` — keeps payloads small and the AI key server-side.
- Plan drag-and-drop swaps go through `swapCells` in `src/lib/plan.ts` (any two cells, never locked cells) and save directly to `plans` — rule lives in one tested helper. `longDinnerOnBusyDay` in the same file decides the busy-day dinner warning toast.
- Week labels come from `weekRangeLabel` / `dayDateLabel` / `shiftWeek` in `src/lib/plan.ts` — plan page, print page, history and PDFs all use them so dates stay consistent.
- Now cooking uses the browser-local `currentCookingSlot` helper and the current week's plan independently of the displayed week — avoids hiding today's meal when browsing another week or mislabeling future meals.
- PDFs are built client-side with jsPDF in `src/lib/pdf.ts` (plan + grocery list); sharing goes through `src/components/ShareMenu.tsx` + `src/lib/share.ts` (native share sheet with the file, else Download/WhatsApp/Email fallbacks).
- Recipe and profile photos live in private `recipe-images` and `avatars` buckets; crop editing uses the shared PhotoEditor and browser canvas helper, saves original paths plus crop state separately, and deletes obsolete files only after row persistence succeeds — preserves re-crop quality and prevents broken photos after save failures.
- Recipes use meal_types arrays and generated plans pass enforceMealTypes; save_week_plan atomically replaces the unique user/week row and clears its grocery cache — prevents invalid slots, duplicate weeks and stale groceries.
- Account and header share profileQuery so saved names and signed avatar URLs refresh together — keeps personalization consistent.
- Authenticated layout is a single top header in `src/routes/_authenticated/route.tsx` (nav links + user dropdown + mobile sheet); there is no bottom nav.
- Loading UI lives in `src/components/Loading.tsx` (CookingLoader, useSlowAction, LoadingButton, skeletons) — slow actions use useSlowAction so errors/20s timeouts show one consistent "Try again" state without aborting the request.
