-- Phase X: add BLACKLISTED to GeneralStatus enum.

ALTER TYPE "public"."GeneralStatus" ADD VALUE IF NOT EXISTS 'BLACKLISTED';
