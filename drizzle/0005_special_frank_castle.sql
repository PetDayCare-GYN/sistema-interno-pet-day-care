CREATE TABLE `maintenance_locks` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `privacy_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`tutor_id` text NOT NULL,
	`status` text NOT NULL,
	`files` text NOT NULL,
	`purge_backups` integer DEFAULT 0 NOT NULL,
	`reason` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`tutor_id`) REFERENCES `tutors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `audit` ADD `details` text;--> statement-breakpoint
ALTER TABLE `files` ADD `archive_hash` text;--> statement-breakpoint
ALTER TABLE `files` ADD `archive_crc32` integer;--> statement-breakpoint
ALTER TABLE `files` ADD `document_type` text;--> statement-breakpoint
ALTER TABLE `users` ADD `commission_pay_after_period` integer DEFAULT 0 NOT NULL;