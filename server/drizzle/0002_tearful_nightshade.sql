ALTER TABLE "users" ADD COLUMN "personal_email" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dob" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gender" varchar(30);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "blood_group" varchar(10);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "current_address" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "permanent_address" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "emergency_contact_name" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "emergency_contact_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_phone_unique" UNIQUE("phone");