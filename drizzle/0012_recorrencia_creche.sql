ALTER TABLE `appointments` ADD `recurrence_id` text;--> statement-breakpoint
CREATE INDEX `appointment_recurrence` ON `appointments` (`recurrence_id`);
