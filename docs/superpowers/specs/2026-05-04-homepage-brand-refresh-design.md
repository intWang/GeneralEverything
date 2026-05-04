# Homepage Brand Refresh Design

## Summary

Refresh the web homepage from a lightweight workflow shell into a professional B2B product homepage. The new page should feel closer to a mature SaaS marketing site, with the structural clarity and credibility of [RingCentral](https://www.ringcentral.com/), while staying honest to the current product: a video analysis tool for enterprise teams that turns recordings into transcripts, summaries, and answers.

The homepage should prioritize brand clarity over immediate tool usage. Users should understand what the product does, who it is for, and what outcome it produces before they encounter the analysis form and workspace.

## Goals

- Reposition the homepage from an early tool shell to a product-led marketing homepage.
- Make the product legible in under a few seconds for enterprise team users.
- Emphasize recorded meetings, training videos, and internal knowledge workflows.
- Keep the existing analysis workflow accessible, but place it within a stronger narrative and visual hierarchy.
- Preserve continuity with the existing React and CSS module architecture.

## Non-Goals

- Do not redesign the deeper analysis workspace into a fully new application IA.
- Do not add fake customer logos, fabricated stats, or unsupported claims.
- Do not introduce a dark theme or highly decorative startup-style visuals.
- Do not create new backend capabilities or alter API behavior.

## Audience

Primary audience: enterprise teams using recordings for review, training, and internal knowledge capture.

Secondary audience: operators, internal enablement teams, and knowledge workers who need quick understanding from long-form video content.

## Positioning

The homepage should position the product as a direct and professional utility:

`Video transcription, summarization, and Q&A for teams.`

Messaging should prioritize two value lines:

1. Turn long video recordings into fast, consumable outputs.
2. Enable follow-up questioning and knowledge reuse after the first review.

The first value line should lead, while the second should deepen the product story.

## Experience Principles

- Clear before clever: users should understand the product quickly.
- Product-led trust: show realistic product structure rather than abstract illustration.
- Enterprise tone: calm, confident, and concrete language.
- Narrative flow: move from what it is, to how it works, to where it helps, to how to start.
- Visual restraint: use spacing, contrast, and hierarchy instead of decorative excess.

## Visual Direction

### Tone

The page should feel modern, capable, and trustworthy. It should be visually adjacent to enterprise SaaS marketing pages like RingCentral, but not derivative of telecom branding.

### Color

- Base: white and cool off-white backgrounds.
- Primary text: deep navy.
- Primary accent: brand blue.
- Secondary accent: cyan or light blue for subtle emphasis.
- Supporting surfaces: pale gray-blue cards and borders.

Avoid warm gradients, saturated purple, or dark hero treatments.

### Typography

- Strong, bold headline typography.
- Clean, highly readable body text.
- Professional rather than playful tone.
- Headline sizing should feel substantial and corporate, not editorial or experimental.

### Surfaces and Components

- Rounded cards with light borders and shallow shadows.
- Large section spacing to create breathing room.
- Strong CTA hierarchy through button treatment, not visual clutter.
- Product preview modules should resemble simplified application panels.

## Information Architecture

The homepage should contain seven major sections in this order:

1. Sticky top navigation
2. Hero
3. Trust/value band
4. Capabilities
5. Workflow
6. Use cases
7. Product preview and closing CTA

## Section Design

### 1. Sticky Top Navigation

Purpose: establish product identity and enable quick movement through the page.

Content:

- Product name or brand mark on the left
- Anchor links on the right:
  - `Capabilities`
  - `Workflow`
  - `Use Cases`
  - `Preview`
- High-priority CTA button:
  - `Start analysis`

Behavior:

- Transparent or lightly blended over the hero at the top of the page.
- Transitions into a white sticky bar with soft shadow and border once the user scrolls.
- All links should use in-page anchors rather than route changes.

### 2. Hero

Purpose: explain the product clearly and create immediate confidence.

Layout:

- Two-column layout on desktop.
- Left column: text, CTA, value chips.
- Right column: stylized product preview card.
- On mobile, stack content vertically with text first.

Suggested content:

- Eyebrow:
  - `Video analysis for teams`
- Headline:
  - `Turn recordings into transcripts, summaries, and answers.`
- Supporting copy:
  - `Review meetings, training sessions, and internal video content in a workspace designed for faster understanding and follow-up.`
- Primary CTA:
  - `Start analysis`
- Secondary CTA:
  - `See workflow`
- Micro-proof chips:
  - `Transcript-first`
  - `Summary-ready`
  - `Ask AI follow-up`

Hero preview:

- A simplified workspace card showing:
  - recording title
  - status badge
  - summary block
  - transcript snippet
  - ask AI prompt area or answer card

This preview must feel product-real rather than illustrative.

### 3. Trust / Value Band

Purpose: establish confidence without inventing social proof.

Layout:

- Single horizontal band under the hero.
- Four concise value points displayed as chips or slim cards.

Suggested value statements:

- `Built for recorded meetings`
- `Designed for training archives`
- `Structured for follow-up questions`
- `Ready for internal knowledge reuse`

This section replaces fake logo walls with truthful product positioning.

### 4. Capabilities

Purpose: explain the four primary outputs and why they matter.

Layout:

- Four cards in a 2x2 grid on desktop.
- Single-column stack on smaller screens.

Cards:

1. `Transcript`
   - `Capture searchable spoken content without replaying the full recording.`
2. `Summary`
   - `Turn long recordings into concise takeaways, actions, and highlights.`
3. `Ask AI`
   - `Follow up with targeted questions after the first review is done.`
4. `Mind Map`
   - `Give teams a faster structural view of what the recording covered.`

Each card should contain:

- short label or icon
- feature title
- value-focused description

### 5. Workflow

Purpose: reduce perceived complexity and show the product flow as straightforward.

Layout:

- Four horizontal steps on desktop.
- Vertical numbered timeline on mobile.

Steps:

1. `Add a public video or recording source`
2. `Extract metadata and transcript`
3. `Generate summary and topic structure`
4. `Ask follow-up questions in one workspace`

Each step should include a short sentence and simple supporting visual treatment such as a numbered badge or line connector.

### 6. Use Cases

Purpose: translate product features into team outcomes.

Layout:

- Three cards.

Use cases:

1. `Meeting review`
   - `Revisit decisions, highlights, and unresolved questions without replaying the full call.`
2. `Training recap`
   - `Help teams absorb long training recordings faster and retain the important parts.`
3. `Knowledge capture`
   - `Turn one-off recordings into reusable internal references for future work.`

The copy should remain concrete and avoid vague transformational claims.

### 7. Product Preview and Closing CTA

Purpose: reconnect the marketing story to the actual interface and then drive action.

Layout:

- Split section:
  - left side: short explanatory text
  - right side: larger preview of the existing workspace structure

Preview should visually echo existing product architecture:

- status timeline
- video info
- transcript
- summary
- ask AI

Closing CTA:

- headline:
  - `Start with a recording. Leave with searchable answers.`
- primary CTA:
  - `Start analysis`
- secondary CTA:
  - `Explore workflow`

## Functional Behavior

The page must continue to support the current application workflow.

- `Start analysis` in the hero and closing CTA should scroll to the main analysis entry area rather than navigating away.
- `See workflow` and `Explore workflow` should scroll to the workflow section.
- Top navigation links should anchor-scroll to their corresponding sections.
- The current `InputSwitcher` and `AnalyzeForm` should remain on the page, but they should be repositioned into a more intentional analysis entry section rather than appearing immediately as the first visible content.
- If a job is already active or restored from URL state, the lower part of the homepage should continue to render the real status timeline, video info, and AI tabs.

## Implementation Approach

### Structural Changes

- Expand `Hero` from a simple text block into a full hero section with CTA actions and preview panel.
- Add new homepage sections as composable React sections, either within `page.tsx` or in dedicated presentational components if that improves readability.
- Introduce semantic section IDs for anchor navigation.
- Separate the marketing narrative area from the analysis workspace area while keeping both on the same page.

### Styling Changes

- Refactor `homepage.module.css` into a fuller layout system with:
  - navigation styles
  - hero grid styles
  - shared section container styles
  - card variants
  - CTA row styles
  - preview shell styles
  - responsive breakpoints

- Reduce inline styles in `page.tsx`, especially in the recent jobs list, by moving them into CSS module classes.

### Content Strategy

- Use straightforward B2B language.
- Avoid inflated claims or fabricated proof points.
- Write every section to answer one user question:
  - what is this
  - what do I get
  - how does it work
  - where does it help
  - how do I start

## Accessibility

- Maintain semantic headings and section landmarks.
- Ensure keyboard access for navigation and CTA controls.
- Preserve strong color contrast for buttons, text, and secondary surfaces.
- Keep responsive layouts readable at tablet and mobile widths.
- Avoid relying on color alone for status or emphasis.

## Responsive Behavior

- Desktop: two-column hero, multi-column cards, horizontal workflow.
- Tablet: compressed grids with preserved hierarchy.
- Mobile: stacked hero, stacked cards, simplified preview layouts, and scroll-friendly section spacing.
- Sticky navigation should remain usable on smaller screens without requiring a large desktop-style menu.

## Testing Expectations

At implementation time, verify:

- homepage renders new sections correctly
- anchor links and CTA scroll targets work
- analysis form remains usable
- restored job state still surfaces the existing workspace
- page remains readable and intentional across desktop and mobile layouts

## Risks and Mitigations

### Risk: homepage becomes too marketing-heavy for the current product maturity

Mitigation:

- Keep copy factual and product-tied.
- Use actual workspace-inspired previews instead of abstract promises.

### Risk: mixing marketing and application sections feels disjointed

Mitigation:

- Use a clear visual transition from brand narrative to analysis entry.
- Repeat interface motifs between the hero preview and the real workspace.

### Risk: CSS module grows unwieldy

Mitigation:

- Group selectors by section and create reusable utility-like classes within the module.
- Extract presentational React sections if `page.tsx` becomes too large.

## Acceptance Criteria

- Homepage feels like a professional B2B product site rather than an early workflow shell.
- Users can identify the product as a tool for video transcription, summarization, and Q&A.
- The page clearly serves enterprise team scenarios such as meetings, training, and internal knowledge capture.
- Existing analysis functionality remains available on the same page.
- The visual direction is lighter, cleaner, and more enterprise-oriented than the current version.
