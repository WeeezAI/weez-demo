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
};

export const POSTS: Post[] = [
  {
    slug: "what-is-lead-leakage",
    title: "What is lead leakage? Where leads go missing between your GTM tools",
    description:
      "Lead leakage is when a lead enters your stack but never reaches a person. Here is where it happens, why nothing alerts you, and how to measure it in a week.",
    date: "2026-11-09",
    readMinutes: 8,
    tags: ["Lead leakage", "RevOps"],
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
