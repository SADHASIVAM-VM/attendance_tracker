CREATE TABLE "attendance_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"supervisor_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"shift_name" varchar(100) NOT NULL,
	"shift_start_time" varchar(10) NOT NULL,
	"grace_period_minutes" integer DEFAULT 15 NOT NULL,
	"grace_period_expires_at" timestamp with time zone NOT NULL,
	"flag_status" varchar(50) DEFAULT 'PENDING_REVIEW' NOT NULL,
	"reason" varchar(100),
	"note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"resolved_by_clock_in" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_flags" ADD CONSTRAINT "attendance_flags_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_flags" ADD CONSTRAINT "attendance_flags_assignment_id_site_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."site_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_flags" ADD CONSTRAINT "attendance_flags_worker_id_users_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_flags" ADD CONSTRAINT "attendance_flags_supervisor_id_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_flags" ADD CONSTRAINT "attendance_flags_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;