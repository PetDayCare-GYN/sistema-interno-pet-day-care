ALTER TABLE `privacy_jobs` ADD `processed_files` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `privacy_jobs` ADD `backup_cursor` text;