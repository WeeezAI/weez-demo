// components/BusinessContext.tsx
//
// Business Context onboarding — replaces the old Founder Context / founder-voice
// capture. This is the foundation for every GTM decision Nina, EVA and MAX make:
// it collects the company, its customers (ICP), its sales motion, and the GTM
// goals the founder wants the workforce to drive toward.
//
// No founder LinkedIn, writing style, voice, personal branding or social context
// is collected — the workforce reasons from the business, not the person.
//
// Persistence is best-effort to localStorage (keyed by space) so a re-open keeps
// the founder's answers; wiring to a backend context endpoint is a drop-in swap
// of `persist()`.

import { useState } from "react";
import {
  Building2,
  Users,
  Handshake,
  Target,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
  Globe,
  CalendarCheck,
  TrendingUp,
  Rocket,
  Map as MapIcon,
  MessageSquareReply,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Nina avatar (graceful fallback, matches the rest of the product) ──────────
const NINA_AVATAR = "/assets/nina.png";
function NinaFace({ className = "" }: { className?: string }) {
  const [ok, setOk] = useState(true);
  if (ok) return <img src={NINA_AVATAR} alt="Nina" onError={() => setOk(false)} className={`object-cover ${className}`} />;
  return (
    <div className={`bg-gradient-to-tr from-indigo-600 to-purple-500 text-white flex items-center justify-center font-black ${className}`}>
      N
    </div>
  );
}

// ── The shape Business Context collects ───────────────────────────────────────
export interface BusinessContextData {
  // Company
  companyWebsite: string;
  companyName: string;
  industry: string;
  productDescription: string;
  productCategories: string;
  // Customers
  icp: string;
  targetIndustries: string;
  companySize: string;
  employeeCount: string;
  revenueRange: string;
  fundingStage: string;
  targetGeography: string;
  // Sales
  acv: string;
  salesCycle: string;
  decisionMakers: string;
  buyingCommittee: string;
  existingCrm: string;
  // GTM Goals
  gtmGoals: string[];
}

const EMPTY: BusinessContextData = {
  companyWebsite: "",
  companyName: "",
  industry: "",
  productDescription: "",
  productCategories: "",
  icp: "",
  targetIndustries: "",
  companySize: "",
  employeeCount: "",
  revenueRange: "",
  fundingStage: "",
  targetGeography: "",
  acv: "",
  salesCycle: "",
  decisionMakers: "",
  buyingCommittee: "",
  existingCrm: "",
  gtmGoals: [],
};

const COMPANY_SIZE = ["SMB", "Mid-Market", "Enterprise"];
const EMPLOYEE_COUNT = ["1–10", "11–50", "51–200", "201–1,000", "1,000+"];
const REVENUE_RANGE = ["Pre-revenue", "<$1M", "$1M–$10M", "$10M–$50M", "$50M–$100M", "$100M+"];
const FUNDING_STAGE = ["Bootstrapped", "Pre-seed", "Seed", "Series A", "Series B", "Series C+", "Public"];
const SALES_CYCLE = ["< 1 month", "1–3 months", "3–6 months", "6–12 months", "12+ months"];
const CRM_OPTIONS = ["HubSpot", "Salesforce", "Pipedrive", "Close", "None yet", "Other"];

const GTM_GOALS: { id: string; label: string; desc: string; icon: any }[] = [
  { id: "book_meetings", label: "Book Meetings", desc: "Fill the calendar with qualified conversations", icon: CalendarCheck },
  { id: "generate_pipeline", label: "Generate Pipeline", desc: "Create sourced opportunities and pipeline value", icon: TrendingUp },
  { id: "enterprise_expansion", label: "Enterprise Expansion", desc: "Move upmarket into larger accounts", icon: Rocket },
  { id: "new_market_expansion", label: "New Market Expansion", desc: "Enter new segments or geographies", icon: MapIcon },
  { id: "improve_reply_rates", label: "Improve Reply Rates", desc: "Lift outreach reply and engagement rates", icon: MessageSquareReply },
];

type StepKey = "company" | "customers" | "sales" | "goals";
const STEPS: { key: StepKey; label: string; icon: any }[] = [
  { key: "company", label: "Company", icon: Building2 },
  { key: "customers", label: "Customers", icon: Users },
  { key: "sales", label: "Sales", icon: Handshake },
  { key: "goals", label: "GTM Goals", icon: Target },
];

const ctxKey = (spaceId: string) => `weez_business_context_${spaceId}`;

function loadSaved(spaceId: string): BusinessContextData {
  try {
    const raw = localStorage.getItem(ctxKey(spaceId));
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return EMPTY;
}

// ── Reusable field primitives ─────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-zinc-800">{label}</label>
      {hint && <p className="text-xs text-zinc-400 -mt-1">{hint}</p>}
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none transition-all";

function TextInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
}

function TextArea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <textarea value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} rows={3} className={`${inputCls} resize-none`} />;
}

