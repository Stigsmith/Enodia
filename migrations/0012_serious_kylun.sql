CREATE TABLE `guide` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer,
	`revision` integer DEFAULT 0 NOT NULL,
	`taken_down_at` integer,
	`hidden_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `guide_userId_idx` ON `guide` (`user_id`);--> statement-breakpoint
CREATE INDEX `guide_createdAt_idx` ON `guide` (`created_at`);--> statement-breakpoint
CREATE TABLE `guide_build` (
	`guide_id` text NOT NULL,
	`build_id` text NOT NULL,
	`shape` text DEFAULT '' NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`guide_id`, `build_id`),
	FOREIGN KEY (`guide_id`) REFERENCES `guide`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `guide_report` (
	`guide_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`guide_id`, `user_id`),
	FOREIGN KEY (`guide_id`) REFERENCES `guide`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `guide_stat` (
	`guide_id` text NOT NULL,
	`user_id` text NOT NULL,
	`saved_at` integer,
	`liked_at` integer,
	`updated` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`guide_id`, `user_id`),
	FOREIGN KEY (`guide_id`) REFERENCES `guide`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `guide_stat_user_idx` ON `guide_stat` (`user_id`);