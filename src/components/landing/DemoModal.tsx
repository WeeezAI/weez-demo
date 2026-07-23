import { useState } from "react";
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import CONFIG from "@/services/config";

interface DemoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const emptyForm = {
  name: "",
  position: "",
  company: "",
  businessEmail: "",
  phone: "",
};

const DemoModal = ({ open, onOpenChange }: DemoModalProps) => {
  const [form, setForm] = useState({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const reset = () => {
    setForm({ ...emptyForm });
    setSubmitting(false);
    setSubmitted(false);
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      // Reset shortly after close so the success state doesn't flash on reopen.
      setTimeout(reset, 250);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.company.trim() || !form.businessEmail.trim()) {
      toast.error("Please fill in your name, company and business email.");
      return;
    }
    if (!EMAIL_RE.test(form.businessEmail.trim())) {
      toast.error("Please enter a valid business email.");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch(`${CONFIG.WEEZ_BASE_URL}/demo/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || "Something went wrong. Please try again.");
      }
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err?.message || "Couldn't submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md rounded-3xl border-slate-200 p-0 overflow-hidden">
        {submitted ? (
          <div className="flex flex-col items-center px-8 py-12 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
              Request received
            </h3>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
              Thanks for your interest in Weez. Our team will contact you soon to schedule your demo.
            </p>
            <Button
              onClick={() => handleOpenChange(false)}
              className="mt-7 h-11 rounded-full bg-slate-900 px-8 text-sm font-semibold text-white hover:bg-black"
            >
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="px-8 pt-8 text-left">
              <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-900">
                Book a demo
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                Tell us a bit about you and our team will reach out to set up your demo.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 px-8 pb-8 pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="demo-name" className="text-xs font-semibold text-slate-700">
                    Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="demo-name"
                    value={form.name}
                    onChange={set("name")}
                    placeholder="Jane Doe"
                    autoComplete="name"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="demo-position" className="text-xs font-semibold text-slate-700">
                    Position
                  </Label>
                  <Input
                    id="demo-position"
                    value={form.position}
                    onChange={set("position")}
                    placeholder="Founder / Head of Growth"
                    autoComplete="organization-title"
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="demo-company" className="text-xs font-semibold text-slate-700">
                  Company <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="demo-company"
                  value={form.company}
                  onChange={set("company")}
                  placeholder="Acme Inc."
                  autoComplete="organization"
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="demo-email" className="text-xs font-semibold text-slate-700">
                  Business email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="demo-email"
                  type="email"
                  value={form.businessEmail}
                  onChange={set("businessEmail")}
                  placeholder="jane@acme.com"
                  autoComplete="email"
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="demo-phone" className="text-xs font-semibold text-slate-700">
                  Phone number
                </Label>
                <Input
                  id="demo-phone"
                  type="tel"
                  value={form.phone}
                  onChange={set("phone")}
                  placeholder="+1 555 000 1234"
                  autoComplete="tel"
                  className="h-11 rounded-xl"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-70"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Request demo <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DemoModal;
