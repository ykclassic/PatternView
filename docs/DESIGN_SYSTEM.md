# PatternView UI and responsive design specification

## Visual language

- Dark, low-glare analytical workspace with high-contrast text and restrained green/yellow/red status accents.
- Use the existing CSS custom properties in `src/app/globals.css` as the canonical design tokens.
- Use tabular/monospaced numerals for price and timestamp data; preserve units and never imply a heuristic score is a probability.
- Pattern geometry and state labels must remain readable without relying on color alone.

## Component contract

- **Top bar:** product mark, read-only market-data label, responsive navigation metadata.
- **Market selector:** explicit supported spot pair buttons; selected state is visible to keyboard and pointer users.
- **Timeframe selector:** 15m, 1h, 4h, 1d with a clear selected state.
- **Chart:** Lightweight Charts candlesticks with pattern pivot markers, neckline/breakout reference and invalidation level overlays.
- **Interpretation panel:** pattern name, lifecycle status, heuristic quality score disclaimer, conditional levels and plain-language evidence.
- **History:** browser-local 20-record list with expandable provenance and candle snapshot.
- **Operational states:** loading, provider unavailable with retry, no qualifying pattern, and database persistence availability.

## Responsive rules

- Desktop target: 1440×900. Use a two-column chart/interpretation layout with the chart as the wider column.
- Mobile target: 390×844. Stack chart and interpretation vertically; controls wrap without horizontal page overflow; chart remains scroll/zoom usable.
- Touch targets should be at least 40px high. Keyboard focus must be visible on all controls and details/summary elements.
- Keep errors adjacent to the affected workflow and retain explicit retry controls.
- Do not hide pattern status, data provider, or conditional-level disclaimers at narrow widths.

## Acceptance checklist

- [ ] Desktop screenshot and interaction pass at 1440×900.
- [ ] Mobile screenshot and interaction pass at 390×844.
- [ ] Keyboard-only selector, refresh, and history navigation.
- [ ] No horizontal overflow, clipped labels, or chart overlay collisions.
- [ ] Loading, error, retry, no-pattern, pattern-found, and persistence-offline states.
- [ ] Backend and local fallback modes display their provenance clearly.

The live app's existing stylesheet implements the token and component baseline. A future Figma handoff should mirror this contract; browser QA is tracked separately from CI.
