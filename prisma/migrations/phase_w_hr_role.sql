-- Phase W: add HR to SystemRole enum.

ALTER TYPE "public"."SystemRole" ADD VALUE IF NOT EXISTS 'HR';
