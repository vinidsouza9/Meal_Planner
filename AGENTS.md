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
- Plan drag-and-drop swaps go through `swapCells` in `src/lib/plan.ts` (same meal type, never locked cells) and save directly to `plans` — rule lives in one tested helper.
