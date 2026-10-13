PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_backups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`object_key` text NOT NULL,
	`actor_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_backups`("id", "name", "object_key", "actor_id", "created_at") SELECT "id", "name", "object_key", "actor_id", "created_at" FROM `backups`;--> statement-breakpoint
DROP TABLE `backups`;--> statement-breakpoint
ALTER TABLE `__new_backups` RENAME TO `backups`;--> statement-breakpoint
PRAGMA foreign_keys=ON;