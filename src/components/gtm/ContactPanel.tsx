//
// How to reach this prospect — and why it is not in the identity panel.
//
// There are two different claims about the same person on this screen and they must stay
// apart:
//
//   `IdentityPanel` / `ProspectHeader`  what Weez **observed** on a LinkedIn page. Every
//                                       field is an `ObservedFact` and reads "Unknown"
//                                       until that page has actually been read.
//   this panel                          what Eva **asserted** during enrichment, read off
//                                       the lead row. Plain values, because that is what
//                                       they are.
//
// Merging them would make an assertion indistinguishable from an observation. A name that
// came from a provider's database and a name that came from reading somebody's profile are
// different kinds of fact with different failure modes, and the screen that cannot tell
// them apart is the screen that says "we observed this person is called X" when nobody
// looked.
//
// This is also the panel that exists *before* anything else does. `profileId` is null and
// every observed fact is Unknown until the operator pays to track the prospect — so
// without this block the decision surface at that moment would be empty, and the operator
// would be asked to choose between contacting somebody and paying to understand them while
// being shown nothing about them. The email and the LinkedIn url are the two contact facts
// nothing else on the payload carries.
//
// `null` renders as absence, not as a block of dashes: the server drops the key when it
// holds neither an email nor a LinkedIn url, and that is a real answer about a prospect
// nobody has enriched.

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Mail, Linkedin } from "lucide-react";
import type { LinkedInVerificationStatus, ProspectContact } from "@/services/gtmAPI";

export const CONTACT_PANEL_LABELS = {
  heading: "How to reach them",
  /**
   * Says where these came from, because that is the whole point of the panel being
   * separate. "Enrichment" is the operator's word for the Enrich Now they clicked.
   */
  provenance: "From enrichment",
  email: "Email",
  role: "Role",
  company: "Company",
  linkedin: "LinkedIn",
  /** No contact facts at all. Not an error — nobody has enriched this prospect. */
  empty: "No email or LinkedIn address on file. Run Enrich Now to resolve them.",
  /**
   * The LinkedIn url on the lead row is a *candidate* until identity resolution has
   * opened it and matched it. Saying so is load-bearing: acting on an unverified address
   * is how a whole history gets attached to a stranger.
   */
  candidate: "Unverified address",
  candidateNote:
    "This address came from a provider and has not been matched to this person yet.",
  verified: "Verified",
  copyEmail: "Copy email address",
} as const;

export interface ContactPanelProps {
  contact: ProspectContact | null;
  /**
   * The identity verdict from `ProspectProfile.linkedinVerificationStatus`, so the panel
   * can label its LinkedIn url honestly. `null` means nobody has tried — which is not
   * `NO_MATCH`, and is why the candidate warning shows for both.
   */
  verificationStatus?: LinkedInVerificationStatus | null;
  className?: string;
}

function ContactRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[11px] uppercase tracking-[0.08em] text-slate-500">
        {label}
      </dt>
      <dd className="min-w-0 text-right text-[13px] text-foreground">{children}</dd>
    </div>
  );
}

export function ContactPanel({
  contact,
  verificationStatus = null,
  className,
}: ContactPanelProps) {
  const verified = verificationStatus === "VERIFIED";

  return (
    <section
      className={cn("space-y-3 rounded-lg border border-border/40 p-4", className)}
      aria-labelledby="contact-panel-heading"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3
          id="contact-panel-heading"
          className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500"
        >
          {CONTACT_PANEL_LABELS.heading}
        </h3>
        {contact ? (
          <span className="text-[10px] text-slate-500">
            {CONTACT_PANEL_LABELS.provenance}
          </span>
        ) : null}
      </div>

      {!contact ? (
        <p className="text-[13px] text-slate-500">{CONTACT_PANEL_LABELS.empty}</p>
      ) : (
        <dl className="space-y-2">
          {contact.email ? (
            <ContactRow label={CONTACT_PANEL_LABELS.email}>
              <a
                href={`mailto:${contact.email}`}
                className="inline-flex items-center gap-1.5 break-all underline decoration-border/60 underline-offset-2 hover:decoration-foreground"
              >
                <Mail aria-hidden="true" className="h-3 w-3 shrink-0 text-slate-500" />
                {contact.email}
              </a>
            </ContactRow>
          ) : null}

          {contact.role ? (
            <ContactRow label={CONTACT_PANEL_LABELS.role}>{contact.role}</ContactRow>
          ) : null}

          {contact.company ? (
            <ContactRow label={CONTACT_PANEL_LABELS.company}>{contact.company}</ContactRow>
          ) : null}

          {contact.linkedinUrl ? (
            <ContactRow label={CONTACT_PANEL_LABELS.linkedin}>
              <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                <a
                  href={contact.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 break-all underline decoration-border/60 underline-offset-2 hover:decoration-foreground"
                >
                  <Linkedin
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 text-slate-500"
                  />
                  {contact.linkedinUrl.replace(/^https?:\/\/(www\.)?linkedin\.com/, "")}
                </a>
                {/* The label is text, never colour alone: whether an address has been
                    matched to this person is the difference between reaching them and
                    reaching a stranger. */}
                {verified ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-300 text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-700"
                  >
                    {CONTACT_PANEL_LABELS.verified}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-amber-300 text-[9px] font-bold uppercase tracking-[0.1em] text-amber-700"
                    title={CONTACT_PANEL_LABELS.candidateNote}
                  >
                    {CONTACT_PANEL_LABELS.candidate}
                  </Badge>
                )}
              </span>
            </ContactRow>
          ) : null}
        </dl>
      )}

      {contact?.linkedinUrl && !verified ? (
        <p className="text-[11px] text-slate-500">{CONTACT_PANEL_LABELS.candidateNote}</p>
      ) : null}
    </section>
  );
}
