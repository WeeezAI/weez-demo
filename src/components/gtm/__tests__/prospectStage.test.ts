// components/gtm/__tests__/prospectStage.test.ts
//
// Feature: sales-workflow-frontend-restructure, Property 13: The stage machine is
// total, closed and surjective.
//
// `prospectStage.ts` gains no code in this feature (R20.6) — it keeps the three
// derivations it already has and gains this suite instead. So the suite has to earn
// its place by asserting the things a rewrite would otherwise have to re-prove:
//
//   total       every input the page can hold produces a stage. Not a throw, not
//               `undefined`, not an empty string — one of the seven, for any mixture
//               of absent keys, nulls, blank identifiers and out-of-range numbers.
//   closed      no eighth value is reachable, and none is declared. `PAUSED` and
//               `EXPIRED` are the two the design names explicitly: neither is
//               expressible against the backend (`TrackProspectOut` carries no
//               expiry field and the track route has no pause), so a stage nothing
//               can reach would be a promise the product cannot keep (R7.8).
//   surjective  each of the seven is reachable from some input. A stage that no
//               input produces is dead vocabulary, and the banner table in §3.2
//               would have a row that never renders.
//
// Closure is asserted twice on purpose. `STAGE_WITNESS` is typed
// `Record<ProspectStage, ProspectStageInput>`, so adding a value to the union stops
// compilation until someone produces an input that reaches it, and removing one stops
// it too — that is the *compile-time* half of "exactly seven". The generated runs are
// the runtime half: they feed the function off-vocabulary `busy` strings and unknown
// extra fields, the shape a widened wire payload would actually arrive in, and read
// the output back against the hard-coded seven.
//
// This file is scoped to Property 13. The per-stage derivations (Property 14) and the
// two predicates live in their own blocks in this same file.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  isIntelligenceActive,
  prospectStageOf,
  showsDecision,
  type ProspectBusy,
  type ProspectStage,
  type ProspectStageInput,
} from "../prospectStage";
// Type-only, so nothing of the client is loaded at runtime. Property 14's verdict
// vocabulary is tied to the client's own union rather than restated.
import type { LinkedInVerificationStatus } from "@/services/gtmAPI";

/**
 * The seven, written out rather than derived from the module, so the assertion has an
 * independent copy to compare against. If the union changes, `STAGE_WITNESS` below
 * fails to compile and this list is what the failure is measured against.
 */
const DECLARED_STAGES = [
  "ENRICHING",
  "RESOLVING",
  "ENRICHED",
  "ACTIVATING",
  "WAITING",
  "ACTIVE",
  "RECOMMENDED",
] as const satisfies readonly ProspectStage[];

/** The two values the design forbids, named so a reintroduction fails here (R7.8). */
const FORBIDDEN_STAGES = ["PAUSED", "EXPIRED"] as const;

/**
 * One input per stage. `Record<ProspectStage, …>` is the point: the type makes an
 * unreachable stage a compile error rather than a silent gap in the table.
 */
const STAGE_WITNESS: Record<ProspectStage, ProspectStageInput> = {
  ENRICHING: { busy: "enriching" },
  RESOLVING: { busy: "resolving" },
  ACTIVATING: { busy: "activating", profileId: "li-profile-1", stateVersion: 9 },
  ENRICHED: { profileId: null },
  WAITING: { profileId: "li-profile-1", stateVersion: 0 },
  ACTIVE: { profileId: "li-profile-1", stateVersion: 3 },
  RECOMMENDED: { profileId: "li-profile-1", stateVersion: 4, hasRecommendation: true },
};

// ─── Generators ───────────────────────────────────────────────────────────────
//
// Constrained to the input space the dossier can actually hold, and no narrower.
// `profileId` is `profile.profileId` off the wire, so it is a string, null, absent or
// blank; `stateVersion` is `ProspectStateFull.stateVersion`, which is null when the
// belief has not been read; `busy` is a write this page started.

