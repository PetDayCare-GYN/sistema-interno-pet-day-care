CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`pet_id` text NOT NULL,
	`appointment_id` text,
	`kind` text NOT NULL,
	`notes` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`pet_id`) REFERENCES `pets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`pet_id` text NOT NULL,
	`service_id` text NOT NULL,
	`user_id` text,
	`package_id` text,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`quote_cents` integer NOT NULL,
	`base_cents` integer NOT NULL,
	`extras` text DEFAULT '[]' NOT NULL,
	`extras_cents` integer DEFAULT 0 NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`credit_units` integer DEFAULT 1 NOT NULL,
	`pricing` text NOT NULL,
	`actual_in` text,
	`actual_out` text,
	`delivered_by` text,
	`collected_by` text,
	`belongings` text,
	`instructions` text,
	`notes` text,
	`actor_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`pet_id`) REFERENCES `pets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "appointment_valid" CHECK("appointments"."end_at">"appointments"."start_at" AND "appointments"."quote_cents">=0 AND "appointments"."credit_units">0 AND "appointments"."status" IN ('scheduled','confirmed','in_progress','completed','cancelled','no_show','waitlist'))
);
--> statement-breakpoint
CREATE INDEX `appointment_period` ON `appointments` (`start_at`,`end_at`);--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`record_id` text,
	`reason` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `backups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`object_key` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `commissions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`rule` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commission_origin` ON `commissions` (`user_id`,`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `communications` (
	`id` text PRIMARY KEY NOT NULL,
	`tutor_id` text NOT NULL,
	`kind` text NOT NULL,
	`notes` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`tutor_id`) REFERENCES `tutors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`pet_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`relationship` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`pet_id`) REFERENCES `pets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `credit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`appointment_id` text NOT NULL,
	`units` integer NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_events_appointment_id_unique` ON `credit_events` (`appointment_id`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`pet_id` text,
	`health_id` text,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`pet_id`) REFERENCES `pets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`health_id`) REFERENCES `health`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `health` (
	`id` text PRIMARY KEY NOT NULL,
	`pet_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`applied_date` text NOT NULL,
	`due_date` text NOT NULL,
	`proof_status` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`pet_id`) REFERENCES `pets`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "health_period" CHECK("health"."due_date">="health"."applied_date")
);
--> statement-breakpoint
CREATE TABLE `infrastructure` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`url` text,
	`provider` text,
	`status` text NOT NULL,
	`owner` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`tutor_id` text,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`due_date` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`tutor_id`) REFERENCES `tutors`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "invoice_positive" CHECK("invoices"."amount_cents">=0 AND "invoices"."kind" IN ('receivable','payable'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_origin` ON `invoices` (`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `lots` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`expires_date` text,
	`stock` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "lot_positive" CHECK("lots"."stock">=0)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`lot_id` text,
	`quantity` integer NOT NULL,
	`unit_cents` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lot_id`) REFERENCES `lots`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "item_positive" CHECK("order_items"."quantity">0 AND "order_items"."unit_cents">=0)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`tutor_id` text,
	`pet_id` text,
	`supplier_id` text,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_cents` integer NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`tutor_id`) REFERENCES `tutors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pet_id`) REFERENCES `pets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "order_valid" CHECK("orders"."total_cents">=0 AND "orders"."kind" IN ('sale','purchase'))
);
--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`settings` text NOT NULL,
	`theme` text NOT NULL,
	`technical_hash` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `package_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`service_id` text NOT NULL,
	`credits` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`valid_days` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "template_positive" CHECK("package_templates"."credits">0 AND "package_templates"."price_cents">=0 AND "package_templates"."valid_days">0)
);
--> statement-breakpoint
CREATE TABLE `packages` (
	`id` text PRIMARY KEY NOT NULL,
	`pet_id` text NOT NULL,
	`template_id` text NOT NULL,
	`service_id` text NOT NULL,
	`name` text NOT NULL,
	`credits` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`expires_at` text NOT NULL,
	`balance` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`pet_id`) REFERENCES `pets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `package_templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "package_balance" CHECK("packages"."balance">=0 AND "packages"."balance"<="packages"."credits")
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`method` text NOT NULL,
	`reason` text,
	`actor_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payment_not_zero" CHECK("payments"."amount_cents"!=0)
);
--> statement-breakpoint
CREATE TABLE `pets` (
	`id` text PRIMARY KEY NOT NULL,
	`tutor_id` text NOT NULL,
	`name` text NOT NULL,
	`species` text NOT NULL,
	`breed` text,
	`size` text NOT NULL,
	`coat` text,
	`birth_date` text,
	`weight` real,
	`behavior` text,
	`allergies` text,
	`diet` text,
	`medication` text,
	`emergency` text,
	`notes` text,
	`photo_id` text,
	`archived` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`tutor_id`) REFERENCES `tutors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`supplier_id` text,
	`name` text NOT NULL,
	`brand` text,
	`sku` text NOT NULL,
	`barcode` text,
	`unit` text NOT NULL,
	`cost_cents` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`min_stock` integer NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`storage` text,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "product_positive" CHECK("products"."stock">=0 AND "products"."cost_cents">=0 AND "products"."price_cents">=0 AND "products"."min_stock">=0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE TABLE `request_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`service_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`size` text NOT NULL,
	`price_cents` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "season_period" CHECK("seasons"."end_date">="seasons"."start_date" AND "seasons"."price_cents">=0)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`price_cents` integer,
	`duration_minutes` integer NOT NULL,
	`capacity` integer NOT NULL,
	`active` integer DEFAULT 0 NOT NULL,
	`boarding_policy` text,
	`tolerance_minutes` integer DEFAULT 0 NOT NULL,
	`extra_hour_cents` integer,
	`partial_policy` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	CONSTRAINT "service_positive" CHECK("services"."capacity">0 AND "services"."duration_minutes">0 AND ("services"."price_cents" IS NULL OR "services"."price_cents">=0))
);
--> statement-breakpoint
CREATE TABLE `stock_events` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`lot_id` text,
	`order_item_id` text,
	`quantity` integer NOT NULL,
	`reason` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lot_id`) REFERENCES `lots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "movement_not_zero" CHECK("stock_events"."quantity"!=0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_events_order_item_id_unique` ON `stock_events` (`order_item_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`due_date` text NOT NULL,
	`user_id` text,
	`priority` text NOT NULL,
	`status` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tutors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`address` text,
	`emergency` text,
	`notes` text,
	`archived` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tutors_phone_unique` ON `tutors` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `tutors_email_unique` ON `tutors` (`email`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_id` text,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`permissions` text DEFAULT '{}' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`salary_cents` integer DEFAULT 0 NOT NULL,
	`commission_kind` text DEFAULT 'none' NOT NULL,
	`commission_value` integer DEFAULT 0 NOT NULL,
	`commission_basis` text DEFAULT 'charged' NOT NULL,
	`commission_services` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_identity_id_unique` ON `users` (`identity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE TRIGGER appointment_insert_guard BEFORE INSERT ON appointments WHEN NEW.status!='waitlist' BEGIN
 SELECT CASE WHEN (SELECT active FROM services WHERE id=NEW.service_id)!=1 THEN RAISE(ABORT,'Serviço inativo') END;
 SELECT CASE WHEN (SELECT archived FROM pets WHERE id=NEW.pet_id)!=0 THEN RAISE(ABORT,'Pet arquivado') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM appointments WHERE pet_id=NEW.pet_id AND status IN ('scheduled','confirmed','in_progress') AND start_at<NEW.end_at AND end_at>NEW.start_at) THEN RAISE(ABORT,'Pet já possui reserva neste intervalo') END;
 SELECT CASE WHEN NEW.user_id IS NOT NULL AND (SELECT kind FROM services WHERE id=NEW.service_id)='grooming' AND EXISTS(SELECT 1 FROM appointments a JOIN services s ON s.id=a.service_id WHERE a.user_id=NEW.user_id AND s.kind='grooming' AND a.status IN ('scheduled','confirmed','in_progress') AND a.start_at<NEW.end_at AND a.end_at>NEW.start_at) THEN RAISE(ABORT,'Profissional indisponível neste intervalo') END;
 SELECT CASE WHEN (SELECT MAX((SELECT COUNT(*) FROM appointments a JOIN services s ON s.id=a.service_id WHERE s.kind=(SELECT kind FROM services WHERE id=NEW.service_id) AND a.status IN ('scheduled','confirmed','in_progress') AND a.start_at<=points.moment AND a.end_at>points.moment)) FROM (SELECT NEW.start_at AS moment UNION SELECT a.start_at FROM appointments a JOIN services s ON s.id=a.service_id WHERE s.kind=(SELECT kind FROM services WHERE id=NEW.service_id) AND a.start_at>=NEW.start_at AND a.start_at<NEW.end_at AND a.status IN ('scheduled','confirmed','in_progress')) points)>=COALESCE((SELECT CAST(json_extract(settings,'$.capacities.'||(SELECT kind FROM services WHERE id=NEW.service_id)) AS INTEGER) FROM organization LIMIT 1),0) THEN RAISE(ABORT,'Capacidade da modalidade excedida ou não configurada') END;
 SELECT CASE WHEN NEW.package_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM packages WHERE id=NEW.package_id AND pet_id=NEW.pet_id AND service_id=NEW.service_id AND balance>=NEW.credit_units AND expires_at>=NEW.end_at) THEN RAISE(ABORT,'Pacote incompatível, vencido ou sem saldo') END;
