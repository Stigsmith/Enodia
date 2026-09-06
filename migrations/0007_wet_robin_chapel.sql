ALTER TABLE `published_build` ADD `updated_at` integer;--> statement-breakpoint
ALTER TABLE `published_build` ADD `revision` integer DEFAULT 0 NOT NULL;