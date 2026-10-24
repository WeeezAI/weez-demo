import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EMAIL_RE, submitAccessRequest, type AccessIntent } from "@/services/earlyAccessAPI";
import { FORM_EMAIL } from "./contact";

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
  "h-10 rounded-[8px] border-dx-line-strong bg-dx-raised text-[15px] text-dx-ink placeholder:text-dx-ink-muted focus-visible:ring-2 focus-visible:ring-dx-focus focus-visible:ring-offset-2";

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
      // A network or CORS failure (server down) surfaces as a bare "Failed to fetch"; never show that.
      // Keep the server's own validation message when it sent one, and always offer the direct email.
      const serverMsg = err instanceof Error && !(err instanceof TypeError) ? err.message : "";
      setFailure(`${serverMsg || "We couldn't send your request just now."} You can also email ${FORM_EMAIL}.`);
    } finally {
      setSubmitting(false);
    }
  };

  const field = (key: Field, label: string, props: React.InputHTMLAttributes<HTMLInputElement>, optional = false) => (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={`access-${key}`} className="text-[13px] font-medium text-dx-ink">
          {label}
          {optional && <span className="ml-1.5 font-normal text-dx-ink-muted">optional</span>}
        </Label>
        {errors[key] && (
          <span id={`access-${key}-error`} className="text-[12px] text-dx-danger">
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
        className={`${fieldClass} ${errors[key] ? "border-dx-danger" : ""}`}
        {...props}
      />
    </div>
  );

  return (
    <Dialog open={!!intent} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[480px] gap-0 overflow-y-auto rounded-[12px] border-dx-line bg-dx-raised p-0 font-dx-sans text-dx-ink shadow-dx-overlay [&>button]:text-dx-ink-muted [&>button]:data-[state=open]:bg-transparent [&>button:hover]:text-dx-ink">
        {submitted ? (
          <div className="px-8 py-16 text-center" role="status">
            <div className="mx-auto mb-8 flex h-10 w-10 items-center justify-center rounded-full bg-dx-success-soft">
              <Check className="h-5 w-5 text-dx-success" strokeWidth={1.5} aria-hidden="true" />
            </div>
            <DialogTitle className="text-2xl font-semibold tracking-[-0.025em]">Thanks. We'll be in touch.</DialogTitle>
            <DialogDescription className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-dx-ink-muted">
              Your request is with the team.
            </DialogDescription>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="mt-10 h-10 rounded-[8px] border border-dx-line-strong px-5 text-sm font-medium text-dx-ink transition hover:bg-dx-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dx-focus focus-visible:ring-offset-2"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <DialogHeader className="space-y-2 px-7 pt-8 text-left sm:px-8">
              <DialogTitle className="text-[22px] font-semibold tracking-[-0.025em]">{copy.title}</DialogTitle>
              <DialogDescription className="text-[15px] leading-relaxed text-dx-ink-muted">{copy.description}</DialogDescription>
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
                <Label htmlFor="access-note" className="text-[13px] font-medium text-dx-ink">
                  {copy.note}
                </Label>
                <Textarea
                  id="access-note"
                  value={form.note}
                  onChange={set("note")}
                  maxLength={1000}
                  rows={3}
                  placeholder={copy.notePlaceholder}
                  className="resize-none rounded-[8px] border-dx-line-strong bg-dx-raised text-[15px] text-dx-ink placeholder:text-dx-ink-muted focus-visible:ring-2 focus-visible:ring-dx-focus focus-visible:ring-offset-2"
                />
              </div>

              {failure && (
                <p role="alert" className="text-[13px] text-dx-danger">
                  {failure}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="group mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] bg-dx-brand text-[14px] font-medium text-white transition hover:bg-dx-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dx-focus focus-visible:ring-offset-2 disabled:opacity-60"
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

              <p className="pt-1 text-center text-[12px] text-dx-ink-muted">
                Prefer email?{" "}
                <a href={`mailto:${FORM_EMAIL}`} className="text-dx-ink-muted underline-offset-4 hover:text-dx-brand hover:underline">
                  {FORM_EMAIL}
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
