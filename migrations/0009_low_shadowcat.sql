-- Hand corrected, and the correction is the point.
--
-- drizzle-kit generated `SELECT ..., "shape" FROM exchange_stat`, selecting a
-- column that does not exist on the table being copied from, because `shape` is
-- new on the rebuilt table. SQLite does not error on that: a double-quoted
-- identifier that matches no column falls back to being a string literal, so
-- every existing row was given the text 'shape' instead of ''.
--
-- Measured on a real row before this was fixed. Nothing was lost and the
-- migration reported success, which is what makes it the dangerous kind of
-- wrong: `published_build.shape` defaults to '' and a stat row carrying 'shape'
-- would never match it, so every count earned to date would have been filed
-- under a previous version of its build the moment this shipped.
--
-- An empty string is what a row from before shapes existed should carry, so
-- that it matches the build's own default and stays a current count.

PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_exchange_stat` (
	`build_id` text NOT NULL,
	`user_id` text NOT NULL,
	`taken_at` integer,
	`runs` integer DEFAULT 0 NOT NULL,
	`clears` integer DEFAULT 0 NOT NULL,
	`best_fear` integer,
	`rating` integer,
	`updated` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`shape` text DEFAULT '' NOT NULL,
	PRIMARY KEY(`build_id`, `user_id`, `shape`),
	FOREIGN KEY (`build_id`) REFERENCES `published_build`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_exchange_stat`("build_id", "user_id", "taken_at", "runs", "clears", "best_fear", "rating", "updated", "shape") SELECT "build_id", "user_id", "taken_at", "runs", "clears", "best_fear", "rating", "updated", '' FROM `exchange_stat`;--> statement-breakpoint
DROP TABLE `exchange_stat`;--> statement-breakpoint
ALTER TABLE `__new_exchange_stat` RENAME TO `exchange_stat`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `exchange_stat_build_idx` ON `exchange_stat` (`build_id`);--> statement-breakpoint
ALTER TABLE `published_build` ADD `shape` text DEFAULT '' NOT NULL;