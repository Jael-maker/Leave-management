# Test plan

- OAuth: callback rejects missing or invalid code; session is HttpOnly and expires.
- Authorization: employee sees only their own requests; manager sees assigned approvals; HR sees audit and HR Notes.
- Validation: dates, weekends, annual 21-day cap, conditional caps, required fields, and duplicate submissions.
- ClickUp: custom-field IDs map correctly; Pending Approval is created; Approved appears on calendar; Rejected stays in audit.
- Webhooks: invalid signatures are rejected; valid task updates refresh status; retries are idempotent.
- Security: HTTPS, Helmet, rate limits, no secrets in client bundle, audit logs, and redacted errors.
