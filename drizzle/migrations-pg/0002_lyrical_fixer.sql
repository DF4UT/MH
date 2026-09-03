ALTER TABLE "posts" ADD COLUMN "pinned" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "title_sort" text DEFAULT '' NOT NULL;