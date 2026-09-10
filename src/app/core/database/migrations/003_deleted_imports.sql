-- Rows deleted by hand stay deleted.
--
-- The importer recognises a row it has already stored by its fingerprint and
-- skips it. Deleting that row removes the fingerprint with it — so the next
-- import sees a row it has never met and puts it back. Someone who deletes a
-- movement and re-imports gets it again, and has no reason to suspect why.
--
-- A deletion is a decision, exactly as an edit is: `locked` protects an edited
-- row, and this protects a deleted one. The fingerprint outlives the row.
--
-- Only rows that came from an import need this. A movement typed into the app
-- has no fingerprint and cannot be re-created by one.
CREATE TABLE deleted_imports (
  import_fingerprint TEXT    NOT NULL,
  import_seq         INTEGER NOT NULL,
  deleted_at         TEXT    NOT NULL,

  PRIMARY KEY (import_fingerprint, import_seq)
);
