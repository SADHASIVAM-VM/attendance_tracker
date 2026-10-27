ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "revocation_reason" text;
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp with time zone;
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "revoked_by" uuid REFERENCES "users"("id");
