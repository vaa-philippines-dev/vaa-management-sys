-- Phase ZT migration: adds ASSIGNMENT to SyncEntityType, backing the DMF
-- sheet import's VA Preparation / Performance Monitoring row -> Assignment
-- matching (source "dmf_sheet" in external_sync_mappings).
ALTER TYPE "SyncEntityType" ADD VALUE 'ASSIGNMENT';
