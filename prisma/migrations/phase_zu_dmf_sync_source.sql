-- Phase ZU migration: adds DMF_SYNC to AssignmentSource, tagging Assignment
-- rows the DMF sheet import created (as opposed to entered manually or
-- synced from VAConnections) when a VA Preparation/Performance Monitoring
-- row had no existing Assignment to attach to.
ALTER TYPE "AssignmentSource" ADD VALUE 'DMF_SYNC';
