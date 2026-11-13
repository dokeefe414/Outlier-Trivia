# OUTLIER ISSUE 01 — Independent Art Direction (v1.2)

## Creative direction

OUTLIER is a daily game for people with strangely specific knowledge.
It shouldn't feel like a SaaS analytics dashboard or a generically polished
AI demo. The art direction borrows the *discipline* of old sports annuals,
printed gig posters, and tiny independent magazines: big functional type,
unexpected composition, purposeful imperfections, and sharp contrast.

**Core creative idea:** "Think odd. Be right." A printed field guide for the
knowledge you never thought would be useful.

This is an original visual system implemented with HTML, CSS and a custom SVG
mark, not a claim that the website was made by a particular human designer.

## Palette and materials

| Token | Color | Purpose |
| --- | --- | --- |
| Ink | #141c17 | Near-black green, print shadows and body backdrop |
| Paper | #f3efe1 | Natural cream, readable question tickets and results |
| Acid | #d9ef69 | Game CTA, printed poster, stamps, scoreboard figures |
| Signal | #f46d49 | Handmarked emphasis, winner's ticket offset, editorial accents |
| Panel | #1e2922 | Flat dark green cards without fake glass |

No decorative aurora blobs, stock renders, unnecessary gradient borders, or
constantly glowing cards. Decorative parts are geometry in CSS and an original
small SVG mark. The central poster uses a literal composition of numerals,
labels, a drawn seal, and offset print shadows. All critical text remains
actual selectable HTML.

**Typography:** Archivo Black for oversized headlines; DM Sans for readable
interface copy; DM Mono for date stamps, scores and tiny editorial labels.
System fallbacks are included if hosted fonts can't load.

**Proportions:** Flat corners, confident 2px strokes, no generic 24px
border-radius on every component. Controlled misalignment is restricted to
noninteractive artwork; controls and game text stay straight and aligned.

## Built surfaces

- **Wordmark and favicon:** Custom broken-ring "O" mark with a signal-colored
  segment breaking from the letter.
- **Homepage:** Two-column opening spread, poster assembled from typography
  and shapes, seven-question story, handwritten-looking angular marker, and
  three asymmetric rule panels made from contrasting paper colors.
- **Daily question:** Off-white ticket, striped category edge, high-legibility
  dark text, conspicuous countdown and strong action. This is deliberately
  calmer than the opening poster to make timed reading easy.
- **Answer reveal:** Letterpress-like scoring, large non-gradient numerals,
  editorial rarity stamps instead of persistent sparkles or extra noise.
- **Results:** Saved score sheet with a dark score, hard offset accent,
  readable round tiles, accessible buttons.
- **Practice:** Dossier-style category and format selector with flat color,
  sturdy typography and scannable metadata.
- **Player profile and leagues:** Cohesive mission panels, score ledger,
  colorful earned frames, plain information hierarchy, clear rival outcomes.
- **Onboarding:** Neutral panels and consistent actions.

The admin review studio is an owner-only operational tool and retains its
purpose-built utilitarian layout; a design redesign never justifies exposing
private data in the public UI.

## Earned color themes

The earlier cosmetic themes remain **visibly distinct** rather than being
flattened into one design:
- Original: acid-lime and signal-orange ink.
- Aurora: sea-glass teal and warm amber.
- Sunset: coral and sunbleached gold.
- Champion: aged gold and sage-green trim.

Theme IDs, daily-completion unlock thresholds, and saved player choices are
unchanged. The same design grammar works in all four palettes; earned
customization never affects scoring.

## Responsive and accessibility rules

- 1040px: poster and big type shrink smoothly.
- 830px: homepage becomes a single-column editorial composition.
- 660px: header becomes two deliberate rows, poster remains readable, rules
  stack, question input and answer choices use the full width.
- 360px: very narrow phones still have full access to inputs and CTA.
- Reduced-motion preferences disable decorative transitions.
- Selected, disabled, hover, focus and feedback states remain distinct.
- The actual text and accepted answers are never burned into images.
- All interactive surfaces remain semantic native buttons and forms.

## Quality checks

Headless Playwright runs desktop and small-mobile gameplay and checks that:
- The obsolete glowing orbit illustration no longer exists.
- The custom poster exists and has the expected print-paper background.
- The timed question uses the intended off-white paper surface.
- The responsive site doesn't scroll horizontally on phones.
- The game still accepts approved answers, retries rejects without resetting
  the timer, supports all practice formats, and persists earned player frames.

The browser job saves five visual reference screenshots in the **editorial-
screenshots** CI artifact: desktop homepage, desktop question, mobile homepage,
mobile result, and a 320px narrow-phone homepage. These are human review aids, not a substituted
pixel-perfect design-quality guarantee.

## Practical future art direction

Do not add another generic gradient card whenever a feature ships. Extend
the existing layout grammar: label / strong type / rule / content / single
accent. Use print-inspired illustration sparingly; keep timed gameplay
calm. Add real editorially researched trivia *content* separately from
this visual redesign and never change sealed live competitive answers.

## Boundaries

The free game works without Supabase. Real accounts, verified online
leagues, and payments still require owner-controlled external setup.
This release changes visual identity and experience, **not** the rules,
rarity scoring, accepted answer lists, payment availability, or privacy.
