-- Phase ZN migration: FB-0006 (2026-09 HR feedback) — the official
-- TEMPLATE VAA PH | EXIT CLEARANCE FORM's "TYPE OF SEPARATION" and "Eligible
-- for Rehire" fields, added onto terminations as a manual reclassification
-- independent of the existing TerminationType/isVoluntaryResignation fields.

CREATE TYPE "SeparationOutcome" AS ENUM ('CUSTOMER_RESIGNATION_ONLY', 'EOC_TOC', 'CUSTOMER_AND_OR_VAA_RESIGNATION', 'COMPANY_INITIATED_REMOVAL', 'AWOL', 'UNRESPONSIVE', 'OTHER');
CREATE TYPE "RehireEligibility" AS ENUM ('YES', 'NO', 'SUBJECT_TO_MANAGEMENT_REVIEW');

ALTER TABLE "terminations" ADD COLUMN IF NOT EXISTS "separation_outcome" "SeparationOutcome";
ALTER TABLE "terminations" ADD COLUMN IF NOT EXISTS "separation_outcome_other_note" TEXT;
ALTER TABLE "terminations" ADD COLUMN IF NOT EXISTS "rehire_eligibility" "RehireEligibility";
