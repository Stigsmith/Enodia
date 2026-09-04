CREATE TABLE `curated_pick` (
	`build_id` text PRIMARY KEY NOT NULL,
	`note` text NOT NULL,
	`at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`build_id`) REFERENCES `published_build`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `exchange_stat` (
	`build_id` text NOT NULL,
	`user_id` text NOT NULL,
	`taken_at` integer,
	`runs` integer DEFAULT 0 NOT NULL,
	`clears` integer DEFAULT 0 NOT NULL,
	`best_fear` integer,
	`rating` integer,
	`updated` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`build_id`, `user_id`),
	FOREIGN KEY (`build_id`) REFERENCES `published_build`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `exchange_stat_build_idx` ON `exchange_stat` (`build_id`);--> statement-breakpoint
CREATE INDEX `published_build_createdAt_idx` ON `published_build` (`created_at`);