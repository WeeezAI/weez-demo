//
// Which leads belong on Prospect Intelligence.
//
// The rule is one predicate — `evaAPI.isEnrichedProspect` — and it is worth its own test
// file because the obvious implementations are all wrong in the same direction: they let
// leads onto the page that have no `sales_leads` row, where the dossier is empty and every
// GTM control 404s.
//
// The three tempting markers and why each fails:
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
// The tests below are mostly *negative*, because the failure mode is inclusion.

import { describe, expect, it } from "vitest";

import { isEnrichedProspect, type QualifiedLead } from "@/services/evaAPI";

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
