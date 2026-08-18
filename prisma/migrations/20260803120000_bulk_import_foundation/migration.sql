-- =============================================================================
-- Migration: 20260803120000_bulk_import_foundation
-- Smart Vyapar Bulk Import Engine Foundation Tables
-- =============================================================================

CREATE TABLE "ImportJob" (
    "id"                  TEXT NOT NULL PRIMARY KEY,
    "importType"          TEXT NOT NULL,
    "fileName"            TEXT NOT NULL,
    "fileHash"            TEXT NOT NULL,
    "fileSize"            INTEGER NOT NULL,
    "worksheetName"       TEXT,
    "status"              TEXT NOT NULL,
    "duplicatePolicy"     TEXT NOT NULL,
    "transactionMode"     TEXT NOT NULL,
    "totalRows"           INTEGER NOT NULL DEFAULT 0,
    "validRows"           INTEGER NOT NULL DEFAULT 0,
    "invalidRows"         INTEGER NOT NULL DEFAULT 0,
    "duplicateRows"       INTEGER NOT NULL DEFAULT 0,
    "insertedRows"        INTEGER NOT NULL DEFAULT 0,
    "updatedRows"         INTEGER NOT NULL DEFAULT 0,
    "skippedRows"         INTEGER NOT NULL DEFAULT 0,
    "failedRows"          INTEGER NOT NULL DEFAULT 0,
    "startedAt"           TEXT,
    "completedAt"         TEXT,
    "cancelledAt"         TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "errorSummary"        TEXT,
    "appVersion"          TEXT NOT NULL,
    CHECK ("status" IN ('CREATED','FILE_PARSED','VALIDATED','READY','PROCESSING','COMPLETED','COMPLETED_WITH_ERRORS','FAILED','CANCELLED')),
    CHECK ("duplicatePolicy" IN ('SKIP_DUPLICATES','UPDATE_EXISTING','FAIL_ON_DUPLICATE')),
    CHECK ("transactionMode" IN ('ATOMIC_ALL_OR_NOTHING','VALID_ROWS_ONLY'))
);

CREATE TABLE "ImportJobRow" (
    "id"                  TEXT NOT NULL PRIMARY KEY,
    "importJobId"         TEXT NOT NULL,
    "rowNumber"           INTEGER NOT NULL,
    "sourceKey"           TEXT,
    "normalizedSourceKey" TEXT,
    "rowHash"             TEXT NOT NULL,
    "status"              TEXT NOT NULL,
    "action"              TEXT NOT NULL,
    "errorCode"           TEXT,
    "errorMessage"        TEXT,
    "sourceDataJson"      TEXT NOT NULL,
    "normalizedDataJson"  TEXT,
    "resultRecordId"      TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE,
    CHECK ("status" IN ('PENDING','VALID','INVALID','DUPLICATE_IN_FILE','DUPLICATE_IN_DATABASE','INSERTED','UPDATED','SKIPPED','FAILED')),
    CHECK ("action" IN ('INSERT','UPDATE','SKIP','REJECT'))
);

CREATE TABLE "ImportTemplate" (
    "id"                  TEXT NOT NULL PRIMARY KEY,
    "importType"          TEXT NOT NULL,
    "templateVersion"     TEXT NOT NULL,
    "columnDefinitionJson" TEXT NOT NULL,
    "isActive"            INTEGER NOT NULL DEFAULT 1,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL
);

-- Performance and constraint indexes
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");
CREATE INDEX "ImportJob_importType_idx" ON "ImportJob"("importType");

CREATE INDEX "ImportJobRow_importJobId_idx" ON "ImportJobRow"("importJobId");
CREATE INDEX "ImportJobRow_status_idx" ON "ImportJobRow"("status");
CREATE INDEX "ImportJobRow_action_idx" ON "ImportJobRow"("action");
CREATE UNIQUE INDEX "ImportJobRow_job_row_key" ON "ImportJobRow"("importJobId", "rowNumber");

CREATE UNIQUE INDEX "ImportTemplate_type_version_key" ON "ImportTemplate"("importType", "templateVersion");
CREATE INDEX "ImportTemplate_isActive_idx" ON "ImportTemplate"("isActive");
