# Supabase: the "Dexraflow-Form" project

Backs the public site's forms and the Silent Break Score at `/inventory`.
The schema lives in the project itself (Dashboard → Database → Migrations).

## What is there

| Object | Purpose |
| --- | --- |
| `access_requests` | Requests from the landing page forms. |
| `inventory_submissions` | Email, score summary and workflow rows from `/inventory`, sent only when a visitor asks for the spreadsheet by email. |
| `send-email` Edge Function | Fired by a trigger on each new submission. Emails the score and checklist, with the inventory attached as a formatted Excel workbook built on the server. Source in `functions/send-email`. |
| `retry_unsent_emails()` | Re-queues submissions whose email was never sent. |

Call booking is not in Supabase. It is the founder's Google Calendar appointment page, embedded on `/inventory`.

## Turning email on (Resend)

1. Create a Resend account, add the domain `dexraflow.com`, and add the DNS records it shows.
2. Create an API key in Resend.
3. Supabase Dashboard → Edge Functions → Secrets → add `RESEND_API_KEY`.
   Optional: `RESEND_FROM` (default `Dexraflow <hello@dexraflow.com>`), `REPLY_TO`, `SITE_URL`, `BOOKING_LINK`.
4. Send anything that queued up before the key existed:

```sql
select public.retry_unsent_emails();
```

Until the key is set nothing is sent, and each row records `RESEND_API_KEY is not set` in `report_error`.
