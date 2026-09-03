ALTER TABLE `posts` ADD `pinned` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `title_sort` text DEFAULT '' NOT NULL;