END;
--> statement-breakpoint
CREATE TRIGGER appointment_transition BEFORE UPDATE ON appointments BEGIN
 SELECT CASE WHEN OLD.status IN ('completed','cancelled','no_show') THEN RAISE(ABORT,'Atendimento encerrado é imutável') END;
 SELECT CASE WHEN NEW.pet_id!=OLD.pet_id OR NEW.service_id!=OLD.service_id OR NEW.start_at!=OLD.start_at OR NEW.end_at!=OLD.end_at OR NEW.package_id IS NOT OLD.package_id THEN RAISE(ABORT,'Reagende cancelando a reserva anterior') END;
 SELECT CASE WHEN NOT (NEW.status=OLD.status OR (OLD.status IN ('scheduled','confirmed') AND NEW.status IN ('confirmed','in_progress','cancelled','no_show')) OR (OLD.status='in_progress' AND NEW.status IN ('completed','cancelled'))) THEN RAISE(ABORT,'Transição de atendimento inválida') END;
 SELECT CASE WHEN NEW.status='completed' AND (NEW.actual_in IS NULL OR NEW.actual_out IS NULL OR NEW.actual_out<NEW.actual_in) THEN RAISE(ABORT,'Entrada e saída válidas são obrigatórias') END;
 SELECT CASE WHEN NEW.status='completed' AND NEW.package_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM packages WHERE id=NEW.package_id AND balance>=NEW.credit_units AND expires_at>=NEW.actual_out) THEN RAISE(ABORT,'Pacote sem saldo ou vencido') END;
 SELECT CASE WHEN NEW.status='in_progress' AND OLD.status!='in_progress' AND (SELECT COUNT(*) FROM appointments a JOIN services s ON s.id=a.service_id WHERE a.status='in_progress' AND s.kind=(SELECT kind FROM services WHERE id=NEW.service_id))>=COALESCE((SELECT CAST(json_extract(settings,'$.capacities.'||(SELECT kind FROM services WHERE id=NEW.service_id)) AS INTEGER) FROM organization LIMIT 1),0) THEN RAISE(ABORT,'Capacidade atual excedida para entrada') END;
 SELECT CASE WHEN NEW.status='in_progress' AND OLD.status!='in_progress' AND EXISTS(SELECT 1 FROM appointments WHERE pet_id=NEW.pet_id AND status='in_progress' AND id!=NEW.id) THEN RAISE(ABORT,'Pet já está em atendimento') END;
