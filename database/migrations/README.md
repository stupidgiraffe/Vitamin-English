# Database Migrations

This directory contains SQL migration scripts for database schema changes.

## How to apply migrations

For a fresh database, all migrations are already applied through `schema.sql`.

For existing databases, run migrations manually in order:

```bash
sqlite3 database/school.db < database/migrations/001_add_student_contact_fields.sql
```

## Migrations

- `001_add_student_contact_fields.sql` - Adds contact and enrollment fields to students table
  - email
  - phone
  - parent_name
  - parent_phone
  - parent_email
  - enrollment_date
