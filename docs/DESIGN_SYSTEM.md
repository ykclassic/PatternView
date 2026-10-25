# PatternView UI and responsive design specification

## Visual language
- Dark, low-glare analytical workspace with high-contrast text and restrained green/yellow/red status accents.
- Use the CSS custom properties in `src/app/globals.css` as the canonical design tokens.
- Use tabular/monospaced numerals for price and timestamp data; preserve units and never imply a heuristic score is a probability.
- Pattern geometry and state labels must remain readable without relying on color alone.

## Component contract
- **Top bar:** product mark and read-only market-data/backend status.
- **Market selector:** supported crypto spot pair buttons with visible selected and keyboard-focus states.
- **Timeframe selector:** 15m, 1h, 4h, 1d with a clear selected state.
- **Chart:** Lightweight Charts candlesticks with pattern pivot markers, neckline/breakout reference and invalidation overlays.
- **Interpretation panel:** pattern name, lifecycle status, heuristic score disclaimer, conditional levels and plain-language evidence.
- **History:** browser-local 20-record list with expandable provider/rule provenance and candle snapshot.
- **Operational states:** loading, provider unavailable with retry, no qualifying pattern, pattern found, and persistence availability.

## Responsive rules
- Desktop target: 1440×900. Use a two-column chart/interpretation layout with the chart as the wider column.
- Mobile target: 390×844. Stack chart and interpretation vertically; controls wrap without horizontal page overflow; chart remains zoomable.
- Touch targets should be at least 40px high. Keyboard focus must be visible on controls and details/summary elements.
- Keep errors adjacent to the affected workflow and retain explicit retry controls.
- Do not hide pattern status, data provider, or conditional-level disclaimers at narrow widths.

## Acceptance checklist
- [ ] Desktop screenshot and interaction pass at 1440×900.
- [ ] Mobile screenshot and interaction pass at 390×844.
- [ ] Keyboard-only selector, refresh, and history navigation.
- [ ] No horizontal overflow, clipped labels, or chart overlay collisions.
- [ ] Loading, error, retry, no-pattern, pattern-found, and persistence-offline states.
- [ ] Backend provenance and rule version are visible in scan history/detail.

CI verifies code contracts; manual viewport acceptance must not be marked passed without screenshot and interaction evidence.
