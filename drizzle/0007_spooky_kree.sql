CREATE INDEX `appointment_pet_period` ON `appointments` (`pet_id`,`start_at`,`end_at`);--> statement-breakpoint
CREATE INDEX `appointment_service_period` ON `appointments` (`service_id`,`start_at`,`end_at`);--> statement-breakpoint
CREATE INDEX `appointment_staff_period` ON `appointments` (`user_id`,`start_at`,`end_at`);--> statement-breakpoint
CREATE INDEX `order_items_order` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_items_product` ON `order_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `payment_invoice` ON `payments` (`invoice_id`);