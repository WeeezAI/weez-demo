//
// Which leads belong on the Prospect_Dossier, and which id every GTM call on it carries.
//
// Two helpers, one question. `evaAPI.isEnrichedProspect` decides which leads the dossier
// lists; `gtmLeadIdOf` produces the id each of those leads is then read and written by. They
// are tested in one file because they are two readings of the same field — `gtmLeadId`, the
// `sales_leads.id` that `lead_promotion.promote()` wrote during Enrich Now — and the dossier
// is only correct while they agree.
//
// **The call sites moved.** `pages/GTMProspect.tsx` used to own the per-prospect execution
// surface, so this page's job was to filter the list and hand the GTM id over in a
// navigation. That page is off the route table (R3.3) and its composition is folded into
// `pages/ProspectIntelligence.tsx`, which is now the single prospect surface — so
// `gtmLeadIdOf` is no longer the input to a link, it is the path segment on roughly a dozen
// GTM reads and writes issued from the dossier itself: `getProspect`, `getProspectState`,
// `getNextBestAction`, `trackProspect`, `resolveIdentity`, `recommendChannel`,
// `requestAction`, `confirmRelationship`, `confirmIdentity`, the `?lead_id=` deep link, the
// action-queue join, and the Contact gate. The assertions below are written against those,
// which is what task 5.6 asks for.
//
// The three tempting markers for the filter, and why each fails:
//
//   `enrichment.status === "enriched"`  the workspace sweep in `core/eva/service.py` sets
//                                      this for any lead that *arrives* carrying a contact
//                                      email — from the LinkedIn VM or the research engine
//                                      — with no Enrich Now click and no promotion.
//   `handoffState`                      the same sweep moves it to `"handed_to_max"`.
//   `contact.email`                     present on exactly those same swept leads.
//
// `gtmLeadId` is written by one code path: `lead_promotion.promote()`, from the
// `/eva/lead/enrich` route. So it means both "the operator enriched this" and "this
// prospect has a GTM identity", and those are the same question.
//
// The filter tests are mostly *negative*, because the failure mode is inclusion.
//
// Unit coverage supporting properties 6 and 7, which `ProspectDossier.compose.test.tsx`
// owns end-to-end (design §15.4).

import { describe, expect, it } from "vitest";

import { CONTACT_DIRECTLY_LABELS } from "@/components/gtm/labels";
import {
  contactGateOf,
  gtmLeadIdOf,
  overlayFor,
  type QueueOverlay,
} from "@/pages/ProspectIntelligence";
import { isEnrichedProspect, type QualifiedLead } from "@/services/evaAPI";
import { unknownFact, type ActionQueueItem } from "@/services/gtmAPI";

/**
 * A lead in the state the workspace sweep leaves it: an email on file, marked enriched,
 * handed to Max — and never promoted, because nobody clicked Enrich Now.
 *
 * This is the fixture that matters. Every wrong predicate accepts it.
 */
