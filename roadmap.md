# Roadmap

- [x] Uploaded fixes: recipe defaults/reset, strict generation and swap tags, variety notes, recipe tags and AI button; 28 tests pass
- [x] Uploaded fixes: print grid, prebuilt native PDF sharing and complete PDF content; download checked, 120 grocery items retained across 3 pages
- [x] Published AI diagnosis: unsupported maxItems schema rejected imports; corrected and verified text/photo import, saved temporary plan and AI swap in signed-in preview; owner-scoped policies and profile trigger verified, no missing profiles
- [x] Second-account text/photo AI imports, text save/reload, photo crop/save/reload and private image display pass in preview; temporary recipes removed, existing data untouched
- [ ] Publish existing AI schema correction — second-account live text import still runs old maxItems schema (HTTP 400, gateway log 01a14862-4462-7efb-90fa-0e3a01b841d2 at 2026-10-17T05:42:42Z); publishing requires user action before live recheck

- [x] Cooking summary matches the displayed calendar: breakfast before 11, lunch until 4, dinner afterward; only dish name, time, recipe link. Verified Green Chicken dinner and recipe opening; Grocery list stays top-right.

- [x] 1–6 attached updates: multi-meal recipes, single-page Plan my week, pastel planner, restrained print, unique saved weeks
- [x] 7–11 attached updates: required signup names, account page, avatar, personalized header, Vineeta account
- [x] 12. Photo editor: crop/zoom/rotate, originals retained, adjust recipe and avatar photos; saved/reopened images, keyboard and mobile layout verified

- [x] 1. Top header nav (logo, links, user menu, hamburger); remove bottom nav
- [x] 2. Neutral planner design (grey labels, outlined tags, green accent only)
- [x] 3. Week range + prev/next arrows + day dates (plan, print, PDF, history)
- [x] 4. Cross-meal drag swaps + busy-day dinner warning + undo
- [x] 5. History page (last 2 plans, expandable, read-only grid + grocery + print)
- [x] 6. Share plan as PDF (native share / download / WhatsApp / email)
- [x] 7. Pastel printable planner (one portrait page, B&W safe)
- [x] 8. Recipe modal: fixed header/footer, scrollable body, 90vh
- [x] 9. Recipe photos: storage bucket, image_url, upload/remove, AI import option, placeholders
- [x] 10. Grocery list PDF share (same menu), keep Print/Copy
- [x] Verify: typecheck, tests, build log, browser spot-check
- [x] 13. Loading feedback: cooking loader, button spinners, skeletons, 20s/error Try again, reduced motion, aria-live
- [ ] 14. Weekly email reminder (Resend) — waiting on user's go-ahead + Resend API key
