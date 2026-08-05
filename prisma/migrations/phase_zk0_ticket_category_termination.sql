-- Run before phase_zk_termination_workflow.sql — separated because
-- ALTER TYPE ... ADD VALUE cannot share a transaction with statements that
-- reference the new enum value.

ALTER TYPE "TicketCategory" ADD VALUE IF NOT EXISTS 'TERMINATION';
