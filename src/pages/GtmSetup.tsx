// pages/GtmSetup.tsx
//
// Campaign creation. The one place a campaign is created, and the first thing a new
// workspace opens.
//
// ── Why this is its own destination ──
//
// Creating a workspace used to land the founder on Settings. That is the right *first
// question* — nothing works until Nina can read the website — but it is the wrong frame:
// Settings is a page about integrations, so a founder who connected their website had
// finished a settings task and had no idea they had just finished step one of creating a
// campaign. They then guessed their way to Nina, found four empty attention blocks, and the
// workflow that would have started everything was a collapsed section at the bottom of it.
//
// So the workflow is a place now, and space creation goes straight here. The website is
// asked for *inside* the workflow, as its first phase, rather than on a different page the
// founder has to be sent back from — `NinaGoalIntake` already had that phase and already
// gated the goal picker on it, so the fix was to stop routing around it.
//
// ── What this page is and is not ──
//
// It is a frame: the shell, the progress rail, and the workflow. Every decision — is the
// website connected, which goals exist, what to ask, what strategy to propose, and the
// launch itself — belongs to `NinaGoalIntake`, which owns its own phases and reads its own
// readiness. This page passes no `onProceed`, so the launch is the component's default
// hand-off: activate the workforce, then Market Intelligence.
//
// It is not the only way to change a goal. Nina keeps the same workflow behind a disclosure
// for a founder who wants to re-aim a running workspace; this page is where the *first* one
// is created and where every "start here" control on every other surface points.

import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Rocket } from "lucide-react";

import ConversationSidebar from "@/components/ConversationSidebar";
import NinaGoalIntake from "@/components/NinaGoalIntake";
import { Button } from "@/components/ui/button";
import { CreditBalanceBadge } from "@/components/gtm/CreditBalance";
import { WorkspaceSetupChecklist } from "@/components/setup/WorkspaceSetupChecklist";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useWorkspaceSetup } from "@/hooks/useWorkspaceSetup";

/** Every word this page owns, in one table. */
export const GTM_SETUP_LABELS = {
  eyebrow: "Campaign setup",
  title: "Create your campaign",

  /** Shown when the workspace already has a live campaign. */
  liveTitle: "This workspace already has a live campaign",
  liveBody:
    "Eva is discovering accounts and Max is preparing outreach. You can set a new goal below — Nina will re-aim the workforce — or go to your day.",
  liveAction: "Go to Nina",
} as const;

export default function GtmSetup() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const { currentSpace, spaces } = useAuth();

  // The balance, in chrome, from the provider above the routes. Rendered unconditionally:
  // the badge is what decides an unread balance shows nothing, and a `balance && …` guard
  // here would hide a genuine 0 (R17.7).
  const { balance } = useCredits();

  const { websiteConnected, goalSet, launched, nextStep } = useWorkspaceSetup();

  const spaceName =
    currentSpace?.name || spaces.find((s) => s.id === spaceId)?.name || "your workspace";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#FAFAFB] font-inter">
      <ConversationSidebar
        spaceId={spaceId!}
        onNewChat={() => navigate("/spaces")}
        onSelectConversation={() => {}}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-zinc-200/70 bg-white/80 px-6 backdrop-blur-xl lg:px-10">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 shadow-sm">
            <Rocket className="h-4 w-4 text-white" />
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              {GTM_SETUP_LABELS.eyebrow}
            </span>
            {/* A real `h1`. This is the page's top-level heading, so the progress block
                below can take `h2` and the outline reads correctly for a screen reader. */}
            <h1 className="truncate text-sm font-semibold text-zinc-900">
              {GTM_SETUP_LABELS.title} · {spaceName}
            </h1>
          </div>

          <CreditBalanceBadge balance={balance} className="ml-auto hidden sm:inline-flex" />
        </header>

        {/* The scroll container. The workflow's launch bar is `sticky bottom-0`, which is
            measured against this element — so the control that starts the campaign stays on
            screen however long the proposed strategy runs. */}
        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10">
          {/* `max-w-3xl` to match the widest phase the workflow renders — its goal picker is
              a two-column grid at that width, and a narrower column would squeeze it. */}
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Progress only. No control: the step being described is the thing directly
                below it, so a call to action here would point at itself. */}
            <WorkspaceSetupChecklist
              variant="rail"
              headingLevel="h2"
              completed={{ website: websiteConnected, goal: goalSet, launch: launched }}
              activeStep={nextStep ?? (websiteConnected === true ? "goal" : "website")}
            />

            {/* A founder who arrives here with a campaign already running is not lost — they
                came to re-aim it. Say what is already true, offer the way out, and leave the
                workflow below usable rather than blocking it. */}
            {launched === true && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-zinc-900">
                      {GTM_SETUP_LABELS.liveTitle}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">
                      {GTM_SETUP_LABELS.liveBody}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 gap-1.5 rounded-xl"
                      onClick={() => navigate(`/ninna/${spaceId}`)}
                    >
                      {GTM_SETUP_LABELS.liveAction}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* The workflow. No `onProceed`: the launch is the component's own hand-off. */}
            <NinaGoalIntake spaceId={spaceId!} />
          </div>
        </main>
      </div>
    </div>
  );
}
