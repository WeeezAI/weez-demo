// components/setup/WorkspaceSetupChecklist.tsx
//
// The three steps between creating a workspace and Weez working, stated on screen.
//
// ── What was wrong ──
//
// The steps existed; nothing named them. A founder created a workspace, landed on
// connections, connected a website, and then had no idea what they had just finished or
// what came next — so they guessed, opened Nina because it said "start your day here",
// and found four empty blocks and a `0`. The one control that starts anything was a small
// outlined "Set your GTM goal" at the bottom of that page, inside a collapsed section.
//
// So this component's whole job is to be the answer to "where do I start". It states all
// three steps at once, which is deliberate: a wizard that reveals one step at a time hides
// how much is left, and the reason a founder cannot orient themselves here is that they
// cannot see the shape of the thing. Three lines, one of them live, and the live one
// carries the control that advances it.
//
// ── Two renderings of one list ──
//
// `variant="panel"` is the full read, used where the surface is about starting up — Nina's
// first-run hero. `variant="rail"` is the same list compressed to a strip, used where
// setup is context rather than content — the connections page, where the real work of the
// page is the connectors below it.
//
// ── Accessibility ──
//
// An ordered list, because the steps are ordered and that ordering is information rather
// than styling. Each step's state is in text (`Done` / `Now` / `Next`) as well as in
// colour, so it survives without colour, and the live step carries `aria-current="step"`.
// The heading level is a prop, because this block appears under different headings on
// different pages and hard-coding `h2` would break the outline on one of them.

import { ArrowRight, Check, Loader2, type LucideIcon } from "lucide-react";
import { Globe, Rocket, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SETUP_STEP_ORDER, type SetupStepId } from "@/hooks/useWorkspaceSetup";

/**
 * Every word this block says, in one table.
 *
 * Here rather than inline for the reason `NINA_GTM_LABELS` exists: the same sentences are
 * rendered by two variants on three surfaces, and three copies of a sentence drift. The
 * copy is written in the product's own voice — an outcome and a reason per step, never a
 * feature name — and each step says what Weez does with the step once it is done, so a
 * founder can tell why they are being asked for it.
 */
export const WORKSPACE_SETUP_LABELS = {
  eyebrow: "Getting started",
  title: "Start your first campaign",
  intro:
    "Three steps, then Weez goes to work: Eva finds the accounts worth your time, Max prepares the outreach, and Nina tells you who to contact each morning and why.",

  /** The rail's one-liner, where there is no room for the intro. */
  railTitle: "Setting up your workspace",

  listLabel: "Steps to start your first campaign",

  stateDone: "Done",
  stateNow: "Now",
  stateNext: "Next",
  /** Announced beside the state word, for a reader that gets no colour. */
  doneNote: "This step is complete.",

  website: {
    title: "Connect your website",
    body: "This is where your ICP comes from. Nina reads your product, your customers and your positioning off it, and Eva targets accounts that match.",
    action: "Connect your website",
  },
  goal: {
    title: "Tell Nina what you want",
    body: "Pick a goal, answer two or three questions, and Nina lays out the strategy she would run — the accounts to go after, the angle, and what to expect.",
    action: "Set your GTM goal",
  },
  launch: {
    title: "Launch the workforce",
    body: "Approve Nina's strategy and it starts: Eva discovers accounts, Max prepares personalised outreach, and your first prospects appear in Market Intelligence.",
    action: "Review and launch",
  },

  /** Shown while the three reads are still in flight. */
  reading: "Checking what your workspace still needs",

  /**
   * The rail's progress line. A function rather than a template so the numbers cannot be
   * assembled two different ways on two pages.
   */
  progress: (done: number, total: number) => `${done} of ${total} done`,
} as const;

/** One test hook per element a suite needs to address without matching prose. */
export const SETUP_TEST_IDS = {
  checklist: "workspace-setup-checklist",
  step: (id: SetupStepId) => `workspace-setup-step-${id}`,
} as const;

interface StepCopy {
  title: string;
  body: string;
  action: string;
  icon: LucideIcon;
}

const STEP_COPY: Record<SetupStepId, StepCopy> = {
  website: { ...WORKSPACE_SETUP_LABELS.website, icon: Globe },
  goal: { ...WORKSPACE_SETUP_LABELS.goal, icon: Target },
  launch: { ...WORKSPACE_SETUP_LABELS.launch, icon: Rocket },
};

