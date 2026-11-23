CREATE TABLE `health_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`species` text NOT NULL,
	`interval_days` integer,
	`puppy_doses` integer,
	`puppy_interval_days` integer,
	`required` integer DEFAULT 0 NOT NULL,
	`recommended` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `health` ADD `catalog_id` text REFERENCES health_catalog(id);--> statement-breakpoint
ALTER TABLE `health` ADD `manufacturer` text;--> statement-breakpoint
ALTER TABLE `health` ADD `lot` text;--> statement-breakpoint
ALTER TABLE `health` ADD `vet_name` text;--> statement-breakpoint
ALTER TABLE `health` ADD `crmv` text;--> statement-breakpoint
ALTER TABLE `health` ADD `dose_number` integer;
