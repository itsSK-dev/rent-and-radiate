-- 1. Extend refund_status enum
ALTER TYPE public.refund_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE public.refund_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE public.refund_status ADD VALUE IF NOT EXISTS 'failed';
