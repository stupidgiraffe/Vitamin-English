# Teacher Comment Sheets Cleanup Hotfix

## What this adds

This hotfix adds an admin-only **Comment Sheets Cleanup** page plus supporting backend endpoints to:

- find and filter teacher comment sheets
- spot duplicate sheets by normalized class/date
- edit one sheet date or bulk-update many dates
- preview and merge duplicate sheets safely
- delete sheets safely with FK-aware checks
- export filtered rows as CSV
- import bulk date fixes from CSV or JSON

All write actions are transactional and write to `teacher_comment_sheet_audit`.

## Run the migration

Apply the additive audit-table migration before using the cleanup tools:

```bash
node scripts/apply-all-migrations.js
```

The new migration is:

- `database/migrations/015_add_teacher_comment_sheet_audit.sql`

## Recommended cleanup workflow

1. Open **Comment Sheets Cleanup** as an admin.
2. Filter by teacher, class, date range, or duplicates only.
3. Review highlighted duplicate rows and the duplicate-group summary.
4. Use **Preview merge** before any real merge so the FK repoint count is clear.
5. Merge confirmed duplicates first.
6. Use single-edit or bulk date update to normalize remaining wrong dates.
7. Export the filtered view as CSV for a final review.
8. If needed, paste CSV/JSON into the import panel to apply many date fixes atomically.
9. Review `teacher_comment_sheet_audit` for a record of every change.

## Rollback plan

- UI/API rollback: redeploy the previous application version.
- Data rollback: inspect `teacher_comment_sheet_audit` and reverse date changes manually or with SQL using the stored `before_json` values.
- Merge/delete rollback: restore from database backup if rows were merged or deleted incorrectly, then replay only the confirmed cleanup actions.

Because merge/delete operations change foreign-key relationships, database backup/restore is the safest rollback path for those actions.
