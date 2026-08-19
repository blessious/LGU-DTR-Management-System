-- Run only after a verified full database backup.
-- Archives exact duplicate punches, keeps the lowest imports.id, and prevents recurrence.

CREATE TABLE IF NOT EXISTS imports_duplicate_archive_20260819 LIKE imports;

START TRANSACTION;

INSERT IGNORE INTO imports_duplicate_archive_20260819
SELECT duplicate_row.*
FROM imports AS duplicate_row
INNER JOIN (
  SELECT employee_id, created_at, MIN(id) AS keep_id
  FROM imports
  GROUP BY employee_id, created_at
  HAVING COUNT(*) > 1
) AS duplicate_group
  ON duplicate_group.employee_id = duplicate_row.employee_id
 AND duplicate_group.created_at = duplicate_row.created_at
WHERE duplicate_row.id <> duplicate_group.keep_id;

DELETE source_row
FROM imports AS source_row
INNER JOIN imports_duplicate_archive_20260819 AS archived
  ON archived.id = source_row.id;

COMMIT;

ALTER TABLE imports
  DROP INDEX idx_imports_employee_created,
  ADD UNIQUE KEY uq_imports_employee_created (employee_id, created_at),
  ALGORITHM=INPLACE,
  LOCK=NONE;

-- Manual rollback, if deliberately required:
-- ALTER TABLE imports
--   DROP INDEX uq_imports_employee_created,
--   ADD KEY idx_imports_employee_created (employee_id, created_at);
-- INSERT IGNORE INTO imports SELECT * FROM imports_duplicate_archive_20260819;
