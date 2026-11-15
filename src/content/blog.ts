/* Blog articles for the public site. Markdown bodies, rendered by src/pages/BlogPost.tsx.
   Voice: plain, short sentences, written for a Head of RevOps. No invented customer metrics.
   Any numbers inside the worked examples are illustrative and say so. */

export type Post = {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO
  readMinutes: number;
  tags: string[];
  body: string;
  /** Optional card shown after the intro, before the first H2. The body text is not touched. */
  callout?: { text: string; cta: string; href: string };
  /** Optional closing section after the body, before the related posts. */
  closing?: { title: string; body: string; cta: string; href: string; secondary?: { label: string; href: string } };
  /** Optional named byline. Posts without one are credited to Dexraflow. */
  author?: { name: string; role: string };
  /** Optional blocks the body places by name, with a fenced ~~~block holding the key. */
  blocks?: Record<string, Block>;
};

export type Block =
  | { kind: "callout"; text: string; cta: string; href: string }
  | { kind: "cards"; cards: { title: string; price?: string; body: string; cta: string; href: string }[] }
  | { kind: "diagram"; name: DiagramName };

/** Diagrams a post can place. Each is a component in src/components/blog/diagrams.tsx. */
export type DiagramName = "lead-path" | "three-numbers" | "five-checks" | "average-tail" | "metric-funnel" | "spam-timeline";

/** Minutes to read, from the word count of the markdown body at 220 words a minute. */
export const readMinutes = (body: string) => Math.max(1, Math.round(body.replace(/~~~block[\s\S]*?~~~/g, "").split(/\s+/).filter(Boolean).length / 220));

const BOOK_CALL = "https://calendar.app.google/Jm892hC4kmMXafec6";

