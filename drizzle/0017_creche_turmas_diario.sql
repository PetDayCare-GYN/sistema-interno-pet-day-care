ALTER TABLE `activities` ADD `value` text;--> statement-breakpoint
CREATE TABLE `turmas` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`size` text,
	`temperament` text,
	`capacity` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "turma_capacity_positive" CHECK(`capacity`>0)
);--> statement-breakpoint
ALTER TABLE `appointments` ADD `turma_id` text REFERENCES turmas(id);--> statement-breakpoint
CREATE INDEX `appointment_turma_period` ON `appointments` (`turma_id`,`start_at`,`end_at`);--> statement-breakpoint
CREATE TABLE `adaptations` (
	`id` text PRIMARY KEY NOT NULL,
	`pet_id` text NOT NULL REFERENCES pets(id),
	`result` text NOT NULL,
	`notes` text,
	`actor_id` text NOT NULL REFERENCES users(id),
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "adaptation_result_valid" CHECK(`result` IN ('aprovado','ressalvas','nao_recomendado'))
);--> statement-breakpoint
CREATE INDEX `adaptation_pet` ON `adaptations` (`pet_id`);