END;
--> statement-breakpoint
CREATE TRIGGER credit_consume AFTER INSERT ON credit_events BEGIN
 UPDATE packages SET balance=balance-NEW.units WHERE id=NEW.package_id;
END;
--> statement-breakpoint
CREATE TRIGGER appointment_complete AFTER UPDATE OF status ON appointments WHEN NEW.status='completed' AND OLD.status!='completed' BEGIN
 INSERT INTO credit_events(id,package_id,appointment_id,units,actor_id) SELECT NEW.id,NEW.package_id,NEW.id,NEW.credit_units,NEW.actor_id WHERE NEW.package_id IS NOT NULL;
 INSERT INTO invoices(id,kind,source_type,source_id,tutor_id,description,amount_cents,due_date) SELECT NEW.id,'receivable','appointment',NEW.id,p.tutor_id,'Atendimento · '||p.name||' · '||s.name,NEW.quote_cents,substr(NEW.actual_out,1,10) FROM pets p JOIN services s ON s.id=NEW.service_id WHERE p.id=NEW.pet_id AND NEW.quote_cents>0;
 INSERT INTO commissions(id,user_id,source_type,source_id,amount_cents,rule)
 SELECT NEW.id,u.id,'appointment',NEW.id,
 CASE WHEN u.commission_kind='fixed' THEN u.commission_value ELSE CAST(round((CASE WHEN u.commission_basis='allocated' AND NEW.package_id IS NOT NULL THEN (SELECT price_cents*1.0/credits*NEW.credit_units FROM packages WHERE id=NEW.package_id)+NEW.extras_cents-NEW.discount_cents ELSE NEW.quote_cents END)*u.commission_value/10000.0) AS INTEGER) END,
 json_object('kind',u.commission_kind,'value',u.commission_value,'basis',u.commission_basis,'service',NEW.service_id)
 FROM users u WHERE u.id=NEW.user_id AND u.commission_kind!='none' AND EXISTS(SELECT 1 FROM json_each(u.commission_services) WHERE value=NEW.service_id);
