# ToolPulse Action Plan

Generated from the 2026-07-28 tools audit. Production code was not changed during this audit.

## Critical before launch

1. **Correct character-count semantics**
   - Decide whether “characters” means grapheme clusters, Unicode code points, or UTF-16 units.
   - Prefer `Intl.Segmenter` grapheme counts for user-facing Character Counter metrics.
   - Add emoji, flags, skin tones, combining marks, and Indic-script regression tests.

2. **Complete dark-mode coverage**
   - Audit homepage, ToolCard, header/footer links, Word Counter, Character Counter, JSON Formatter, and JSON Builder.
   - Cover panels, inputs, borders, statuses, disabled states, dialogs, FAQs, and related links.
   - Validate contrast in a real browser.

3. **Establish a real quality gate**
   - Add strict type-check, lint, unit-test, and browser-test scripts.
   - Gate builds on registry/route parity and duplicate slugs.
   - Cover critical encode/decode, JSON, counter, clipboard-state, download-state, and clear/reset workflows.

4. **Configure production URL and canonical behavior**
   - Set Astro `site` for the deployment domain.
   - Pass `canonicalPath` from every tool page.
   - Verify canonical and Open Graph URLs in generated HTML.

5. **Define Base64 file-size policy**
   - Measure peak memory in Chromium, Firefox, Safari, and mobile.
   - Add a warning or hard limit based on results.
   - Ensure allocation failures produce a friendly message.

## Important next sprint

1. Extract `textStats.ts` and share it between Word and Character Counter.
2. Extract JSON Formatter parsing, analysis, and error-location logic from inline page code.
3. Split JSON Builder pure model/conversion functions from DOM rendering and test them.
4. Add a shared clipboard helper that reports final failure rather than assuming `execCommand` succeeded.
5. Standardize visible/live status messages and error wording.
6. Derive related available tools from the central registry.
7. Add FAQ/schema helpers and bring Word/Character/Base64 SEO integration to parity.
8. Improve Base64 tab semantics with IDs, `aria-labelledby`, roving tabindex, and arrow keys.
9. Test deep JSON Builder nesting at 320/375 px and improve move button accessible names.
10. Mark JSON Formatter output stale immediately when input changes; add cross-browser syntax error tests.
11. Remove unused Astro starter component, layout, and assets after confirming no external references.
12. Replace the generic GitHub link with the real repository or remove it until available.

## Optional improvements

- Explain Word Counter’s sentence, paragraph, and 200 WPM definitions.
- Add JSON Formatter download and optional key sorting.
- Add collapsible JSON Builder nodes and schema presets.
- Add Base64 URL-safe mode and Data URL generation.
- Add configurable platform limits to Character Counter.
- Introduce category pages only when the catalog size justifies them.
- Add performance thresholds and Web Worker paths for exceptionally large JSON.

## Future AI enhancements

- **Writing workspace:** Word/Character counters plus readability, tone, and rewrite suggestions, with explicit opt-in before any remote AI processing.
- **JSON workspace:** Formatter, Builder, schema validation, sample generation, and optional schema-assisted field suggestions.
- **Encoding workspace:** Base64, URL, HTML, Hex, JWT inspection, and hashing in one local-first shell.
- **Explain errors:** optional AI explanation of JSON validation errors using redacted/minimized input.
- **Tool discovery:** natural-language tool search mapped to deterministic local utilities.

Any AI feature must distinguish local deterministic processing from remote model calls and obtain clear user consent before transmitting content.

## Suggested next-sprint acceptance criteria

- All five tools pass automated happy-path and invalid-input tests.
- Counter labels and Unicode behavior are documented and tested.
- No audited surface has dark-mode contrast regressions.
- Canonical tags render for all routes.
- Registry/page parity fails CI when inconsistent.
- Browser tests cover 320, 375, 768, 1024, and 1440 px smoke layouts.
- Base64 tests cover Unicode, Data URLs, PNG preview, PDF download metadata, invalid input, clear, and object URL cleanup.