function Choice({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(active ? "" : opt)}
            className={cn(
              "px-3.5 py-2 rounded-xl border text-sm font-medium transition-all",
              active ? "border-indigo-500 bg-indigo-50 text-indigo-900" : "border-zinc-200 bg-white text-zinc-700 hover:border-indigo-200"
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {active && <Check className="w-3.5 h-3.5 text-indigo-600" />}
              {opt}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  spaceId: string;
  onComplete: (context: BusinessContextData) => void;
  onSkip?: () => void;
}

export default function BusinessContext({ spaceId, onComplete, onSkip }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [data, setData] = useState<BusinessContextData>(() => loadSaved(spaceId));
  const [saving, setSaving] = useState(false);

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;
  const set = <K extends keyof BusinessContextData>(k: K, v: BusinessContextData[K]) => setData((d) => ({ ...d, [k]: v }));

  const toggleGoal = (id: string) =>
    setData((d) => ({
      ...d,
      gtmGoals: d.gtmGoals.includes(id) ? d.gtmGoals.filter((g) => g !== id) : [...d.gtmGoals, id],
    }));

  const persist = (final: BusinessContextData) => {
    try {
      localStorage.setItem(ctxKey(spaceId), JSON.stringify(final));
    } catch {
      /* non-blocking */
    }
  };

  const next = () => {
    persist(data);
    if (isLast) {
      setSaving(true);
      persist(data);
      onComplete(data);
      return;
    }
    setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  };
  const back = () => setStepIdx((i) => Math.max(i - 1, 0));

  // Light gating — enough to keep the context useful, never a hard block.
  const canProceed =
    step.key === "company"
      ? data.companyName.trim().length > 0 || data.companyWebsite.trim().length > 0
      : step.key === "goals"
        ? data.gtmGoals.length > 0
        : true;

  return (
    <div className="w-full max-w-2xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Nina intro */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl overflow-hidden ring-2 ring-indigo-200 shrink-0">
          <NinaFace className="w-full h-full" />
        </div>
        <div className="bg-zinc-50 border border-zinc-100 rounded-2xl rounded-tl-sm px-4 py-3">
          <p className="text-sm font-semibold text-zinc-900">Let's build your Business Context.</p>
          <p className="text-sm text-zinc-500 leading-relaxed">
            This is the foundation for every decision EVA and MAX make — your company, your customers, your sales motion, and the GTM goals you want us driving toward.
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === stepIdx;
          const done = i < stepIdx;
          return (
            <div key={s.key} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0",
                    active ? "bg-indigo-600 text-white" : done ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-400"
                  )}
                >
                  {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={cn("text-xs font-bold hidden sm:block", active ? "text-zinc-900" : "text-zinc-400")}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={cn("h-px flex-1", done ? "bg-emerald-400" : "bg-zinc-200")} />}
            </div>
          );
        })}
      </div>

      {/* Step body */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 space-y-5">
        {step.key === "company" && (
          <>
            <Field label="Company Website">
              <TextInput type="url" value={data.companyWebsite} onChange={(v) => set("companyWebsite", v)} placeholder="https://yourcompany.com" />
            </Field>
            <Field label="Company Name">
              <TextInput value={data.companyName} onChange={(v) => set("companyName", v)} placeholder="Acme Inc." />
            </Field>
            <Field label="Industry">
              <TextInput value={data.industry} onChange={(v) => set("industry", v)} placeholder="B2B SaaS, FinTech, DevTools…" />
            </Field>
            <Field label="Product Description">
              <TextArea value={data.productDescription} onChange={(v) => set("productDescription", v)} placeholder="What you sell and the outcome it drives for customers." />
            </Field>
            <Field label="Product Categories" hint="Comma-separated">
              <TextInput value={data.productCategories} onChange={(v) => set("productCategories", v)} placeholder="Analytics, Automation, Security" />
            </Field>
          </>
        )}

        {step.key === "customers" && (
          <>
            <Field label="Ideal Customer Profile (ICP)">
              <TextArea value={data.icp} onChange={(v) => set("icp", v)} placeholder="Describe the companies that get the most value from your product." />
            </Field>
            <Field label="Target Industries" hint="Comma-separated">
              <TextInput value={data.targetIndustries} onChange={(v) => set("targetIndustries", v)} placeholder="SaaS, FinTech, Healthcare" />
            </Field>
            <Field label="Company Size">
              <Choice value={data.companySize} onChange={(v) => set("companySize", v)} options={COMPANY_SIZE} />
            </Field>
            <Field label="Employee Count">
              <Choice value={data.employeeCount} onChange={(v) => set("employeeCount", v)} options={EMPLOYEE_COUNT} />
            </Field>
            <Field label="Revenue Range">
              <Choice value={data.revenueRange} onChange={(v) => set("revenueRange", v)} options={REVENUE_RANGE} />
            </Field>
            <Field label="Funding Stage">
              <Choice value={data.fundingStage} onChange={(v) => set("fundingStage", v)} options={FUNDING_STAGE} />
            </Field>
            <Field label="Target Geography">
              <TextInput value={data.targetGeography} onChange={(v) => set("targetGeography", v)} placeholder="North America, EMEA, Global…" />
            </Field>
          </>
        )}

        {step.key === "sales" && (
          <>
            <Field label="Average Contract Value (ACV)">
              <TextInput value={data.acv} onChange={(v) => set("acv", v)} placeholder="$25,000 / year" />
            </Field>
            <Field label="Sales Cycle">
              <Choice value={data.salesCycle} onChange={(v) => set("salesCycle", v)} options={SALES_CYCLE} />
            </Field>
            <Field label="Decision Makers" hint="The roles you sell to — comma-separated">
              <TextInput value={data.decisionMakers} onChange={(v) => set("decisionMakers", v)} placeholder="VP Sales, CRO, Head of Growth" />
            </Field>
            <Field label="Buying Committee" hint="Who else is involved in the decision">
              <TextInput value={data.buyingCommittee} onChange={(v) => set("buyingCommittee", v)} placeholder="Finance, IT, Legal, End users" />
            </Field>
            <Field label="Existing CRM">
              <Choice value={data.existingCrm} onChange={(v) => set("existingCrm", v)} options={CRM_OPTIONS} />
            </Field>
          </>
        )}

        {step.key === "goals" && (
          <Field label="What should your GTM workforce drive toward?" hint="Pick everything that applies">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {GTM_GOALS.map((g) => {
                const Icon = g.icon;
                const active = data.gtmGoals.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGoal(g.id)}
                    className={cn(
                      "text-left p-4 rounded-2xl border transition-all active:scale-[0.98]",
                      active ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-zinc-200 bg-white hover:border-indigo-200"
                    )}
                  >
                    <div className="flex items-center gap-2.5 mb-1">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", active ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600")}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <span className="font-bold text-zinc-900">{g.label}</span>
                      {active && <Check className="w-4 h-4 text-indigo-600 ml-auto" />}
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">{g.desc}</p>
                  </button>
                );
              })}
            </div>
          </Field>
        )}
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between mt-6">
        <div className="flex items-center gap-3">
          {stepIdx > 0 ? (
            <button onClick={back} className="flex items-center gap-1.5 text-sm font-semibold text-zinc-400 hover:text-zinc-700 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : onSkip ? (
            <button onClick={onSkip} className="text-sm font-semibold text-zinc-400 hover:text-zinc-700 transition-colors">
              Skip for now
            </button>
          ) : (
            <span />
          )}
        </div>

        <Button
          onClick={next}
          disabled={!canProceed || saving}
          className="h-12 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2 disabled:opacity-50"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving context…</>
          ) : isLast ? (
            <><Sparkles className="w-4 h-4" /> Save Business Context</>
          ) : (
            <>Continue <ArrowRight className="w-4 h-4" /></>
          )}
        </Button>
      </div>

      <p className="mt-4 text-center text-[11px] text-zinc-400 inline-flex items-center gap-1.5 w-full justify-center">
        <Globe className="w-3 h-3" /> Business Context grounds every account EVA scores and every message MAX sends.
      </p>
    </div>
  );
}