END;
--> statement-breakpoint
CREATE TRIGGER commission_invoice AFTER INSERT ON commissions WHEN NEW.amount_cents>0 BEGIN
 INSERT INTO invoices(id,kind,source_type,source_id,description,amount_cents,due_date) VALUES('commission-'||NEW.id,'payable','commission',NEW.id,'Comissão · '||(SELECT name FROM users WHERE id=NEW.user_id),NEW.amount_cents,substr(NEW.created_at,1,10));
END;
--> statement-breakpoint
CREATE TRIGGER package_invoice AFTER INSERT ON packages BEGIN
 INSERT INTO invoices(id,kind,source_type,source_id,tutor_id,description,amount_cents,due_date) SELECT NEW.id,'receivable','package',NEW.id,tutor_id,'Pacote · '||NEW.name,NEW.price_cents,substr(NEW.created_at,1,10) FROM pets WHERE id=NEW.pet_id;
END;
--> statement-breakpoint
CREATE TRIGGER stock_guard BEFORE INSERT ON stock_events BEGIN
 SELECT CASE WHEN (SELECT stock FROM products WHERE id=NEW.product_id)+NEW.quantity<0 THEN RAISE(ABORT,'Estoque insuficiente') END;
 SELECT CASE WHEN NEW.lot_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lots WHERE id=NEW.lot_id AND product_id=NEW.product_id AND stock+NEW.quantity>=0) THEN RAISE(ABORT,'Lote incompatível ou sem saldo') END;
 SELECT CASE WHEN NEW.lot_id IS NULL AND NEW.quantity<0 AND (SELECT stock FROM products WHERE id=NEW.product_id)-(SELECT COALESCE(SUM(stock),0) FROM lots WHERE product_id=NEW.product_id)+NEW.quantity<0 THEN RAISE(ABORT,'Selecione o lote desta saída') END;
