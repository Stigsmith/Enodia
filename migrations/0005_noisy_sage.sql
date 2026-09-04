CREATE TABLE `sync_item` (
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`item_id` text NOT NULL,
	`payload` text NOT NULL,
	`modified` integer NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`user_id`, `kind`, `item_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sync_item_since_idx` ON `sync_item` (`user_id`,`modified`);