const profileIdArb: fc.Arbitrary<string | null | undefined> = fc.oneof(
  fc.constantFrom<string | null | undefined>(
    null,
    undefined,
    "",
    " ",
    "   \t\n ",
    "li-profile-1",
  ),
  fc.uuid(),
  fc.string(),
);

const stateVersionArb: fc.Arbitrary<number | null | undefined> = fc.oneof(
  fc.constantFrom<number | null | undefined>(null, undefined, 0, 1, 2, -1, 0.5, Number.NaN),
  fc.integer({ min: -5, max: 500 }),
  fc.double(),
);

const hasRecommendationArb: fc.Arbitrary<boolean | undefined> = fc.constantFrom<
  boolean | undefined
>(true, false, undefined);

const busyArb: fc.Arbitrary<ProspectBusy> = fc.constantFrom<ProspectBusy>(
  "enriching",
  "resolving",
  "activating",
  null,
  undefined as unknown as ProspectBusy,
);

/** Every key optional, because the caller is free to omit any of them. */
const stageInputArb: fc.Arbitrary<ProspectStageInput> = fc.record(
  {
    profileId: profileIdArb,
    stateVersion: stateVersionArb,
    hasRecommendation: hasRecommendationArb,
    busy: busyArb,
  },
  { requiredKeys: [] },
);

/**
 * The same input with the wire drifting: a `busy` value outside the declared four and
 * unknown extra fields. Cast, because that is exactly the situation being modelled —
 * a payload the types do not describe. A drifted `busy` must fall through to the
 * persisted fields rather than escaping the union.
 */
const driftedInputArb: fc.Arbitrary<ProspectStageInput> = fc
  .tuple(
    stageInputArb,
    fc.oneof(
      fc.constantFrom("paused", "expired", "PAUSED", "tracking", "", "ENRICHING"),
      fc.string(),
    ),
    fc.dictionary(fc.string(), fc.jsonValue()),
  )
  .map(([base, drifted, extras]) => ({
    ...extras,
    ...base,
    busy: drifted as unknown as ProspectBusy,
  }) as ProspectStageInput);