const SEVEN_WAYS_BODY = `
Over the last five weeks we asked one question in six subreddits, three RevOps Slack communities and a dozen calls: **how did you find out the last time a lead workflow broke?**

About 40 people answered in detail. The most common answer, by a distance, was some version of "a rep told me." The second most common was "a prospect told me." Almost nobody said "an alert told me."

This is a write-up of the patterns, in the practitioners' own words where they agreed to be quoted. It is not a survey and the sample is not random. It is what operators volunteered when asked. Where we could, we reproduced the failure ourselves.

If you want the one-sentence version: **every tool in the lead path reports success for its own step, and no tool checks that the lead arrived.** That gap is [where leads go missing](/blog/what-is-lead-leakage), and it does not produce an error.

## Pattern 1: HubSpot files real demo requests as spam, and deletes them after 90 days

This one we reproduced in our own HubSpot account on 15 November, after two people described it independently.

![HubSpot form Spam tab showing one blocked submission, type Unregistered Site Domain, with a deletion date 90 days out.](/blog/hubspot-spam-tab.png)

**The mechanism.** Since May 2024, HubSpot has filtered form submissions that arrive from a domain not listed under *Settings → Tracking & Analytics → Tracking code → Advanced tracking → Additional site domains*. The usual trigger is a site or domain migration: the new domain never gets added to the list, and from that day submissions from it are flagged "Unregistered Site Domain."

**What the visitor sees.** Success. We submitted a test entry from an unlisted domain. The API returned HTTP 200. A real visitor would see the thank-you message.

**What the CRM sees.** Nothing. The Submissions tab stayed empty. No contact was created. No workflow ran, because there was no record to enrol. The entry appeared only in the form's Spam tab (still labelled Beta), with a note: *will be deleted after* a date 90 days out.

**Why nobody notices.**

- Real-time submission notifications are sent only for submissions *not* flagged as spam.
- A daily spam digest does exist (form settings → Submission settings → Spam monitoring), but its recipient list is empty by default. On a fresh form, nobody receives it.
- The "Spam submissions" column in the forms list lagged behind the actual count in our test.
- The spam queue cannot be exported the way submissions can. You have to open it.

**The clock.** Deletion runs from each submission's original date, not from when you find it. So the oldest lost leads expire first. If you released a new domain in September and no one checked, the first demo requests you lost are already gone by mid-December.

**If you think this happened to you:** open each form's Spam tab, filter the spam type to Unregistered Site Domain, sort by deletion date, and release the genuine ones closest to the cutoff first. Releasing keeps the original submission date and creates or updates the contact. Then add the domain to Additional site domains, add yourself to the spam digest, and check the queue weekly until new entries stop landing there.

*Sources: two r/hubspot practitioners (one has seen it at multiple companies after migrations), reproduced in portal 245632151 on 15 Nov 2026.*

~~~block
spam-tab
~~~

## Pattern 2: the chat assistant said "got your details" while the CRM write failed

A RevOps lead in a Slack community described the quietest failure they had seen: the call from their website's AI chat assistant into the CRM started failing overnight. The assistant kept telling visitors "got your details." No error anywhere, because from the assistant's side the conversation completed.

They caught it the next morning only because the newest CRM record was older than the newest conversation. The fix they made afterwards is worth copying: the assistant now waits for the CRM to confirm the write before it tells the visitor anything was saved.

This is the first agent-caused silent loss we have heard first-hand. Expect more of them as more things write to the CRM without a human in between.

## Pattern 3: the Zap "ran successfully" and enrolled nobody

Several people told versions of this. An integration returns success on every run, so the run history is green, but the step after it never happens: the sequence shows "active" and sends nothing, or the enrichment returns an empty payload that the next step accepts without complaint.

One operator's line: *"a green API monitor can coexist with disappearing leads."* Another: *"the sync itself works fine; the problem is what it's syncing."*

The pattern underneath: tools [say success](/blog/gtm-automation-failures) for their own step. None of them is responsible for the outcome two steps later.

## Pattern 4: assigned is not routed

A Head of RevOps on r/revops: *"we tend to treat successful assignment as successful routing."* The lead got an owner, so the routing report is clean. But the owner was on leave, or had been deactivated, or the lead bounced between three owners in a day, or it was assigned to a queue nobody watches.

The checks people built after being burned all look for states that should not exist: leads with no owner after 30 minutes, leads owned but with zero activity after a day, leads with more than two owner changes. One operator keeps what they call "zero dashboards": a report whose correct value is always zero.

## Pattern 5: the hot lead got an owner and no follow-up

Hex's marketing team published numbers on this. Before they built a prioritisation tool, median inbound follow-up time was 39 hours. After, 20 hours, and inbound-to-opportunity conversion rose 54%. That was at a well-run company with a modern stack.

The operators we spoke to measure the same thing when they measure anything: median time to first touch, trended weekly. One put it this way: *"when routing quietly breaks, it's usually the first thing to drift."* Repeat gaps on the same step, week after week, mean the handoff is wrong, not the rep.

## Pattern 6: the form worked, the ads kept running, the leads went nowhere

A marketer described a form plugin on a landing page silently failing for a stretch while paid campaigns kept driving traffic to it. The loss was counted twice: the media spend on a dead page, plus the pipeline that never arrived. Nobody in sales noticed because sales never saw the leads; nobody in marketing noticed because the campaign dashboard showed clicks.

The cheap check that several people run by hand: count yesterday's submissions in the form tool against yesterday's new form-sourced leads in the CRM, per source. Form count higher means lost before the CRM. Counts match but no owner means routing broke. Owners set but no first touch means follow-up.

## Pattern 7: a quiet week looks exactly like a broken form

The most repeated sentence in the whole exercise, in slightly different words each time. A Series B RevOps lead: *"the workflow I'd least want to break is demo request → CRM → owner, and a quiet week looks exactly like a broken form."*

The way through it is a baseline: compare today with the same weekday over the trailing weeks, per source, not with yesterday. And a daily test lead through the real path, end to end, so that "no leads today" and "the path is broken" are distinguishable.

## What the people who have solved it actually do

The sharpest operators we met have built their own version of the same five checks:

1. A daily count of form submissions versus new CRM records, per source.
2. An hourly check for any new lead older than 30 minutes with no owner.
3. A daily check for leads owned yesterday with zero activity.
4. A test lead through the live path, with the payload checked at the end, not just the trigger.
5. Zero dashboards for states that should not exist.

Every one of them also said some version of: *nobody opens a hygiene dashboard every day.* The checks only work when they post to Slack and name the record.

Two more things they agreed on. The check that matters most, the form-tool-versus-CRM count, cannot be built inside the CRM, because the lost records never reached it. And none of these checks maintain themselves: when the person who built them leaves, the checks go with them.

## What we don't know yet

We should be plain about the limits of this.

- The sample is people who answered a question in a community, so it skews toward operators who already care.
- Only a handful attached a dollar figure. The ones who did ranged from a $30k deal to "no idea, which is the problem."
- Several very capable teams said they rarely have issues. Tidy stacks with one builder and good habits may not need any of this.
- Automated daily checks seem to earn their keep at roughly one demo request a day or more. Below that, a weekly manual count is probably fine.

## Two ways to check your own stack

~~~block
two-ways
~~~

If you've seen a pattern that isn't here, tell me: shakil@dexraflow.com. The next version of this post will include it, credited if you want.
`;


