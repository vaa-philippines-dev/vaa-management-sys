-- Phase ZZB: notify a department's managers when a VA's DMF availability
-- review (the 30-day UPDATE STATUS DATE) comes due.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AVAILABILITY_REVIEW_DUE';
