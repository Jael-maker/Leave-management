# Handover guide

## Before launch

Create the ClickUp OAuth app, configure the redirect URI, add production secrets, identify the Private Leave Records list ID and custom-field IDs, map HR and managers by ClickUp user ID, and register the signed webhook URL.

## Employee access

Employees sign in with ClickUp OAuth. The backend derives identity from the authenticated ClickUp user, never from a client-supplied employee name or dropdown.

## Approval flow

Requests are created as Pending Approval. Managers approve or reject. HR verifies the balance and audit fields. Approved records feed the calendar. Completed is used after the leave period ends.

## Operations

Monitor `/api/health`, webhook failures, OAuth errors, and denied authorization attempts. Rotate secrets if exposed. Never put ClickUp tokens in frontend code or commit `.env` files.

## Known gate

The starter intentionally does not call ClickUp until OAuth and field configuration are supplied. That is a safety feature, not a missing UI button.