const ROUTING_BODY = `
Lead routing rarely fails with an error. The routing report looks clean because the lead got an owner, and the report counts owners. But "assigned" is not the same as "routed". A lead is routed when a person who can act on it knows it exists and does something about it.

That gap is why most teams learn that lead routing broke the slow way. A rep mentions a thin queue. A prospect writes back to ask why nobody replied. Operators we spoke to described it the same way in different words: every tool says success, and none of them knows the lead arrived.

This post covers the states that show routing broke, a three-number count that tells you where, and five checks that catch it the same day. You can run all of it with the reports you already have.

~~~block
lead-path
~~~

## Five ways lead routing breaks without an error

None of these raises an alert. In each one, a tool did its own step and reported success.

### 1. The owner was on leave or deactivated

The rule ran and the lead has an owner. The owner is on holiday, or has left and their user was deactivated. On the record, the lead looks handled. In practice it sits untouched.

A round robin makes this easy to miss. The rotation keeps handing that person their share until someone takes them out of it, and nothing in the rotation knows they are away.

### 2. The lead went to a queue nobody watches

Most routing setups have a catch-all: a default owner, a team queue, a shared inbox for anything the rules did not place. It was a sensible choice when it was built. Then the person who watched it changed roles.

Leads in that queue have an owner on paper. Nobody opens the queue, so nobody follows up.

### 3. The lead bounced between several owners in a day

The lead is assigned, then reassigned, then reassigned again. Each new owner assumes the last one made contact, or expects the lead to move again. The history shows three owners and no activity.

A bounce is usually a sign that two rules disagree about who should have the lead, or that people are passing it by hand because the rule got it wrong.

### 4. A rule depended on a field that was renamed or left empty

Routing rules match on field values: region, company size, source. Someone renames a value, or a form stops filling the field. The lead now matches no rule and gets no owner.

If your lead assignment in HubSpot runs through a workflow, the workflow history will show the record went through it. It went through and came out with nobody attached. This is the usual cause of leads not assigned to an owner, and it starts on the day of the change.

### 5. The lead never reached the CRM

Routing never ran, because there was no record to route. From the rep's chair it looks like a routing problem: "I never got it." The cause is upstream, between the form and the CRM.

A routing report cannot show this, because it only counts records that exist. We wrote about this failure on its own in [what is lead leakage](/blog/what-is-lead-leakage).

### What the five have in common

In every case a report somewhere is correct. The rotation did assign the lead. The workflow did run. The queue does have an owner. The routing report counts assignments, and assignments happened.

What nobody counted is the outcome: a person saw the lead and acted. That is why you cannot find these by looking for errors. You find them by looking for leads in a state they should never be in.

~~~block
inventory-callout
~~~

## The three-number diagnosis

When someone says routing is broken, the first job is to find where the lead stopped. Pull three numbers for yesterday, for one form at a time:

1. Form submissions, from the form tool.
2. New CRM contacts created from that form.
3. Of those contacts, the ones with a first touch.

Then read them in order.

- **The form count is higher than the CRM count.** The lead was lost before the CRM. Routing is not the problem, and changing the rules will not help.
- **The counts match, but some contacts have no owner.** Routing broke. Open the ownerless contacts and look for what they share: the same region value, the same source, the same empty field. That usually points at the rule.
- **Owners are set, but there is no first touch.** It is a follow-up problem. Check whether the gaps sit with one owner, one queue, or leads that changed hands.

~~~block
three-numbers
~~~

Do this per form, not in total. One broken form hides inside a healthy total, because the other forms carry the number.

Two details keep the count honest. First, a returning visitor updates an existing contact and does not create a new one. Match submissions to contacts by email, or the CRM count will look short when nothing is wrong. Second, use the same day boundary in both tools. A form tool on one time zone and a CRM on another will disagree about what "yesterday" means.

The first time you run it, the three numbers take a few minutes and two exports. If they line up, you have a baseline. If they do not, you know which of the three handoffs to open.

The third count is where response time comes in. If you report on speed to lead, the same leads that fall out here also fall out of that metric. The companion post covers it: [why your speed to lead looks fine and leads still wait two days](/blog/speed-to-lead-looks-fine-leads-still-wait).

## Five checks operators built after being burned

The checks below came up again and again in our conversations. They have one thing in common. Each looks for a state that should not exist, so the right answer is always zero.

~~~block
five-checks
~~~

**New leads older than 30 minutes with no owner.** This catches the renamed field and the rule that matches nothing. Thirty minutes gives the automation time to run. After that, a lead with no owner is not waiting for routing. Routing has already missed it.

**Leads owned yesterday with zero activity.** This catches the absent owner and the unwatched queue. The lead has an owner, so the routing report is satisfied. The check asks the next question: did anything happen?

**Leads with more than two owner changes.** This catches the bounce. One reassignment is normal. More than two in a short time means the rules disagree or people are working around them.

**A daily test lead through the real path, checked at the end.** Submit the real form the way a visitor would. Then check where the lead ended up: a contact, an owner, a first touch. The important part is checking the end. A test that only confirms the trigger fired tells you the first step works, which you already knew.

**"Zero dashboards".** One operator's name for a report whose correct value is always zero. The three checks above are zero dashboards. So is "contacts with no source" or "leads in the catch-all queue". Any number other than zero is a problem, and nobody has to interpret it.

The thresholds are starting points. Thirty minutes suits a path where assignment is automatic. If a person assigns leads by hand each morning, a longer window is more honest. Pick the window you would be comfortable explaining to a prospect who was waiting, then hold the path to it.

## Why these checks decay

Operators who built these checks were honest about what happened next. Two things wear them down.

**Nobody opens a hygiene dashboard every day.** A report you have to visit gets visited in the first week. After that it is checked when something already feels wrong, which is too late. So the check has to come to you. It posts to Slack, and it names the record. "Three leads have no owner" gets ignored. A message with the three leads and a link to each gets fixed.

**The checks leave with the person who built them.** They live in someone's saved reports and someone's head. When that person leaves, the rules keep changing and the checks do not. A field gets renamed, and the check built on the old name quietly looks at nothing. It reports zero, which is also what a healthy check reports.

That is the same failure as the routing rule in the first place: something that runs, reports a clean result and has stopped doing its job.

Three habits slow the decay:

- Write down what each check is for, in one line, next to the check.
- Give each check a named owner, the same way you would give a lead one.
- Use the daily test lead to test the checks. If the test lead sat with no owner for an hour and no message arrived, the check is broken, not the routing.

## Two ways to check your own lead path

~~~block
two-ways
~~~
`;

