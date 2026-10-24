CREATE TABLE "site_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"worksite_id" uuid NOT NULL,
	"supervisor_id" uuid NOT NULL,
	"amount" double precision NOT NULL,
	"category" varchar(50) NOT NULL,
	"applies_to_type" varchar(50) DEFAULT 'LOCATION' NOT NULL,
	"worker_id" uuid,
	"worker_name" varchar(255),
	"note" text NOT NULL,
	"receipt_url" text,
	"date" date NOT NULL,
	"time" varchar(20) NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supervisor_location_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"supervisor_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"location_name_snapshot" varchar(255) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"start_latitude" double precision,
	"start_longitude" double precision,
	"end_latitude" double precision,
	"end_longitude" double precision,
	"gps_accuracy_meters" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_events" ADD COLUMN "is_location_bypassed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD COLUMN "is_auto_approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD COLUMN "auto_approval_reason" text;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD COLUMN "approval_source" varchar(50) DEFAULT 'MANUAL';--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD COLUMN "total_duration_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD COLUMN "net_working_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD COLUMN "active_location_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD COLUMN "active_location_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD COLUMN "clock_in_latitude" double precision;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD COLUMN "clock_in_longitude" double precision;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD COLUMN "clock_in_accuracy" double precision;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD COLUMN "clock_out_latitude" double precision;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD COLUMN "clock_out_longitude" double precision;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD COLUMN "clock_out_accuracy" double precision;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "supervisor_auto_approve" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "supervisor_bypass_location" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "site_assignments" ADD COLUMN "carry_forward" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "site_assignments" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "site_expenses" ADD CONSTRAINT "site_expenses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_expenses" ADD CONSTRAINT "site_expenses_worksite_id_worksites_id_fk" FOREIGN KEY ("worksite_id") REFERENCES "public"."worksites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_expenses" ADD CONSTRAINT "site_expenses_supervisor_id_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_expenses" ADD CONSTRAINT "site_expenses_worker_id_users_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_location_visits" ADD CONSTRAINT "supervisor_location_visits_session_id_attendance_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."attendance_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_location_visits" ADD CONSTRAINT "supervisor_location_visits_supervisor_id_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_location_visits" ADD CONSTRAINT "supervisor_location_visits_location_id_worksites_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."worksites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_active_location_id_worksites_id_fk" FOREIGN KEY ("active_location_id") REFERENCES "public"."worksites"("id") ON DELETE no action ON UPDATE no action;