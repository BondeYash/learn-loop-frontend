# Praneet Vidyapeeth visual redesign

The interface uses an open editorial layout with cobalt, acid lime, coral and warm off-white. Dark mode uses deep green with lime actions. Plus Jakarta Sans and the existing local Devanagari fonts are served from this repository. Course prices, enrollment policies, payment requests and access rules are unchanged.

## Shared interface

- Desktop authenticated pages use a persistent navigation rail; tablets and phones use icon-and-label navigation tabs. Account identity, theme and sign-out controls share the new top bar.
- Workspace headings use open typography and a small accent, replacing the large boxed title panels. Generic sections use dividers and spacing. Course tiles, dialogs, the player and chat retain surfaces where containment serves a purpose.
- `components/Action.jsx` supplies native buttons, action links and back links. Existing handlers, form types, refs, disabled state and accessible labels are forwarded. Decorative Lucide icons are hidden from assistive technology. Existing supplied icons take precedence; text-only actions receive a semantic icon.
- Forms, filters, dialogs, loading placeholders, empty/error states, progress, course artwork, payments, mock tests, question import, assignments, acquisition, learning support, notifications and Doubt Dost use the same tokens and controls.
- `index.css` owns shared tokens and layout. Feature styles cover landing sections, authentication, exam notices, video controls and chat. Tailwind's primary/slate palettes align with those tokens.

Back links point to an explicit parent route rather than browser history, so a direct visit has a useful return destination. New decorative icons do not change action names for screen readers.

## Landing page and motion

The landing page has an asymmetric student-photo composition, a real course-price callout, official exam-resource links, public course search, exam notifications, the interactive study routine, enrollment steps and keyboard-operable FAQs.

GSAP and its React helper load in a separate chunk on the landing page. The animation controller renders no UI, so loading it never replaces the page or resets form/planner state. Effects are scoped and reverted on unmount; `gsap.matchMedia` skips animations when reduced motion is requested. Entrance and scroll reveals are brief; the decorative star animation finishes within four seconds. Content is readable without the animation chunk. Other app pages do not import GSAP.

Hero photos are optimized local WebP assets with explicit dimensions. The main photo has high fetch priority; exam images are lazy loaded. There are no new third-party scripts, image requests or analytics calls.

The direction draws on exam-first navigation and clear learning resources used by [Testbook](https://testbook.com/) and [Physics Wallah](https://www.pw.live/ssc), with an original visual composition. Implementation follows [GSAP React cleanup guidance](https://gsap.com/resources/React/) and [responsive/reduced-motion handling](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/).

## Image provenance

Photos are illustrative stock imagery, not testimonials or claims about students enrolled here. The [Pexels license](https://www.pexels.com/license/) permits use on commercial websites.

| Local asset | Source |
| --- | --- |
| `public/images/student-focus.webp` | [College girl studying for her exams, Shantanu Kumar](https://www.pexels.com/photo/college-girl-studying-for-her-exams-16562727/) |
| `public/images/student-at-desk.webp` | [Indian female student near laptop and notebook, William Fortunato](https://www.pexels.com/photo/indian-female-student-near-laptop-and-notebook-at-table-6392977/) |
| `public/images/upsc-mark.webp` | [UPSC official website](https://www.upsc.gov.in/), `/sites/all/themes/upsc/images/logo.png` |
| `public/images/up-police-mark.webp` | [UP Police Recruitment & Promotion Board](https://uppbpb.gov.in/Home/Index), `/Content/images/logo3.jpg` |

Exam marks identify external official resources. The section explicitly describes the platform as independent and does not claim partnership, endorsement or that every exam has a course available. Other exam pictograms come from the existing Lucide icon set.

## Temporary workspace failures

Doubt Dost workspace GET requests retry transient network/gateway responses at most twice, with short backoff and a 45-second request timeout. Authorization failures do not retry. The final persistent failure remains visible with a readable message. AI generation, payment, upload and publishing writes are not automatically retried by this helper. Activity request versions prevent an older course/filter response replacing a newer selection.

## Verification

Run `npm run lint`, `npm test`, `npm run build` and `npm run check:cloudflare`. Browser fixtures cover the landing page, public enrollment/payments, auth/admin/student/instructor routes, course authoring, PDFs/access, mock tests, learning support, video controls, notifications, imports, acquisition and Doubt Dost. Providers and accounts are simulated unless a fixture explicitly uses its disposable local backend. Check both themes, small screens and 200% zoom; no production payment or AI generation is part of these checks.

The dev server pre-bundles the worker-only Tesseract dependency at startup to avoid discovery-triggered reloads during a first scanned-PDF import. This affects development only.

## Verification record — 15 October 2026

Lint, frontend tests and the production build/Cloudflare dry run passed. Seventeen isolated Chrome browser suites passed: visual refresh, landing loading, public enrollment, catalog discovery, exam notices, assessments, mock feedback, course flow, design/dialog flow, learning support, student player, notifications, acquisition, payments, question import, question-import recovery and Doubt Dost.

The checks include both themes, 320px layouts, desktop layouts, 200% zoom, keyboard interaction, reduced motion, preserved course prices and data, English/Hindi scanned-PDF OCR, capture/refund/access flows with simulated Razorpay, optional-animation download failure and automatic recovery from simulated 502 workspace reads. A separate visual check covered all five authentication/password routes at 200% zoom and verified that knowledge-base usage labels do not overlap their values.

External payment, Parse and Gemini traffic was simulated or blocked. These tests do not charge a real card, spend AI credits, certify assistive-technology compatibility or establish production viewer capacity.

## Student chat, mobile enrollment and hero photos

Doubt Dost has a student navigation entry and dashboard/course shortcuts. `/doubts` shows course conversations, and course chats use an independently scrolling thread with a bottom composer, responsive course selection, Markdown answers and expandable authenticated PDF citations. See `docs/doubt-dost.md` for behaviors and privacy/access boundaries. Markdown uses the upstream [React Markdown](https://github.com/remarkjs/react-markdown) and [remark-gfm](https://github.com/remarkjs/remark-gfm) renderers.

Public course enrollment is placed before the long description/curriculum on mobile, with matching DOM reading order. The primary enrollment/payment action stays at the bottom of small screens while loading or purchasing; it uses the same server quote and Razorpay handler. Mobile notifications sit above this action, and chat notifications move to the top so they cannot cover the composer. Existing purchase/access rules and checkout prices are unchanged. Course pages also put the payment section ahead of the lesson overview for students without access.

The landing photo composition is a two-photo carousel using the existing licensed local images. It crossfades every five seconds once both images load. The course offer stays in place. Buttons select each photo or pause/play; hovering, keyboard focus and hidden browser tabs pause advancement. Reduced motion starts with autoplay paused and removes the fade. Decorative miniature imagery stays out of the accessibility tree. `tests/hero_slider_browser.py` verifies these behaviors, and payment browser suites assert that mobile checkout controls are visible and clickable without scrolling.

Verification for this update: lint, frontend tests, production build and Cloudflare dry run passed, as did all 19 browser suites (the previous 17 plus student-chat UI and hero-slider checks). The final payment test explicitly shows a notification while checking that the mobile checkout action can be hit without scrolling. The chat check includes IME Enter, Shift+Enter, saved per-course history, safe Markdown/clipboard behavior, viewport reduction to simulate a phone keyboard, and an empty chat opening at its greeting. All accounts and provider responses were synthetic; no live payment or AI credits were used.