const SPEED_BODY = `
Speed to lead is one of the few numbers that sales and marketing both watch. It is also a number that can look healthy on top of a broken lead path.

The reason is how it is calculated. Speed to lead is usually an average over the leads that got a response. A lead with no owner, no task or no contact record never got a response, so it is not in the average. The number looks fine. Some leads wait indefinitely.

This post covers what gets left out of the number, how to measure lead response time so the gaps show, and the extreme case we reproduced in our own HubSpot account. The short version is our usual line: every tool says success, and none of them knows the lead arrived.

~~~block
average-tail
~~~

## What gets left out of speed to lead

The metric starts a clock when a lead is created and stops it at the first touch. Four groups of leads never get a stopped clock, so they never enter the calculation.

### Leads that never became a CRM contact

The form accepted the submission. The contact was never created. There is no record, so there is no clock to start. These leads cannot be slow, because as far as the CRM knows they do not exist. We covered how this happens in [what is lead leakage](/blog/what-is-lead-leakage).

### Leads with no owner

The contact exists and nobody was assigned. Nobody is responsible for the first touch, so it does not happen. A blank is not a slow time. An average skips it.

This is a routing failure, and it has its own tells. See [how to tell if lead routing broke](/blog/how-to-tell-if-lead-routing-broke).

### Leads assigned to someone absent

The lead has an owner, and the owner is on leave. For the days they are away, the lead has no first touch and stays out of the number. If the owner picks it up on their return, it enters as one slow data point, long after anyone read that week's report.

### Leads where a sequence shows "active" and sent nothing

The lead was enrolled. The sequence status says active. No email went out. If your report treats enrolment as the first touch, this lead is recorded as a fast response that never happened. If it does not, the lead is one more blank.

~~~block
metric-funnel
~~~

The metric is calculated on the last group only. Everything that falls out earlier is missing from it, and those are the leads that waited longest.

~~~block
inventory-callout
~~~

## How to measure it so the gaps show

You do not need a new tool for this. You need four changes to the report you already have.

### Use the median, and trend it weekly

A mean is pulled around by a few very slow leads and tells you little about the typical one. The median is the lead in the middle: half were faster, half were slower. Report the median time to first touch, and plot it week by week.

Here is a made-up example to show the difference. Five leads get a first touch after 10 minutes, 20 minutes, 30 minutes, an hour and three days. The mean is close to 15 hours, which describes none of them. The median is 30 minutes, which describes the typical lead. Neither number says anything about a sixth lead that was never touched.

The trend matters more than the level. A median that drifts up over three weeks is telling you something changed in the path, even if each week still looks acceptable on its own.

### Report leads with no first touch as their own number

This is the change that matters most. Next to the median, report one count: leads with no first touch after one business day.

It is the number the average hides. Its correct value is zero. When it is not zero, list the leads by name, because a count gets discussed and a list gets worked.

Start the count from submissions if you can, not from CRM contacts. A count that starts in the CRM still misses the leads that never became a contact.

### Decide what counts as a first touch

The metric is only as honest as its stop condition. Write down what stops the clock, and be strict about it.

A call, a personal email or a completed task by the owner is a first touch. An automatic confirmation email is not: it goes out whether or not anyone has seen the lead. Enrolment in a sequence is not either, until a step has actually sent. If your report stops the clock on enrolment, the sequence that shows active and sends nothing will look like your fastest responder.

### Split by source

A total across every form and channel is the most comfortable number and the least useful. One broken source hides inside a healthy total, because the working sources carry it.

Report the median and the no-first-touch count per source. A source with a fine median and a growing no-touch count is where to look first.

### Compare each weekday with the same weekday

A quiet day and a broken form look the same: fewer leads than yesterday. Comparing today with yesterday cannot tell them apart, because Mondays are not like Sundays.

Compare each weekday with the same weekday in previous weeks, per source. A Tuesday far below the last few Tuesdays is worth a look. A Sunday far below Saturday is not.

Put together, the weekly report is three lines per source: the median time to first touch, the count with no first touch after one business day, and submissions against the same weekday in previous weeks.

## What to do when it drifts

When inbound lead follow-up slows down, the first instinct is to talk to the reps. Look at where the gaps sit before you do.

Repeated gaps at the same step mean the handoff is wrong, not the rep. A rep who is slow on every lead is a coaching conversation. Leads that stall at the same point, week after week, across different reps, are a path problem.

Three patterns are worth checking:

- **The gaps sit with one owner.** Check whether that person is away or overloaded before you check their effort.
- **The gaps sit with one source.** Check the form and the rule that routes it. Something about that source stopped matching.
- **The gaps appeared all at once.** Something changed on that day: a field, a form, an integration. Find the change.

The three-number count in the [lead routing post](/blog/how-to-tell-if-lead-routing-broke) tells you which of these you are looking at in a few minutes.

Once you have fixed the handoff, do not go back to watching the average. Watch the no-first-touch count for that source return to zero and stay there. That count is the evidence the fix worked. The average will barely move, because the leads you just rescued were never in it.

## The extreme case: leads HubSpot files as spam

There is one failure where the lead has no response time at all, and it is worth knowing about if you run forms on HubSpot.

A submission that arrives from a domain missing from your tracked site domains is filed as spam. The visitor sees success. No contact is created. After 90 days the submission is deleted.

We reproduced this in our own HubSpot account on 15 November 2026. The form accepted the entry and the CRM never received a contact.

~~~block
spam-timeline
~~~

Think about what that does to the metric. There is no contact, so there is no created date and no first touch. The lead is not slow. It is not in the report in any form. Your speed to lead can be excellent while every submission from one domain goes straight to a queue nobody opens.

A daily digest of spam submissions exists, but it is off by default, so nothing prompts anyone to look. And the 90 days run from the submission, not from the day you find it.

The only way to see these leads is to count from outside the metric: submissions the visitor made against contacts the CRM holds. That is the same count as the first step of the routing diagnosis, and it is why that step comes first.

If you have changed domains or added a new site, check that the domain is in your tracked site domains, and open the spam queue on your forms. The broader pattern, a lead that is lost while every step reports success, is what we mean by [lead leakage](/blog/what-is-lead-leakage).

## Two ways to check your own lead path

~~~block
two-ways
~~~
`;

