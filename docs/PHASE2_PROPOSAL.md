# PatternView Phase 2 Proposal

**Status:** Proposed scope for review — not an implementation authorization for unlisted features.  
**Prerequisite:** Phase 1 Gate A pattern-safety tests must pass before Phase 2 detection-dependent behavior is relied upon.

## Objective

Improve the usefulness and auditability of the crypto spot analysis workspace without expanding the market scope or implying predictive accuracy that has not been measured.

## Proposed workstreams

### P2-A — Reproducible historical evaluation
- Add a versioned evaluation runner that replays timestamp-ordered closed candles and freezes detector rule version.
- Define a labeled dataset format: source, pair, timeframe, UTC range, candle data, pattern label, confirmation timestamp, invalidation label and reviewer notes.
- Prevent look-ahead: a pattern may only be emitted at the first timestamp when its required pivots and confirmation conditions were knowable.
- Report per-pattern sample count, TP/FP/FN/TN where meaningful, precision, recall and false-positive rate. Do not claim a universal accuracy score or profitability.
- Keep synthetic fixtures separate from market-history evaluation.

### P2-B — Detection auditability
- Make detector rule version explicit and stable in scan records.
- Record the exact candle input range and deterministic scan parameters.
- Preserve explanation and key pivots/levels so a stored scan can be replayed.
- Add deterministic regression fixtures for each supported pattern's positive, near-miss, waiting, breakout and invalidation states.

### P2-C — User workflow improvements
- Improve inspection of past scans and reproducibility export without introducing account sync or a backend by default.
- Add clearer status distinctions for no pattern, forming, waiting, qualified and invalidated results where the engine can support them without ambiguity.
- Keep the app read-only and preserve explicit conditional-level disclaimers.

## Explicitly out of scope for this proposal

- Forex, equities and perpetual futures.
- Trade execution, exchange credentials, wallet/account connections or portfolio actions.
- Automated alerts, subscriptions and paid plans.
- Machine learning or confidence scores before a labeled evaluation methodology exists.
- Additional pattern families until current six-pattern behavior has evidence-backed tests.

## Phase 2 acceptance gates

1. Gate A tests pass for all six patterns: valid positive, near-miss/negative, waiting, qualified and invalidated cases where applicable.
2. Evaluation runner has unit tests proving chronological replay and no future-candle leakage.
3. Evaluation output is reproducible from a versioned dataset and detector version.
4. Metrics include sample sizes and are not presented as profitability.
5. All existing CI gates pass.
6. Live provider outage drill and desktop/mobile verification remain release gates for broad production acceptance, even if they do not block isolated Phase 2 development.

## Decisions required before expanding scope

Approve or revise the proposed workstreams before adding alerting, new markets, ML, persistence backends, or additional pattern families. This proposal intentionally keeps Phase 2 focused on evidence quality and inspectability.
