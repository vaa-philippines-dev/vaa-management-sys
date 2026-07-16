-- Phase Y: add UNIDENTIFIED to GeneralStatus enum.

ALTER TYPE "public"."GeneralStatus" ADD VALUE IF NOT EXISTS 'UNIDENTIFIED';