/** The slim callout and the two closing cards shared by the routing and speed-to-lead posts. */
const LEAD_PATH_BLOCKS: Record<string, Block> = {
  "inventory-callout": { kind: "callout", text: "Check your own lead path in two minutes.", cta: "Open the inventory", href: "/inventory" },
  "two-ways": {
    kind: "cards",
    cards: [
      {
        title: "Check it yourself",
        body: "The free [workflow inventory](/inventory) asks one question about each workflow in your lead path: if this broke today, would anyone notice? No login.",
        cta: "Open the inventory",
        href: "/inventory",
      },
      {
        title: "Have us check the last 90 days",
        price: "$1,500 founding price · list $3,000",
        body: "The Missed-Pipeline Audit. 14 days, read-only, under NDA. Founding price $1,500 (list $3,000), half on signing and half on delivery.",
        cta: "Book a 15-minute call",
        href: BOOK_CALL,
      },
    ],
  },
};

export const POSTS: Post[] = [
  {
    slug: "how-leads-go-missing-without-an-error",
    title: "Seven ways a lead goes missing without an error: what 40 RevOps people told us",
    description:
      "Field notes from 40+ RevOps and GTM practitioners on how leads vanish between forms, CRMs and agents while every tool reports success. Includes a HubSpot test we reproduced.",
    date: "2026-11-16",
    readMinutes: readMinutes(SEVEN_WAYS_BODY),
    tags: ["Lead leakage", "HubSpot forms", "Lead routing", "RevOps"],
    author: { name: "Sayyad Shakil", role: "Founder, Dexraflow" },
    blocks: {
      "spam-tab": {
        kind: "callout",
        text: "Migrated your site since May 2024? Open your forms' Spam tab before the 90 days run out.",
        cta: "Book a 20-minute call",
        href: BOOK_CALL,
      },
      "two-ways": {
        kind: "cards",
        cards: [
          {
            title: "Check it yourself",
            body: "**Do it yourself, in ten minutes.** Our [workflow inventory](/inventory) walks you through the handoffs in your lead path and asks, for each one, who would notice if it broke today. It is free and it does not ask for CRM access.",
            cta: "Open the workflow inventory",
            href: "/inventory",
          },
          {
            title: "Have us check 90 days",
            price: "$1,500 founding price · list $3,000",
            body: "**Have us check the last 90 days.** The Missed-Pipeline Audit is a 14-day, read-only review of your form, CRM and outreach exports. You get the exact records that slipped, where they slipped, what they were worth, and we fix the top three causes with you. Founding price $1,500 (list $3,000), half on signing, half on delivery, under NDA, and your data never goes into an AI tool. Because of the 90-day deletion in Pattern 1, if you migrated a site this autumn, sooner is genuinely better than later.",
            cta: "Book a 20-minute call",
            href: BOOK_CALL,
          },
        ],
      },
    },
    body: SEVEN_WAYS_BODY,
  },
  {
    slug: "how-to-tell-if-lead-routing-broke",
    title: "How to tell if lead routing broke (before a rep tells you)",
    description: "Lead routing rarely fails with an error. Here are the states that show it broke, and five checks that catch it the same day.",
    date: "2026-11-15",
    readMinutes: readMinutes(ROUTING_BODY),
    tags: ["Lead routing", "HubSpot", "RevOps"],
    blocks: {
      ...LEAD_PATH_BLOCKS,
      "lead-path": { kind: "diagram", name: "lead-path" },
      "three-numbers": { kind: "diagram", name: "three-numbers" },
      "five-checks": { kind: "diagram", name: "five-checks" },
    },
    body: ROUTING_BODY,
  },
  {
    slug: "speed-to-lead-looks-fine-leads-still-wait",
    title: "Why your speed to lead looks fine and leads still wait two days",
    description: "Speed-to-lead averages hide the leads that never got a first touch at all. How to measure it so the gaps show.",
    date: "2026-11-15",
    readMinutes: readMinutes(SPEED_BODY),
    tags: ["Speed to lead", "Lead response time", "RevOps"],
    blocks: {
      ...LEAD_PATH_BLOCKS,
      "average-tail": { kind: "diagram", name: "average-tail" },
      "metric-funnel": { kind: "diagram", name: "metric-funnel" },
      "spam-timeline": { kind: "diagram", name: "spam-timeline" },
    },
    body: SPEED_BODY,
  },
  {
    slug: "what-is-lead-leakage",
    title: "What is lead leakage? Where leads go missing between your GTM tools",
    description:
      "Lead leakage is when a lead enters your stack but never reaches a person. Here is where it happens, why nothing alerts you, and how to measure it in a week.",
    date: "2026-11-09",
    readMinutes: 8,
    tags: ["Lead leakage", "RevOps"],
    callout: {
      text: "Not sure where your own leads go missing? Run the two-minute self-check. It lists every workflow that writes to your CRM and flags the four places leads usually slip. Free, no login.",
      cta: "Check my workflows",
      href: "/inventory",
    },
    closing: {
      title: "Find out what you've already lost",
      body: "We run a 14-day missed-pipeline audit. Read-only, under NDA. We match every submission from the last 90 days to your CRM by email and show you which leads never reached a rep, what they were worth, and the fixes that matter. Founding price: $1,500 (list $3,000). Half on signing, half on delivery.",
      cta: "Book a 15-minute call",
      href: "https://calendar.app.google/Jm892hC4kmMXafec6",
      secondary: { label: "Or run the free self-check first", href: "/inventory" },
    },
    body: `
Lead leakage is when a lead enters your GTM stack but never reaches a person who can follow up.

The lead existed. Someone filled in a form, booked a demo, replied to a sequence or hit a pricing page three times. Then, somewhere between two tools, it dropped. No error. No alert. The dashboard still looked fine.

This article covers where lead leakage happens, why your tools don't tell you, and how to measure it in your own stack in about a week.

## The four places leads leak

Most lead leakage happens at a handoff. A handoff is any point where one tool passes a lead to the next. A typical B2B stack has at least four.

### 1. Form to CRM

A form fill should become a contact or lead in the CRM. This step breaks more often than any other.

Common causes:

- A form was rebuilt and the integration points at the old one.
- A required field was added to the CRM, so writes with a blank value are rejected.
- The connector's token expired. It still runs, and still reports success, but it writes nothing.
- A spam filter was tightened and now drops real submissions.

The sign: form submissions go up, contacts created stay flat.

### 2. CRM to routing

A new lead should get an owner. Routing rules match on territory, company size, source or round-robin.

Common causes:

- A rep left and their queue was never reassigned.
- A picklist value was renamed, so the rule matches nothing.
- A new source was added and no rule covers it.

The sign: contacts created go up, contacts with an owner don't. The leads are in the CRM. They just belong to nobody.

### 3. Routing to sequencing

An owned lead should get a task, a sequence or at least a notification.

Common causes:

- The sequence enrolment workflow was paused during a migration and never resumed.
- The sync between CRM and the outreach tool stopped after a field type changed.
- The enrichment step that the sequence waits for is stuck, so nothing enrols.

The sign: owned leads go up, enrolments and first touches don't.

### 4. Signal to follow-up

Some leads raise their hand twice. A second form fill, a pricing-page visit, a reply to an old email. These are the hottest leads in the stack, and they leak the most quietly, because there is no single record that says "this person is waiting."

The sign: repeat activity on a contact with no task and no outbound touch after it.

## Why nothing tells you

Every tool in your stack alerts you when something breaks. The problem is that lead leakage is usually not a break. It's a success that should have been a different success.

Take a Zapier Zap that moves form fills into HubSpot. The form was rebuilt last Tuesday. The Zap now receives zero submissions. It runs on schedule, finds nothing to do, and reports a successful run. Zapier is right. The Zap didn't fail. It just stopped mattering.

Take a HubSpot workflow that assigns owners. Someone renamed the "Region" property values from "EMEA" to "Europe." The workflow's branch for "EMEA" now matches nothing. Every lead falls through to the default branch, which does nothing. The workflow history shows every lead was processed.

Take a webhook that returns 200 before the CRM write actually happens. The sending tool logs success. The write fails on the other side, and the failure lives in a log nobody opens.

None of these produce an error where you'd look. They produce a quiet week. And a quiet week looks like a slow month, which looks like a marketing problem, which is why these get found three weeks later by a rep asking "why did we never follow up with this account?"

## How to measure lead leakage in your stack

You can get a usable number in about a week, with exports and a spreadsheet. Here is the method.

### Step 1: Pick the last 90 days

Shorter and you'll miss the slow leaks. Longer and the exports get painful.

### Step 2: Pull one count per handoff

For each handoff, pull two numbers, by day and by source:

| Handoff | Count on the left | Count on the right |
| --- | --- | --- |
| Form to CRM | Form submissions | Contacts created from that form |
| CRM to routing | Contacts created | Contacts with an owner within 24 hours |
| Routing to sequencing | Contacts with an owner | Contacts with a task or enrolment within 48 hours |
| Signal to follow-up | Contacts with a repeat high-intent activity | Those with an outbound touch within 48 hours after it |

### Step 3: Look for the day the lines diverge

Plot left and right on the same chart. Healthy handoffs track each other. A leak shows up as the day the right-hand line drops while the left-hand line doesn't.

That day is usually the day someone changed something. Check the change history for the form, the workflow, the property or the integration. You'll usually find it.

### Step 4: Name the leads, not just the number

A gap of 37 leads is an abstraction. A list of 37 companies with a form fill and no owner is a Monday morning task. Export the actual records on the wrong side of each gap. That list is what you'll use to recover what can still be recovered.

### Step 5: Put a value on it

Multiply the leaked leads by your average deal size and your form-to-close rate for that source. The number is rough. It's also usually large enough that the next question in the room is "how do we make sure this never happens again?"

## Recovering leaked leads

Some of the list is recoverable. Prioritise by recency and intent:

1. **Demo requests and pricing-page repeat visitors from the last two weeks.** Call them today. A short, honest note works: "Your request reached us but didn't get routed. That's on us. Still happy to talk?"
2. **Form fills from the last 30 days.** Enrol in a sequence with the same note.
3. **Anything older.** Put it in nurture. The window has mostly closed, but not entirely.

## Preventing it

The measurement above is the prevention. Run it daily instead of once, and the three-week gap becomes a same-day gap.

That's what Dexraflow does. It runs one check a day across every handoff, compares what each tool received with what the next one should have, and tells you the day they stop matching, with the exact leads and what they were worth. It's read-only. It never writes to your tools.

If you'd rather someone else ran the first pass, the [Missed Pipeline Audit](/#offer) is 14 days, read-only, across your last 90 days. You get the list, the value and the cause for each gap.
`,
  },
  {
    slug: "gtm-automation-failures",
    title: "GTM automation failures: the ones that say \"success\"",
    description:
      "The worst GTM automation failures don't throw errors. A field is renamed, a Zap keeps running with zero rows, a webhook returns 200 too early. Here are the patterns and how to catch each one.",
    date: "2026-11-09",
    readMinutes: 9,
    tags: ["GTM automation failures", "HubSpot", "Zapier"],
    body: `
There are two kinds of GTM automation failures.

The first kind throws an error. A Zap errors out, HubSpot emails you, a Salesforce flow fault shows up in the admin's inbox. These are annoying, and they are mostly fine. Somebody sees them.

The second kind doesn't throw anything. The workflow runs. The run log says success. And the leads stop arriving where they should. Nobody sees these, because there is nothing to see. They get found weeks later, usually by a salesperson asking why nobody followed up with a prospect.

This article is about the second kind. The patterns below come from RevOps practitioners who shared what broke in their stacks. Names and numbers are removed.

## Pattern 1: The workflow that runs on nothing

A Zap, Make scenario or workflow that polls a source, finds nothing, and reports a successful run.

**How it starts:** the source changed. A form was rebuilt with a new ID. A spreadsheet tab was renamed. A webhook URL changed in the sending tool but not the receiving one. The automation still points at the old thing, which is now empty.

**What you see:** a perfect run history. Green ticks every fifteen minutes. Zero rows processed, which the run log usually shows if you open it, and nobody opens it.

**How long it hides:** until someone notices lead volume is down and goes looking. In one shared story, eleven days. From the dashboard, it looked like a quiet week.

**How to catch it:** count rows processed per run, not runs. A run that processes zero rows for longer than your usual gap between leads is a break.

## Pattern 2: The branch that matches nothing

A routing or enrolment workflow with branches based on a property value.

**How it starts:** someone renamed a picklist value. "EMEA" became "Europe." "SMB" became "Small business." Or a new value was added, "Partner," and no branch covers it. Every lead with that value falls through to the default branch, which often does nothing.

**What you see:** the workflow history shows every lead was processed. Technically true. They were processed into nothing.

**How long it hides:** until a rep for that region asks why their queue is empty.

**How to catch it:** count leads entering the workflow against leads that got an owner, a task or an enrolment within 24 hours. The gap is the fall-through.

## Pattern 3: The required field

A CRM admin adds a required field. Integrations that write to the CRM without that field now fail on write.

**How it starts:** a reasonable data-quality decision, made without checking what writes to the object.

**What you see:** depends on the integration. Some report an error. Many report success, because the API call was accepted and the validation failure comes back in a response body nobody parses.

**How long it hides:** until contacts created drops and someone checks.

**How to catch it:** form submissions against contacts created, per source, per day. The day the required field was added is the day the lines split.

## Pattern 4: The 200 that came too early

A webhook or integration that returns success before the downstream write actually happens.

**How it starts:** the receiving system queues the write and acknowledges the request. The write then fails on a schema mismatch, a permission issue or a rate limit. The sending system already logged success.

**What you see:** success on the left, nothing on the right. The failure is in a queue log, a dead-letter queue or an error table nobody has a dashboard for.

**How long it hides:** in one shared story, eight days, after a schema change broke routing. Nothing was assigned for a week.

**How to catch it:** don't trust the sender's log. Count on the receiving side.

## Pattern 5: The paused step

A workflow was paused during a migration, a cleanup or a test. It was never turned back on.

**How it starts:** someone meant to come back to it.

**What you see:** no runs. Which looks the same as "nothing to do" unless you know the workflow should be busy.

**How to catch it:** every workflow that matters should have an expected minimum volume. Below that for longer than a day, it's a break, whether the status says paused or active.

## Pattern 6: The expired token

An integration's auth token expires or is revoked. Many connectors keep "running" and quietly fail every call.

**How it starts:** a password change, a departed admin whose account owned the connection, a scheduled token rotation.

**What you see:** some tools flag it clearly. Others show a run history that looks normal and a connection page that says "reconnect" if you happen to visit it.

**How to catch it:** count writes that landed, not calls that were made.

## The common thread

Every pattern above is a success that should have been a different success. The tools are not lying. A run with zero rows did succeed. A lead that fell through to a do-nothing branch was processed. The 200 response was real.

That's why error-based monitoring can't catch these. There is no error. The only way to see them is to compare what one tool received with what the next tool should have, and notice the day they stop matching.

## A daily check across every handoff

Here is the check, in plain terms. For each handoff in the lead path, take two counts per day:

- what went in on the left
- what came out on the right, within the time you'd expect

Forms to CRM. CRM to owner. Owner to first task. High-intent signal to follow-up. Four handoffs, eight counts, per source.

When the right-hand count drops and the left doesn't, something broke, whatever the run log says. Name the records on the wrong side of the gap. That's your recovery list.

You can run this by hand with exports and a spreadsheet, and it's worth doing once to see what your stack has been dropping. The [lead leakage article](/blog/what-is-lead-leakage) walks through it step by step.

Dexraflow runs the same check every day, read-only, across HubSpot, Salesforce and Zapier, and tells you the day a handoff stops matching, with the leads and what they were worth. The first pass is a 14-day [Missed Pipeline Audit](/#offer) over your last 90 days.
`,
  },
  {
    slug: "find-leads-your-hubspot-workflows-dropped",
    title: "How to find the leads your HubSpot workflows dropped, in one afternoon",
    description:
      "A step-by-step check for HubSpot: four reports, two exports and a spreadsheet, to find form fills that never became contacts, contacts with no owner and demo requests nobody touched.",
    date: "2026-11-09",
    readMinutes: 7,
    tags: ["HubSpot", "How-to", "Lead leakage"],
    body: `
This is a practical check you can run in HubSpot in an afternoon. It finds three things:

1. Form fills that never became contacts
2. Contacts that never got an owner
3. High-intent contacts nobody followed up with

You need a Super Admin or a user with reports and export access. No apps, no code. The method works in Salesforce too, with different report names, and the general version is in [what is lead leakage](/blog/what-is-lead-leakage).

Pick a window first. The last 90 days is a good default.

## Check 1: Form fills that never became contacts

**What breaks here:** a rebuilt form, a connector pointing at the old form, a required property blocking the write, a spam filter that got too aggressive.

**Pull two numbers per form, per week.**

Submissions: Marketing, then Forms. Open each form that matters and read the submissions count for the window. If you use an external form tool pushing into HubSpot through Zapier or a native integration, take the count from that tool instead. It's the left-hand side.

Contacts created: Contacts, then Contacts. Filter by Create date in the window and Original source drill-down 2 equals the form's name. Or filter by the form's "Recent conversion" property. Count by week. It's the right-hand side.

**Read it:** the two counts should track each other closely. A week where submissions hold steady and contacts created drops is the week something broke. Go to the form's history and the connector's run log for that week. You'll usually find a change.

**Name the records:** if the gap is from an external form tool, export the submissions for the bad weeks and match on email against HubSpot. The unmatched rows are your leaked leads.

## Check 2: Contacts with no owner

**What breaks here:** a rep left and the queue wasn't reassigned, a renamed picklist value that no routing branch matches, a new source nobody wrote a rule for.

**Build one list.** Contacts, then Lists, then Create list. Active list, contacts. Filters:

- Create date is in the window
- Contact owner is unknown
- Lifecycle stage is Lead, MQL or SQL (whatever means "sales should see this" in your setup)

Save it. The count is your headline number.

**Find the cause.** Add a breakdown by Original source and by the property your routing rules use (Region, Company size, Industry). One value usually holds most of the unowned contacts. That value is the one the routing rule doesn't match anymore.

Then open the routing workflow. Automation, then Workflows. Look at the branch conditions. Compare the values in the branches against the values currently in the property. A renamed or new value with no branch is the break.

**Name the records:** the list is the record list. Export it with Create date, Original source, Company and Email.

## Check 3: High-intent contacts nobody touched

**What breaks here:** nothing has to break. This leak exists in most stacks by default, because a second form fill or a pricing-page visit doesn't create a new record. It updates an old one, and nothing notifies anyone.

**Build a second list.** Active list, contacts. Filters:

- Recent conversion date is in the last 14 days, or Number of form submissions is greater than 1
- Or, if you track it, Number of pageviews on pricing is greater than 2 in the window
- And Last contacted is unknown or more than 7 days ago
- And there are no open tasks (filter on Next activity date is unknown)

**Read it:** every contact on this list raised their hand and heard nothing. Sort by Recent conversion date, newest first. The top of the list is today's work.

## Putting a value on it

Take the three lists. Remove duplicates. Multiply by the close rate and average deal size for the source. The number will be rough. It will also usually be large enough to justify the next step, which is making sure the gap never gets to 90 days again.

## Recovering what you can

Work the lists in this order:

1. Check 3, last 14 days. Call or send a short personal note today.
2. Check 2, last 30 days. Assign owners, enrol in a sequence, with an honest note that the request didn't get routed.
3. Check 1, last 30 days. Create the contacts and treat them like check 2.
4. Everything older goes to nurture.

## Keeping it fixed

The afternoon you just spent is the check. The problem is that it was one afternoon. The next renamed property, rebuilt form or departed rep starts the clock again, and the first sign will be a rep asking why nobody followed up.

Run the same four counts every day, per handoff, per source, and compare today against the usual. The day a right-hand count drops while the left doesn't is the day something broke.

Dexraflow does exactly this, read-only, across HubSpot, Salesforce and Zapier. It tells you the day a handoff stops matching, which leads fell through and what they were worth. If you'd like the first 90-day pass done for you, the [Missed Pipeline Audit](/#offer) is 14 days, read-only, and you get the lists above with the cause for each gap.
`,
  },
];

export const findPost = (slug: string | undefined) => POSTS.find((p) => p.slug === slug);
