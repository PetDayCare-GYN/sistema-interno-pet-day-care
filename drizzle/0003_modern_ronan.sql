CREATE TABLE `alert_states` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`priority` text NOT NULL,
	`user_id` text,
	`status` text NOT NULL,
	`snooze_until` text,
	`notes` text,
	`actor_id` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `brands` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brands_name_unique` ON `brands` (`name`);--> statement-breakpoint
CREATE TABLE `cash_closures` (
	`id` text PRIMARY KEY NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`opening_cents` integer NOT NULL,
	`expected_cents` integer NOT NULL,
	`counted_cents` integer NOT NULL,
	`snapshot` text NOT NULL,
	`status` text DEFAULT 'closed' NOT NULL,
	`reason` text,
	`actor_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "cash_closure_valid" CHECK("cash_closures"."period_end">="cash_closures"."period_start")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cash_closure_period` ON `cash_closures` (`period_start`,`period_end`);--> statement-breakpoint
CREATE TABLE `financial_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `financial_categories_name_unique` ON `financial_categories` (`name`);--> statement-breakpoint
CREATE TABLE `inventory_counts` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`lot_id` text,
	`expected` integer NOT NULL,
	`counted` integer NOT NULL,
	`reason` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lot_id`) REFERENCES `lots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "count_positive" CHECK("inventory_counts"."counted">=0 AND "inventory_counts"."expected">=0)
);
--> statement-breakpoint
CREATE TABLE `order_returns` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`original_invoice_cents` integer NOT NULL,
	`settled_cents` integer NOT NULL,
	`reason` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_returns_order_id_unique` ON `order_returns` (`order_id`);--> statement-breakpoint
CREATE TABLE `package_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`units` integer NOT NULL,
	`reason` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "adjustment_nonzero" CHECK("package_adjustments"."units"!=0)
);
--> statement-breakpoint
CREATE TABLE `payroll` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`rule` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payroll_valid" CHECK("payroll"."amount_cents">0 AND "payroll"."period_end">="payroll"."period_start" AND "payroll"."kind" IN ('salary','bonus'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_origin` ON `payroll` (`user_id`,`kind`,`period_start`,`period_end`);--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "shift_period" CHECK("shifts"."end_at">"shifts"."start_at")
);
--> statement-breakpoint
ALTER TABLE `appointments` ADD `coat_condition` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `performed_services` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `entry_notes` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `exit_notes` text;--> statement-breakpoint
ALTER TABLE `backups` ADD `status` text DEFAULT 'logical' NOT NULL;--> statement-breakpoint
ALTER TABLE `backups` ADD `file_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `backups` ADD `copied_files` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `backups` ADD `verified_at` text;--> statement-breakpoint
ALTER TABLE `commissions` ADD `reversed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `communications` ADD `health_id` text REFERENCES health(id);--> statement-breakpoint
ALTER TABLE `communications` ADD `return_notes` text;--> statement-breakpoint
ALTER TABLE `communications` ADD `return_at` text;--> statement-breakpoint
ALTER TABLE `files` ADD `appointment_id` text REFERENCES appointments(id);--> statement-breakpoint
ALTER TABLE `files` ADD `activity_id` text REFERENCES activities(id);--> statement-breakpoint
ALTER TABLE `files` ADD `removed_at` text;--> statement-breakpoint
ALTER TABLE `infrastructure` ADD `description` text;--> statement-breakpoint
ALTER TABLE `infrastructure` ADD `dependencies` text;--> statement-breakpoint
ALTER TABLE `infrastructure` ADD `maintenance` text;--> statement-breakpoint
ALTER TABLE `infrastructure` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `category_id` text REFERENCES financial_categories(id);--> statement-breakpoint
ALTER TABLE `invoices` ADD `party_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `invoices` ADD `original_amount_cents` integer;--> statement-breakpoint
ALTER TABLE `order_items` ADD `cost_cents` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `description` text;--> statement-breakpoint
ALTER TABLE `products` ADD `brand_id` text REFERENCES brands(id);--> statement-breakpoint
ALTER TABLE `services` ADD `cancel_credit` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `no_show_credit` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `cancellation_fee_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `no_show_fee_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_events` ADD `kind` text DEFAULT 'adjustment' NOT NULL;--> statement-breakpoint
ALTER TABLE `tutors` ADD `anonymized_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `job_title` text;--> statement-breakpoint
ALTER TABLE `users` ADD `commission_period` text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `commission_condition` text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `bonus_kind` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `bonus_value` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `bonus_target` integer DEFAULT 0 NOT NULL;