END;
--> statement-breakpoint
CREATE TRIGGER stock_apply AFTER INSERT ON stock_events BEGIN
 UPDATE products SET stock=stock+NEW.quantity WHERE id=NEW.product_id;
 UPDATE lots SET stock=stock+NEW.quantity WHERE id=NEW.lot_id;
END;
--> statement-breakpoint
CREATE TRIGGER order_freeze BEFORE UPDATE ON orders WHEN OLD.status='posted' BEGIN SELECT RAISE(ABORT,'Pedido postado é imutável'); END;
--> statement-breakpoint
CREATE TRIGGER order_post AFTER UPDATE OF status ON orders WHEN NEW.status='posted' AND OLD.status='draft' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM order_items WHERE order_id=NEW.id) OR NEW.total_cents!=(SELECT SUM(quantity*unit_cents)-NEW.discount_cents FROM order_items WHERE order_id=NEW.id) THEN RAISE(ABORT,'Total ou itens inconsistentes') END;
 INSERT INTO stock_events(id,product_id,lot_id,order_item_id,quantity,reason,actor_id) SELECT id,product_id,lot_id,id,CASE WHEN NEW.kind='sale' THEN -quantity ELSE quantity END,NEW.kind,NEW.user_id FROM order_items WHERE order_id=NEW.id;
 INSERT INTO invoices(id,kind,source_type,source_id,tutor_id,description,amount_cents,due_date) VALUES(NEW.id,CASE WHEN NEW.kind='sale' THEN 'receivable' ELSE 'payable' END,NEW.kind,NEW.id,NEW.tutor_id,CASE WHEN NEW.kind='sale' THEN 'Venda de produtos' ELSE 'Compra de produtos' END,NEW.total_cents,substr(NEW.created_at,1,10));
 INSERT INTO commissions(id,user_id,source_type,source_id,amount_cents,rule) SELECT NEW.id,u.id,'sale',NEW.id,CASE WHEN u.commission_kind='fixed' THEN u.commission_value ELSE CAST(round(NEW.total_cents*u.commission_value/10000.0) AS INTEGER) END,json_object('kind',u.commission_kind,'value',u.commission_value,'basis','charged') FROM users u WHERE u.id=NEW.user_id AND NEW.kind='sale' AND u.commission_kind!='none' AND EXISTS(SELECT 1 FROM json_each(u.commission_services) WHERE value='products');
END;
--> statement-breakpoint
CREATE TRIGGER payment_guard BEFORE INSERT ON payments BEGIN
 SELECT CASE WHEN (SELECT COALESCE(SUM(amount_cents),0) FROM payments WHERE invoice_id=NEW.invoice_id)+NEW.amount_cents<0 OR (SELECT COALESCE(SUM(amount_cents),0) FROM payments WHERE invoice_id=NEW.invoice_id)+NEW.amount_cents>(SELECT amount_cents FROM invoices WHERE id=NEW.invoice_id) THEN RAISE(ABORT,'Pagamento excede o saldo ou estorno excede o recebido') END;
 SELECT CASE WHEN NEW.amount_cents<0 AND (NEW.reason IS NULL OR length(NEW.reason)<5) THEN RAISE(ABORT,'Justifique o estorno') END;
END;
--> statement-breakpoint
CREATE TRIGGER season_overlap_insert BEFORE INSERT ON seasons BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM seasons WHERE service_id=NEW.service_id AND size=NEW.size AND start_date<=NEW.end_date AND end_date>=NEW.start_date) THEN RAISE(ABORT,'Temporadas sobrepostas') END;
END;
--> statement-breakpoint
CREATE TRIGGER season_overlap_update BEFORE UPDATE ON seasons BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM seasons WHERE id!=NEW.id AND service_id=NEW.service_id AND size=NEW.size AND start_date<=NEW.end_date AND end_date>=NEW.start_date) THEN RAISE(ABORT,'Temporadas sobrepostas') END;
END;

