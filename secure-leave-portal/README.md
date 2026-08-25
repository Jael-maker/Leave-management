# Secure Leave Portal

A production-oriented starter for an authenticated employee leave portal backed by ClickUp.

## What is included

- ClickUp OAuth login flow with server-side sessions
- Employee-scoped request access
- ClickUp task creation in `Private Leave Records`
- Custom-field mapping for employee, email, dates, working days, leave type, approval status, and HR notes
- Manager approval lifecycle: Pending Approval, Approved, Rejected, Completed
- Signed webhook receiver for ClickUp task updates
- Server-side validation for 21 annual working days and conditional leave categories
- HR-only route guards and audit logging hooks
- Test plan and handover guide

## Required setup

1. Create a ClickUp OAuth app and set `CLICKUP_CLIENT_ID`, `CLICKUP_CLIENT_SECRET`, and `CLICKUP_REDIRECT_URI`.
2. Set `SESSION_SECRET` and `CLICKUP_WEBHOOK_SECRET`.
3. Set `PRIVATE_LEAVE_RECORDS_LIST_ID` and the custom field IDs in `.env`.
4. Configure the OAuth redirect URI and webhook endpoint in ClickUp.
5. Run `npm install`, then `npm test`, then `npm start`.

This pack is intentionally not connected to production credentials. Add secrets through the deployment platform, never commit them.