export interface WorkspaceSetupChecklistProps {
  /** Which steps the server says are done. `null` for a step means unread. */
  completed: Partial<Record<SetupStepId, boolean | null>>;
  /** The live step. Nothing is live while the reads are in flight. */
  activeStep: SetupStepId | null;
  /** Runs the live step. Absent for a step this surface cannot advance. */
  onAdvance?: (step: SetupStepId) => void;
  /** True while the control for the live step is working. */
  busy?: boolean;
  variant?: "panel" | "rail";
  /** The heading level for the block's title, so the page outline stays correct. */
  headingLevel?: "h2" | "h3";
  className?: string;
}

export function WorkspaceSetupChecklist({
  completed,
  activeStep,
  onAdvance,
  busy = false,
  variant = "panel",
  headingLevel = "h2",
  className,
}: WorkspaceSetupChecklistProps) {
  const isRail = variant === "rail";
  const Heading = headingLevel;

  const doneCount = SETUP_STEP_ORDER.filter((step) => completed[step] === true).length;

  return (
    <section
      data-testid={SETUP_TEST_IDS.checklist}
      aria-label={WORKSPACE_SETUP_LABELS.listLabel}
      className={cn(
        "rounded-3xl border bg-white",
        isRail
          ? "border-indigo-100 p-5 shadow-sm"
          : "border-indigo-200/70 p-6 shadow-lg shadow-indigo-500/5 lg:p-8",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-indigo-600/70">
            {WORKSPACE_SETUP_LABELS.eyebrow}
          </p>
          <Heading
            className={cn(
              "mt-1.5 font-black tracking-tight text-gray-900",
              isRail ? "text-base" : "text-2xl leading-tight"
            )}
          >
            {isRail ? WORKSPACE_SETUP_LABELS.railTitle : WORKSPACE_SETUP_LABELS.title}
          </Heading>
          {!isRail && (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600">
              {WORKSPACE_SETUP_LABELS.intro}
            </p>
          )}
        </div>

        <span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest tabular-nums text-indigo-600">
          {WORKSPACE_SETUP_LABELS.progress(doneCount, SETUP_STEP_ORDER.length)}
        </span>
      </div>

      <ol className={cn("space-y-2", isRail ? "mt-4" : "mt-6 space-y-3")}>
        {SETUP_STEP_ORDER.map((step, index) => {
          const copy = STEP_COPY[step];
          const Icon = copy.icon;
          const isDone = completed[step] === true;
          const isActive = activeStep === step;
          // "Next" for anything neither done nor live — including a step whose own answer
          // is unread, because an unread step is still not something to act on.
          const state = isDone
            ? WORKSPACE_SETUP_LABELS.stateDone
            : isActive
              ? WORKSPACE_SETUP_LABELS.stateNow
              : WORKSPACE_SETUP_LABELS.stateNext;

          return (
            <li
              key={step}
              data-testid={SETUP_TEST_IDS.step(step)}
              data-step-state={isDone ? "done" : isActive ? "active" : "pending"}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "rounded-2xl border transition-colors",
                isRail ? "p-3" : "p-4",
                isActive
                  ? "border-indigo-300 bg-indigo-50/40"
                  : isDone
                    ? "border-emerald-200 bg-emerald-50/30"
                    : "border-gray-100 bg-white"
              )}
            >
              <div className="flex items-start gap-3">
                {/* State marker. The tick is decorative — the word beside it is what a
                    screen reader reads, so the state never depends on an icon. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-xl",
                    isRail ? "h-8 w-8" : "h-9 w-9",
                    isDone
                      ? "bg-emerald-100 text-emerald-600"
                      : isActive
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-400"
                  )}
                >
                  {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span
                      aria-hidden="true"
                      className="text-[10px] font-black tabular-nums text-gray-400"
                    >
                      {index + 1}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-bold tracking-tight",
                        isDone ? "text-gray-500" : "text-gray-900"
                      )}
                    >
                      {copy.title}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest",
                        isDone
                          ? "bg-emerald-100 text-emerald-700"
                          : isActive
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-gray-100 text-gray-500"
                      )}
                    >
                      {state}
                      {isDone && (
                        <span className="sr-only"> {WORKSPACE_SETUP_LABELS.doneNote}</span>
                      )}
                    </span>
                  </div>

                  {/* The reason for the step, shown where it is actionable. A done step
                      does not need persuading and a rail has no room for three of these. */}
                  {isActive && !isRail && (
                    <p className="mt-1.5 text-[13px] leading-relaxed text-gray-600">{copy.body}</p>
                  )}

                  {isActive && onAdvance && (
                    <Button
                      type="button"
                      onClick={() => onAdvance(step)}
                      disabled={busy}
                      className={cn(
                        "mt-3 gap-2 rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-500",
                        isRail ? "h-9 px-4 text-xs" : "h-11 px-5 text-sm"
                      )}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                      {copy.action}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default WorkspaceSetupChecklist;