describe("Feature: sales-workflow-frontend-restructure, Property 13: The stage machine is total, closed and surjective", () => {
  it("declares exactly the seven values and neither forbidden one", () => {
    // The compile-time half is `STAGE_WITNESS`'s type. This is the runtime reading of
    // it: the witness table's keys are the union's members, and they are the seven.
    expect(Object.keys(STAGE_WITNESS).sort()).toEqual([...DECLARED_STAGES].sort());
    expect(DECLARED_STAGES).toHaveLength(7);
    for (const forbidden of FORBIDDEN_STAGES) {
      expect(DECLARED_STAGES as readonly string[]).not.toContain(forbidden);
      expect(Object.keys(STAGE_WITNESS)).not.toContain(forbidden);
    }
  });

  it("maps every input into one of the seven, and no input outside them", () => {
    fc.assert(
      fc.property(stageInputArb, (input) => {
        const stage = prospectStageOf(input);
        expect(typeof stage).toBe("string");
        expect(DECLARED_STAGES as readonly string[]).toContain(stage);
      }),
      { numRuns: 1000 },
    );
  });

  it("stays inside the seven when the wire drifts off-vocabulary", () => {
    fc.assert(
      fc.property(driftedInputArb, (input) => {
        const stage = prospectStageOf(input);
        expect(DECLARED_STAGES as readonly string[]).toContain(stage);
        for (const forbidden of FORBIDDEN_STAGES) {
          expect(stage).not.toBe(forbidden);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("is total in the strict sense — no input throws and none returns nothing", () => {
    fc.assert(
      fc.property(fc.oneof(stageInputArb, driftedInputArb), (input) => {
        const stage = prospectStageOf(input);
        expect(stage).toBeTruthy();
      }),
      { numRuns: 500 },
    );
    // The empty object is the one input a generator with all-optional keys may or may
    // not produce, and it is the one the page holds before any read lands.
    expect(DECLARED_STAGES as readonly string[]).toContain(prospectStageOf({}));
  });

  it("reaches each of the seven from some input", () => {
    for (const stage of DECLARED_STAGES) {
      expect(prospectStageOf(STAGE_WITNESS[stage])).toBe(stage);
    }
  });

  it("reaches all seven from generated inputs alone, so none is witness-only", () => {
    // Surjectivity again, without the hand-written witnesses: the generated space on
    // its own has to cover the union. A stage that only the witness table can reach
    // would mean the dossier can never actually present it.
    const observed = new Set<ProspectStage>();
    fc.assert(
      fc.property(stageInputArb, (input) => {
        observed.add(prospectStageOf(input));
      }),
      { numRuns: 2000 },
    );
    expect([...observed].sort()).toEqual([...DECLARED_STAGES].sort());
  });
});
// ─── Property 14 ──────────────────────────────────────────────────────────────
//
// Feature: sales-workflow-frontend-restructure, Property 14: Each stage is derived
// from exactly its declared field.
//
// Property 13 above says the machine lands inside the seven. This block says *which*
// of the seven, and from what — one clause per derivation in design §3.1, and nothing
// else feeding it:
//
//   ENRICHED   the absence of a profile identifier, **without consulting the identity
//              verdict** (R4.7). This is the clause with a bug behind it: an earlier
//              version returned `ENRICHED` only for a `VERIFIED` identity, which left
//              an unsearched prospect with no decision on screen at all. So the
//              verdict is modelled here as a field that is genuinely present on the
//              object — the shape the dossier holds, since `ProspectProfile` carries
//              `linkedinVerificationStatus` beside `profileId` — and the assertion is
//              that all four of its values produce the same answer.
//   WAITING    a non-empty profile identifier together with state version `0` — and
//              equally with `null`, because an unread belief cannot be distinguished
//              from an unmoved one and claiming less is the honest answer (R7.6).
//   ACTIVE     any state version greater than zero, not a particular one (R7.7).
//   busy       outranks every persisted field, because a write this page started is
//              newer than the payload it is holding.
//
// The four verdict values are `LinkedInVerificationStatus` plus `null`, and `null` is
// a fourth value rather than a missing one: all three statuses mean an attempt ran,
// and never having tried is its own claim.
//
// Scoped to Property 14. The two predicates and the whitespace-identifier edge case
// are task 8.3's.

/** The four verdicts, tied to the client's own union so a fifth cannot slip past. */
const IDENTITY_VERDICTS = [
  "VERIFIED",
  "POSSIBLE_MATCH",
  "NO_MATCH",
  null,
] as const satisfies readonly (LinkedInVerificationStatus | null)[];

type IdentityVerdict = (typeof IDENTITY_VERDICTS)[number];

/** The four busy values, including the absence of one. */
const BUSY_VALUES = [
  "enriching",
  "activating",
  "resolving",
  null,
] as const satisfies readonly ProspectBusy[];

/**
 * The stage each in-flight write forces, exhaustive over the three by type. Adding a
 * fourth `ProspectBusy` member stops compilation until it names its stage.
 */
const BUSY_STAGE = {
  enriching: "ENRICHING",
  activating: "ACTIVATING",
  resolving: "RESOLVING",
} as const satisfies Record<Exclude<ProspectBusy, null>, ProspectStage>;

const WRITING_BUSY_VALUES = Object.keys(BUSY_STAGE) as (keyof typeof BUSY_STAGE)[];

/**
 * The input with an identity verdict actually on it.
 *
 * Not a cast: the dossier passes an object assembled from `detail.profile`, which
 * carries the verdict fields, so a verdict-bearing input is the realistic shape. The
 * function must ignore them, and "ignore" is only assertable if they are there.
 */
type VerdictBearingInput = ProspectStageInput & {
  linkedinVerificationStatus: IdentityVerdict;
  linkedinVerifiedAt: string | null;
  linkedinUrl: string | null;
};

function withVerdict(
  input: ProspectStageInput,
  verdict: IdentityVerdict,
): VerdictBearingInput {
  return {
    ...input,
    linkedinVerificationStatus: verdict,
    linkedinVerifiedAt: verdict === "VERIFIED" ? "2026-01-01T00:00:00.000Z" : null,
    linkedinUrl: verdict === "NO_MATCH" ? null : "https://www.linkedin.com/in/someone",
  };
}

const verdictArb: fc.Arbitrary<IdentityVerdict> = fc.constantFrom(...IDENTITY_VERDICTS);

/** An absent identifier: no row, or no read yet. The blank-string case is 8.3's. */
const absentProfileIdArb: fc.Arbitrary<string | null | undefined> = fc.constantFrom<
  string | null | undefined
>(null, undefined);

/**
 * A present identifier — anything whose trimmed length is non-zero. Built by
 * construction rather than filtered, so every draw is in the space under test, and
 * one padded value is included because surrounding whitespace does not unset a real
 * `li_gtm_profiles` identifier.
 */
const presentProfileIdArb: fc.Arbitrary<string> = fc.oneof(
  fc.uuid(),
  fc.string().map((suffix) => `li-${suffix}`),
  fc.constantFrom("li-profile-1", "  li-profile-2  ", "\tli-profile-3\n"),
);

/** Activation's resting reading: the fifteen belief rows opened and nothing observed. */
const restingStateVersionArb: fc.Arbitrary<number | null | undefined> = fc.constantFrom<
  number | null | undefined
>(0, null, undefined);

/** Any state version above zero — a dimension has moved, so there is a real belief. */
const movedStateVersionArb: fc.Arbitrary<number> = fc.oneof(
  fc.integer({ min: 1, max: 100_000 }),
  fc.double({ min: 1e-9, max: 1e9, noNaN: true }),
  fc.constantFrom(1, 15, Number.MAX_SAFE_INTEGER, Number.POSITIVE_INFINITY),
);

/** No recommendation, written both ways the caller can say it. */
const noRecommendationArb: fc.Arbitrary<boolean | undefined> = fc.constantFrom<
  boolean | undefined
>(false, undefined);

describe("Feature: sales-workflow-frontend-restructure, Property 14: Each stage is derived from exactly its declared field", () => {
  it("derives ENRICHED from an absent profile identifier, for every verdict and every persisted field", () => {
    fc.assert(
      fc.property(
        absentProfileIdArb,
        verdictArb,
        stateVersionArb,
        hasRecommendationArb,
        (profileId, verdict, stateVersion, hasRecommendation) => {
          const stage = prospectStageOf(
            withVerdict({ profileId, stateVersion, hasRecommendation, busy: null }, verdict),
          );
          // No profile row is the whole test. Not the verdict, not the belief, and not
          // a recommendation — a recommendation without a profile row is still a
          // prospect at the decision point.
          expect(stage).toBe("ENRICHED");
        },
      ),
      { numRuns: 500 },
    );
  });

  it("covers all four verdicts against all four busy values with no verdict-driven branch", () => {
    // The full 4 × 4 matrix, exhaustively rather than by sampling, because it is small
    // and it is the one table a reader wants to see written out.
    for (const verdict of IDENTITY_VERDICTS) {
      for (const busy of BUSY_VALUES) {
        const stage = prospectStageOf(
          withVerdict({ profileId: null, stateVersion: null, busy }, verdict),
        );
        expect(stage).toBe(busy === null ? "ENRICHED" : BUSY_STAGE[busy]);
      }
    }
  });

  it("returns an identical stage under all four verdicts, so no derivation reads one", () => {
    fc.assert(
      fc.property(stageInputArb, (input) => {
        const withoutVerdict = prospectStageOf(input);
        for (const verdict of IDENTITY_VERDICTS) {
          expect(prospectStageOf(withVerdict(input, verdict))).toBe(withoutVerdict);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("derives WAITING from a present profile identifier with state version 0 or null", () => {
    fc.assert(
      fc.property(
        presentProfileIdArb,
        restingStateVersionArb,
        noRecommendationArb,
        verdictArb,
        (profileId, stateVersion, hasRecommendation, verdict) => {
          const stage = prospectStageOf(
            withVerdict({ profileId, stateVersion, hasRecommendation, busy: null }, verdict),
          );
          expect(stage).toBe("WAITING");
        },
      ),
      { numRuns: 500 },
    );
    // The two readings named in R7.6 and in the module's own note, written out: the
    // exact zero the track route reports, and the unread belief that claims less.
    expect(prospectStageOf({ profileId: "li-profile-1", stateVersion: 0 })).toBe("WAITING");
    expect(prospectStageOf({ profileId: "li-profile-1", stateVersion: null })).toBe("WAITING");
    expect(prospectStageOf({ profileId: "li-profile-1" })).toBe("WAITING");
  });

  it("derives ACTIVE from any state version greater than zero", () => {
    fc.assert(
      fc.property(
        presentProfileIdArb,
        movedStateVersionArb,
        noRecommendationArb,
        verdictArb,
        (profileId, stateVersion, hasRecommendation, verdict) => {
          const stage = prospectStageOf(
            withVerdict({ profileId, stateVersion, hasRecommendation, busy: null }, verdict),
          );
          // Any value above zero, not a particular one: the claim is "a dimension has
          // moved", and how far it moved is the belief's business, not the stage's.
          expect(stage).toBe("ACTIVE");
        },
      ),
      { numRuns: 500 },
    );
  });

  it("derives RECOMMENDED from the recommendation alone, whatever the state version reads", () => {
    fc.assert(
      fc.property(
        presentProfileIdArb,
        fc.oneof(restingStateVersionArb, movedStateVersionArb),
        verdictArb,
        (profileId, stateVersion, verdict) => {
          const stage = prospectStageOf(
            withVerdict(
              { profileId, stateVersion, hasRecommendation: true, busy: null },
              verdict,
            ),
          );
          // Declared precedence inside activation: the recommendation is read before
          // the state version, so a ranked prospect still at its resting belief is
          // `RECOMMENDED` and not `WAITING`.
          expect(stage).toBe("RECOMMENDED");
        },
      ),
      { numRuns: 300 },
    );
  });

  it("lets an in-flight write outrank every persisted field", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...WRITING_BUSY_VALUES),
        profileIdArb,
        stateVersionArb,
        hasRecommendationArb,
        verdictArb,
        (busy, profileId, stateVersion, hasRecommendation, verdict) => {
          const stage = prospectStageOf(
            withVerdict({ profileId, stateVersion, hasRecommendation, busy }, verdict),
          );
          // Whatever the rows say, the write is newer than they are.
          expect(stage).toBe(BUSY_STAGE[busy]);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("outranks the most fully-persisted input there is, one busy value at a time", () => {
    // The input that would otherwise be `RECOMMENDED` — the furthest-along stage — so
    // the override is being read against the strongest persisted claim, not the weakest.
    const recommended: ProspectStageInput = {
      profileId: "li-profile-1",
      stateVersion: 42,
      hasRecommendation: true,
    };
    expect(prospectStageOf(recommended)).toBe("RECOMMENDED");
    for (const busy of WRITING_BUSY_VALUES) {
      expect(prospectStageOf({ ...recommended, busy })).toBe(BUSY_STAGE[busy]);
    }
  });
});
// ─── The two predicates, and the blank-identifier boundary ────────────────────
//
// Feature: sales-workflow-frontend-restructure, §3.1 / §15.1: unit and edge-case
// coverage for `isIntelligenceActive` and `showsDecision`, plus the whitespace-only
// profile identifier task 8.2 deliberately left here.
//
// Not a property — these are examples, and they are examples on purpose. Both
// predicates are total functions over a seven-value union, so the whole input space fits
// on screen; generating from it would only obscure which answers were actually pinned.
// What matters is that the membership sets are pinned *exhaustively* over the union
// rather than sampled:
//
//   isIntelligenceActive  exactly `{WAITING, ACTIVE, RECOMMENDED}` — the three stages
//                         where a `li_gtm_profiles` row exists. The row's existence is
//                         the activation flag; there is no tracking-state column, so
//                         these three and only these three mean "intelligence is on".
//   showsDecision         exactly `{ENRICHED, RESOLVING, ENRICHING}` — the decision
//                         point and the two transient stages that resolve back into it.
//                         An in-flight read is a poor reason to take the operator's
//                         choice off the screen.
//
// `ACTIVATING` is in neither, and that is the one answer worth stating out loud: the
// track request is in flight, so the decision has been made (nothing to offer) but the
// profile row does not exist yet (nothing to present). A predicate that admitted it
// would either flash the two cards back on mid-write or open the intelligence region
// over an empty belief.
//
// `PREDICATE_TRUTH` is typed `Record<ProspectStage, …>` for the same reason
// `STAGE_WITNESS` is: widening the union stops compilation until the new value declares
// both of its answers, and the iteration over `DECLARED_STAGES` catches it at runtime
// too. That is what the task means by "a widened union fails here".
//
// The derivations these read from are §3.1's, unchanged — busy first, then a non-empty
// *trimmed* profile identifier, then `hasRecommendation` before `stateVersion > 0`, and
// `ENRICHED` without consulting the identity verdict. `prospectStage.ts` gains no code
// for any of this (R20.6), which the export-surface example below holds to.

/**
 * Both predicates' answers for all seven stages, written out as one table so the reader
 * sees the full truth table rather than two filtered lists.
 */
const PREDICATE_TRUTH = {
  ENRICHING: { intelligenceActive: false, showsDecision: true },
  RESOLVING: { intelligenceActive: false, showsDecision: true },
  ENRICHED: { intelligenceActive: false, showsDecision: true },
  ACTIVATING: { intelligenceActive: false, showsDecision: false },
  WAITING: { intelligenceActive: true, showsDecision: false },
  ACTIVE: { intelligenceActive: true, showsDecision: false },
  RECOMMENDED: { intelligenceActive: true, showsDecision: false },
} as const satisfies Record<
  ProspectStage,
  { intelligenceActive: boolean; showsDecision: boolean }
>;

/**
 * Identifiers whose trimmed length is zero. `\u00a0` is included because a non-breaking
 * space is whitespace to `String.prototype.trim`, and a value pasted out of a rendered
 * page is exactly where one arrives from.
 */
const WHITESPACE_IDENTIFIERS = ["", " ", "  ", "\t", "\n", "\r\n", "   \t\n ", "\u00a0"] as const;

/**
 * The other half of the boundary: surrounding whitespace does not unset a real
 * identifier, so these *are* activation.
 */
const PADDED_IDENTIFIERS = ["  li-profile-2  ", "\tli-profile-3\n", " li-profile-4"] as const;

/** A small persisted matrix to run the blank identifier against, since none of it should matter. */
const PERSISTED_MATRIX: readonly Pick<
  ProspectStageInput,
  "stateVersion" | "hasRecommendation"
>[] = [
  { stateVersion: null },
  { stateVersion: 0 },
  { stateVersion: 1 },
  { stateVersion: 42, hasRecommendation: true },
  { hasRecommendation: true },
  { hasRecommendation: false },
];

/** The module's runtime surface: three functions, and nothing added (R20.6). */
const MODULE_EXPORTS = ["isIntelligenceActive", "prospectStageOf", "showsDecision"] as const;

describe("Feature: sales-workflow-frontend-restructure, §3.1: the stage module's two predicates", () => {
  it("answers for exactly the seven declared stages and no others", () => {
    expect(Object.keys(PREDICATE_TRUTH).sort()).toEqual([...DECLARED_STAGES].sort());
  });

  it("admits exactly WAITING, ACTIVE and RECOMMENDED as intelligence-active", () => {
    expect(DECLARED_STAGES.filter(isIntelligenceActive)).toEqual([
      "WAITING",
      "ACTIVE",
      "RECOMMENDED",
    ]);
    // Exhaustive over the union, so a stage added without an answer fails here rather
    // than quietly reading as inactive.
    for (const stage of DECLARED_STAGES) {
      expect(isIntelligenceActive(stage)).toBe(PREDICATE_TRUTH[stage].intelligenceActive);
    }
  });

  it("admits exactly ENRICHED, RESOLVING and ENRICHING as showing the decision", () => {
    expect(DECLARED_STAGES.filter(showsDecision)).toEqual([
      "ENRICHING",
      "RESOLVING",
      "ENRICHED",
    ]);
    for (const stage of DECLARED_STAGES) {
      expect(showsDecision(stage)).toBe(PREDICATE_TRUTH[stage].showsDecision);
    }
  });

  it("puts ACTIVATING in neither set, and no stage in both", () => {
    // Mid-write: the choice has been made, so no cards; the profile row does not exist
    // yet, so nothing to present either.
    expect(isIntelligenceActive("ACTIVATING")).toBe(false);
    expect(showsDecision("ACTIVATING")).toBe(false);
    for (const stage of DECLARED_STAGES) {
      expect(isIntelligenceActive(stage) && showsDecision(stage)).toBe(false);
    }
    // Six of the seven are in one set or the other; `ACTIVATING` is the single stage in
    // neither, which is the whole reason its banner carries the transition copy.
    const unclassified = DECLARED_STAGES.filter(
      (stage) => !isIntelligenceActive(stage) && !showsDecision(stage),
    );
    expect(unclassified).toEqual(["ACTIVATING"]);
  });

  it("refuses a stage outside the union from either set", () => {
    for (const forbidden of FORBIDDEN_STAGES) {
      // Unreachable by construction (Property 13), so this is the second line of
      // defence: were one reintroduced, it would present neither the decision nor the
      // intelligence region until it declared itself.
      expect(isIntelligenceActive(forbidden as unknown as ProspectStage)).toBe(false);
      expect(showsDecision(forbidden as unknown as ProspectStage)).toBe(false);
    }
  });

  it("does not read a whitespace-only profile identifier as activation", () => {
    // `activated = profileId.trim().length > 0`, so a blank identifier is the same claim
    // as no identifier: the prospect is still at the decision point. Getting this wrong
    // would strand an operator in `WAITING` — no cards, and an intelligence region over
    // a belief that was never opened.
    for (const profileId of WHITESPACE_IDENTIFIERS) {
      for (const persisted of PERSISTED_MATRIX) {
        const stage = prospectStageOf({ profileId, ...persisted, busy: null });
        expect(stage).toBe("ENRICHED");
        expect(isIntelligenceActive(stage)).toBe(false);
        expect(showsDecision(stage)).toBe(true);
      }
    }
  });

  it("still reads a padded real identifier as activation", () => {
    // The other side of the boundary, so the trim is not mistaken for "reject anything
    // with whitespace in it" — a stored identifier with stray padding is a real row.
    for (const profileId of PADDED_IDENTIFIERS) {
      expect(prospectStageOf({ profileId, stateVersion: 0 })).toBe("WAITING");
      expect(prospectStageOf({ profileId, stateVersion: 7 })).toBe("ACTIVE");
      expect(prospectStageOf({ profileId, hasRecommendation: true })).toBe("RECOMMENDED");
      expect(isIntelligenceActive(prospectStageOf({ profileId, stateVersion: 0 }))).toBe(true);
    }
  });

  it("exposes exactly the three derivations §3.1 declares, with nothing added", async () => {
    // R20.6: the module keeps its current derivations and gains this suite instead of a
    // rewrite. Read through the namespace object rather than the named imports above, so
    // the assertion is about what the module *has* and not about what this file asked
    // for; a fourth runtime export would mean logic moved into the module, and this is
    // where that shows up. Types are erased, so only the functions appear here.
    const module = await import("../prospectStage");
    expect(Object.keys(module).sort()).toEqual([...MODULE_EXPORTS].sort());
    for (const name of MODULE_EXPORTS) {
      expect(typeof module[name]).toBe("function");
    }
  });
});
