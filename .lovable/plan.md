## Plan: per-card Continue on /earner/apply

Move the step-1 "Continue" button from the bottom of the page into each template card, so each MK template card has its own Continue action.

### Changes to `src/routes/earner.apply.tsx`

1. **Inside each template `Card`** (step 1 list), add a `Continue` button in the `CardContent` footer:
   - Disabled when the template is blocked (already applied / already issued).
   - On click: `setTemplateId(t.id)` and `setStep(2)` in one go (stops propagation so the surrounding card click handler doesn't double-fire).
   - Right-aligned, small size, matches existing button styling.

2. **Bottom action bar** — hide the global Continue on step 1. Keep:
   - Step 2: `Back` + `Apply` buttons (unchanged behavior).
   - Step 1: no bottom buttons (each card owns its own action).

3. Card click-to-select behavior is preserved (visual highlight ring), but progression to step 2 now happens via the per-card Continue button.

No other logic, state, or styling changes.
