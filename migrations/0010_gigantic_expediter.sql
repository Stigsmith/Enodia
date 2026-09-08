CREATE TABLE `build_facet` (
	`build_id` text NOT NULL,
	`facet` text NOT NULL,
	PRIMARY KEY(`build_id`, `facet`),
	FOREIGN KEY (`build_id`) REFERENCES `published_build`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `build_facet_facet_idx` ON `build_facet` (`facet`);