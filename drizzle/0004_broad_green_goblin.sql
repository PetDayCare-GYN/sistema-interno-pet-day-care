CREATE TABLE `commission_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`funding_type` text NOT NULL,
	`funding_id` text NOT NULL,
	`condition` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`rule` text NOT NULL,
	`reversed` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `candidate_origin` ON `commission_candidates` (`user_id`,`source_type`,`source_id`);