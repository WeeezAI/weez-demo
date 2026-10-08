import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EMAIL_RE, submitAccessRequest, type AccessIntent } from "@/services/earlyAccessAPI";
import { CONTACT_EMAIL } from "./contact";

interface Props {
  intent: AccessIntent | null;
  onOpenChange: (open: boolean) => void;
}

const COPY: Record<AccessIntent, { title: string; description: string; note: string; notePlaceholder: string; submit: string }> = {
  "early-access": {
    title: "Request early access",
    description: "We're working with a small group of revenue teams. Tell us a little about yours.",
    note: "What are you hoping to solve?",
    notePlaceholder: "Optional",
    submit: "Request access",
  },
  "founder-conversation": {
    title: "Talk to the founder",
    description: "Share a little context and we'll set up a conversation.",
    note: "What would you like to talk about?",
    notePlaceholder: "Optional",
    submit: "Request a conversation",
  },
};

const empty = { name: "", email: "", company: "", role: "", linkedin: "", note: "" };
type Field = keyof typeof empty;

const fieldClass =
  "h-11 rounded-lg border-white/10 bg-white/[0.03] text-[15px] text-white placeholder:text-white/25 focus-visible:border-white/25 focus-visible:ring-1 focus-visible:ring-white/15 focus-visible:ring-offset-0";

const AccessRequestModal = ({ intent, onOpenChange }: Props) => {
  const [form, setForm] = useState({ ...empty });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Keep the last intent through the close animation so the copy doesn't swap mid-fade.
  const [shownIntent, setShownIntent] = useState<AccessIntent>("early-access");
  if (intent && intent !== shownIntent) setShownIntent(intent);
  const copy = COPY[shownIntent];

  const set = (key: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setTimeout(() => {
        setForm({ ...empty });
        setErrors({});
        setSubmitted(false);
        setFailure(null);
      }, 250);
    }
  };

  const validate = () => {
    const er: Partial<Record<Field, string>> = {};
    if (!form.name.trim()) er.name = "Required";
    if (!form.email.trim()) er.email = "Required";
    else if (!EMAIL_RE.test(form.email.trim())) er.email = "Enter a valid work email";
    if (!form.company.trim()) er.company = "Required";
    if (!form.role.trim()) er.role = "Required";
    if (form.linkedin.trim() && !/linkedin\.com\//i.test(form.linkedin)) er.linkedin = "Enter a LinkedIn profile URL";
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFailure(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await submitAccessRequest({
        intent: shownIntent,
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        role: form.role.trim(),
        linkedin: form.linkedin.trim() || undefined,
        note: form.note.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Couldn't send your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const field = (key: Field, label: string, props: React.InputHTMLAttributes<HTMLInputElement>, optional = false) => (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={`access-${key}`} className="text-[13px] font-normal text-white/60">
          {label}
          {optional && <span className="ml-1.5 text-white/30">optional</span>}
        </Label>
        {errors[key] && (
          <span id={`access-${key}-error`} className="text-[12px] text-rose-300/80">
            {errors[key]}
          </span>
        )}
      </div>
      <Input
        id={`access-${key}`}
        value={form[key]}
        onChange={set(key)}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `access-${key}-error` : undefined}
        className={`${fieldClass} ${errors[key] ? "border-rose-300/40" : ""}`}
        {...props}
      />
    </div>
  );

  return (
    <Dialog open={!!intent} onOpenChange={handleOpenChange}>
      <DialogContent className="dark max-h-[92vh] max-w-[480px] gap-0 overflow-y-auto rounded-2xl border-white/10 bg-[#0c0d12] p-0 font-geist text-white shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] [&>button]:text-white/50 [&>button]:data-[state=open]:bg-transparent [&>button:hover]:text-white">
        {submitted ? (
          <div className="px-8 py-16 text-center" role="status">
            <div className="mx-auto mb-8 flex h-10 w-10 items-center justify-center rounded-full border border-white/15">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-200 shadow-[0_0_12px_2px_rgba(165,180,252,0.6)]" />
            </div>
            <DialogTitle className="text-2xl font-normal tracking-[-0.02em]">Thanks. We'll be in touch.</DialogTitle>
            <DialogDescription className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-white/45">
              Your request is with the team.
            </DialogDescription>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="mt-10 h-10 rounded-full border border-white/15 px-6 text-sm text-white/80 transition hover:border-white/30 hover:text-white"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <DialogHeader className="space-y-2 px-7 pt-8 text-left sm:px-8">
              <DialogTitle className="text-[22px] font-normal tracking-[-0.02em]">{copy.title}</DialogTitle>
              <DialogDescription className="text-[15px] leading-relaxed text-white/45">{copy.description}</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} noValidate className="space-y-4 px-7 pb-8 pt-7 sm:px-8">
              <div className="grid gap-4 sm:grid-cols-2">
                {field("name", "Name", { autoComplete: "name" })}
                {field("company", "Company", { autoComplete: "organization" })}
              </div>
              {field("email", "Work email", { type: "email", autoComplete: "email", inputMode: "email" })}
              {field("role", "Role", { autoComplete: "organization-title", placeholder: "e.g. VP Revenue Operations" })}
              {field("linkedin", "LinkedIn", { type: "url", inputMode: "url", placeholder: "linkedin.com/in/…" }, true)}

              <div className="space-y-1.5">
                <Label htmlFor="access-note" className="text-[13px] font-normal text-white/60">
                  {copy.note}
                </Label>
                <Textarea
                  id="access-note"
                  value={form.note}
                  onChange={set("note")}
                  maxLength={1000}
                  rows={3}
                  placeholder={copy.notePlaceholder}
                  className="resize-none rounded-lg border-white/10 bg-white/[0.03] text-[15px] text-white placeholder:text-white/25 focus-visible:border-white/25 focus-visible:ring-1 focus-visible:ring-white/15 focus-visible:ring-offset-0"
                />
              </div>

              {failure && (
                <p role="alert" className="text-[13px] text-rose-300/85">
                  {failure}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="group mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-[14px] font-medium text-[#08090c] transition hover:bg-white/90 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-label="Sending" />
                ) : (
                  <>
                    {copy.submit}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </>
                )}
              </button>

              <p className="pt-1 text-center text-[12px] text-white/30">
                Prefer email?{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-white/55 underline-offset-4 hover:text-white hover:underline">
                  {CONTACT_EMAIL}
                </a>
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AccessRequestModal;
