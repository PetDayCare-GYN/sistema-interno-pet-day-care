CREATE TABLE `backup_files` (
	`id` text PRIMARY KEY NOT NULL,
	`backup_id` text NOT NULL,
	`file_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`backup_id`) REFERENCES `backups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `backup_file_origin` ON `backup_files` (`backup_id`,`file_id`);