function sweptLead(overrides: Partial<QualifiedLead> = {}): QualifiedLead {
  return {
    id: "lead_abc123",
    entityId: "ent_1",
    company: "Sprouts.ai",
    domain: "sprouts.ai",
    website: "https://sprouts.ai",
    industry: "B2B SaaS",
    employeeRange: "51–200",
    hqLocation: "San Francisco, CA",
    acvTier: "high",
    icpFit: 82,
    recommendedAction: "auto_sequence",
    escalation: "",
    qualificationReason: "Series A GTM tooling",
    primaryEvent: null,
    eventType: null,
    signals: [],
    contact: {
      name: "Karan Chaudhry",
      role: "Founder",
      email: "karan@sprouts.ai",
      emailSource: "linkedin_vm",
      emailConfidence: 0.9,
      emailVerified: true,
      linkedinUrl: "",
    },
    enrichment: { website: "https://sprouts.ai", status: "enriched" },
    handoffState: "handed_to_max",
    status: "handed",
    notes: "",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * The dossier's own subject, derived the way the page derives it.
 *
 * Two filters in the order `ProspectIntelligence.tsx` applies them: Eva's rejections come
 * off first (`qualifiedLeads`), then the enriched filter (`activeLeads`). Restated here
 * rather than imported because the page holds it in a `useMemo` inside the component — the
 * point of the copy is that this file breaks the moment the composition stops matching.
 */
function dossierProspects(leads: QualifiedLead[]): QualifiedLead[] {
  return leads.filter((l) => l.status !== "rejected").filter(isEnrichedProspect);
}

/**
 * One action-queue row. Only `leadId` is load-bearing here — it is what the page's
 * `byLead` map is keyed on — but the row is built whole rather than cast, so a change to
 * the payload shape is a compile error rather than a lie in a fixture.
 */
function queueRow(leadId: string): ActionQueueItem {
  return {
    leadId,
    recommendationId: `rec-${leadId}`,
    profileId: null,
    profileUrl: null,
    name: unknownFact(),
    headline: unknownFact(),
    company: unknownFact(),
    journeyState: unknownFact(),
    relationshipState: unknownFact(),
    actionType: "SEND_LINKEDIN_WARMUP",
    channel: "LINKEDIN",
    executionVerb: "SEND_MESSAGE",
    executable: true,
    unexecutableReason: null,
    actionScore: {
      score: 72,
      scoreKind: "RECOMMENDATION_SCORE",
      scoreDisclaimer:
        "A prioritisation signal, not a predicted probability of conversion.",
      isDerived: true,
    },
    actionConfidence: 61,
    stateConfidence: 58,
    priorityTier: "TODAY",
    urgency: 64,
    expectedSuccessProbability: 47,
    businessValue: 55,
    signalFreshness: 80,
    whyNow: [],
    expiresAt: null,
    computedAt: "2026-09-01T00:00:00.000Z",
  };
}

/** The page's overlay, built exactly as `loadQueue` builds it from one queue page. */
function overlayOf(items: ActionQueueItem[], complete = true): QueueOverlay {
  return {
    byLead: new Map(items.map((item) => [item.leadId, item])),
    complete,
  };
}

describe("a lead belongs on Prospect Intelligence only once Enrich Now promoted it", () => {
  it("accepts a promoted lead", () => {
    expect(
      isEnrichedProspect(sweptLead({ gtmLeadId: "55475246-9bc8-45c9-aa34-e998cc2c4b0c" }))
    ).toBe(true);
  });

  it("refuses a lead the sweep marked enriched but nobody promoted", () => {
    // The load-bearing case. This lead has an email, reads `enriched`, and has been handed
    // to Max — and it has no `sales_leads` row, so Activate Intelligence, the ranked next
    // move and Contact Directly would all 404 on it. Every predicate that reads the
    // enrichment status instead of the promoted id accepts this lead.
    const lead = sweptLead();
    expect(lead.enrichment.status).toBe("enriched");
    expect(lead.handoffState).toBe("handed_to_max");
    expect(lead.contact.email).toBeTruthy();

    expect(isEnrichedProspect(lead)).toBe(false);
  });

  it("refuses a freshly qualified lead", () => {
    expect(
      isEnrichedProspect(
        sweptLead({
          enrichment: { website: "https://sprouts.ai", status: "pending" },
          handoffState: "pending_enrichment",
          status: "qualified",
          contact: { ...sweptLead().contact, email: "" },
        })
      )
    ).toBe(false);
  });

  it("refuses an absent, null or blank promoted id alike", () => {
    // All three mean the same thing — no GTM identity — and a blank string is the one that
    // would slip through a bare truthiness check on a field typed `string | null`.
    expect(isEnrichedProspect(sweptLead())).toBe(false);
    expect(isEnrichedProspect(sweptLead({ gtmLeadId: null }))).toBe(false);
    expect(isEnrichedProspect(sweptLead({ gtmLeadId: "" }))).toBe(false);
    expect(isEnrichedProspect(sweptLead({ gtmLeadId: "   " }))).toBe(false);
  });

  it("accepts a promoted lead whose enrichment found no email", () => {
    // `enrich_lead_now` answers `no_email` and promotes anyway — the `sales_leads` row is
    // created either way — so this prospect is workable and belongs on the page even though
    // there is no address yet. A predicate keyed on the email would drop it, and the
    // operator would lose the retry that is the only way to get one.
    const promotedWithoutEmail = sweptLead({
      gtmLeadId: "55475246-9bc8-45c9-aa34-e998cc2c4b0c",
      contact: { ...sweptLead().contact, email: "", emailVerified: false },
      enrichment: { website: "https://sprouts.ai", status: "no_contact" },
    });

    expect(isEnrichedProspect(promotedWithoutEmail)).toBe(true);
  });

  it("partitions a mixed workspace into the two pages", () => {
    const workspace = [
      sweptLead({ id: "a", gtmLeadId: "gtm-a" }),
      sweptLead({ id: "b" }),
      sweptLead({ id: "c", gtmLeadId: "gtm-c" }),
      sweptLead({ id: "d", gtmLeadId: null }),
    ];

    // Prospect Intelligence lists two; Market Intelligence lists all four.
    expect(workspace.filter(isEnrichedProspect).map((l) => l.id)).toEqual(["a", "c"]);
    expect(workspace).toHaveLength(4);
  });
});

describe("the dossier's prospect list is the enriched set of the workspace", () => {
  it("lists the promoted leads and nothing else", () => {
    // The same partition as above, now through the page's own `activeLeads` derivation
    // rather than through a bare `filter` — the enriched filter is the second of two and
    // the set it produces is the dossier's whole subject (R3.5, property 7).
    const workspace = [
      sweptLead({ id: "a", gtmLeadId: "gtm-a" }),
      sweptLead({ id: "b" }),
      sweptLead({ id: "c", gtmLeadId: "gtm-c" }),
      sweptLead({ id: "d", gtmLeadId: null }),
    ];

    expect(dossierProspects(workspace).map((l) => l.id)).toEqual(["a", "c"]);
  });

  it("drops a promoted lead the operator rejected", () => {
    // `qualifiedLeads` runs first and a rejection is a decision about the prospect, not
    // about their GTM identity — so a rejected lead keeps its `sales_leads` row and still
    // does not appear. Stated because the enriched filter alone would list it.
    const rejected = sweptLead({ id: "r", gtmLeadId: "gtm-r", status: "rejected" });

    expect(isEnrichedProspect(rejected)).toBe(true);
    expect(dossierProspects([rejected])).toEqual([]);
  });

  it("leaves every listed prospect with a usable GTM id", () => {
    // The invariant the folded surface rests on. Every GTM call on the dossier keys on
    // `gtmLeadIdOf(selectedLead)`, and its empty-string fallback is for the type rather
    // than for a reachable case — because the list it selects from is this set.
    const workspace = [
      sweptLead({ id: "a", gtmLeadId: "  55475246-9bc8-45c9-aa34-e998cc2c4b0c  " }),
      sweptLead({ id: "b" }),
      sweptLead({ id: "c", gtmLeadId: "" }),
      sweptLead({ id: "d", gtmLeadId: "gtm-d" }),
    ];

    for (const lead of dossierProspects(workspace)) {
      expect(gtmLeadIdOf(lead)).not.toBe("");
    }
  });
});

describe("gtmLeadIdOf is the sales_leads.id, and it agrees with the filter", () => {
  it("returns the promoted id, trimmed", () => {
    expect(gtmLeadIdOf(sweptLead({ gtmLeadId: "gtm-1" }))).toBe("gtm-1");
    expect(gtmLeadIdOf(sweptLead({ gtmLeadId: "  gtm-1  " }))).toBe("gtm-1");
  });

  it("returns the empty string for an absent, null or blank id alike", () => {
    // The same three shapes the filter refuses, and the reason the two agree: one
    // `.trim()` and one truthiness rule, read off the same field.
    expect(gtmLeadIdOf(sweptLead())).toBe("");
    expect(gtmLeadIdOf(sweptLead({ gtmLeadId: null }))).toBe("");
    expect(gtmLeadIdOf(sweptLead({ gtmLeadId: "" }))).toBe("");
    expect(gtmLeadIdOf(sweptLead({ gtmLeadId: "   " }))).toBe("");
  });

  it("is never Eva's document id", () => {
    // Eva mints `lead_<hex>` document ids and every GTM route keys on `sales_leads.id`.
    // Passing `lead.id` was a real bug on three call sites and this is the distinction
    // that closes it (property 6).
    const lead = sweptLead({ id: "lead_abc123", gtmLeadId: "gtm-abc" });

    expect(gtmLeadIdOf(lead)).toBe("gtm-abc");
    expect(gtmLeadIdOf(lead)).not.toBe(lead.id);
  });

  it("is non-empty for exactly the leads the filter accepts", () => {
    const shapes: (string | null | undefined)[] = [
      undefined,
      null,
      "",
      "   ",
      "gtm-1",
      "  gtm-1  ",
    ];

    for (const gtmLeadId of shapes) {
      const lead = sweptLead({ gtmLeadId });
      expect(gtmLeadIdOf(lead) !== "").toBe(isEnrichedProspect(lead));
    }
  });
});

describe("the dossier's gtmLeadIdOf call sites", () => {
  it("joins the one action-queue read by the GTM id", () => {
    // `overlayFor(gtmLeadIdOf(p), queue, queueFailed)`, the page-wide join. The queue's
    // `leadId` is a `sales_leads.id`, so a `lead_<hex>` matches nothing in the map — and
    // a miss is indistinguishable from a prospect with no live recommendation, which is
    // why this was silent before.
    const lead = sweptLead({ id: "lead_abc123", gtmLeadId: "gtm-abc" });
    const overlay = overlayOf([queueRow("gtm-abc")]);

    const joined = overlayFor(gtmLeadIdOf(lead), overlay, false);
    expect(joined.kind).toBe("row");
    expect(joined.kind === "row" && joined.item.leadId).toBe("gtm-abc");

    // The bug, stated: Eva's id against the same overlay reads as an absence.
    expect(overlayFor(lead.id, overlay, false).kind).toBe("none");
  });

  it("resolves the ?lead_id= deep link by the GTM id", () => {
    // Enrich Now happens on Market Intelligence and names the prospect it just promoted,
    // by `sales_leads.id`. The dossier finds it with `gtmLeadIdOf`, so the handoff lands
    // on that prospect rather than on whatever sorted first.
    const prospects = dossierProspects([
      sweptLead({ id: "lead_aaa", gtmLeadId: "gtm-a" }),
      sweptLead({ id: "lead_bbb", gtmLeadId: "gtm-b" }),
    ]);

    const requested = "gtm-b";
    expect(prospects.find((l) => gtmLeadIdOf(l) === requested)?.id).toBe("lead_bbb");
    // An Eva id in the query string selects nothing, which is the honest outcome: the
    // effect returns and the operator keeps whatever the list selected.
    expect(prospects.find((l) => gtmLeadIdOf(l) === "lead_bbb")).toBeUndefined();
  });

  it("gates Contact Directly on the same id, unreachably for a listed prospect", () => {
    // `contactGateOf`'s first gate is `!gtmLeadIdOf(lead)` → `needsEnrichment`. It is
    // stated on the function rather than assumed off the filter, so both halves are worth
    // one assertion each: the gate fires for an unpromoted lead, and no lead the dossier
    // lists can reach it. `detail` is null — the id check comes first and a missing
    // prospect read must not manufacture a gate.
    expect(contactGateOf(sweptLead(), null)).toBe(CONTACT_DIRECTLY_LABELS.needsEnrichment);

    for (const lead of dossierProspects([sweptLead({ gtmLeadId: "gtm-a" })])) {
      expect(contactGateOf(lead, null)).not.toBe(CONTACT_DIRECTLY_LABELS.needsEnrichment);
    }
  });
});
