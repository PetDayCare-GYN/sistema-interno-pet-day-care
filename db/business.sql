CREATE TRIGGER appointment_insert_guard BEFORE INSERT ON appointments WHEN NEW.status!='waitlist' BEGIN
 SELECT CASE WHEN (SELECT active FROM services WHERE id=NEW.service_id)!=1 THEN RAISE(ABORT,'Serviço inativo') END;
 SELECT CASE WHEN (SELECT archived FROM pets WHERE id=NEW.pet_id)!=0 THEN RAISE(ABORT,'Pet arquivado') END;
 
 SELECT CASE WHEN EXISTS(SELECT 1 FROM appointments WHERE pet_id=NEW.pet_id AND status IN ('scheduled','confirmed','in_progress')  AND start_at<NEW.end_at AND end_at>NEW.start_at) THEN RAISE(ABORT,'Pet já possui reserva neste intervalo') END;
 SELECT CASE WHEN NEW.user_id IS NOT NULL AND (SELECT kind FROM services WHERE id=NEW.service_id)='grooming' AND EXISTS(SELECT 1 FROM appointments a JOIN services s ON s.id=a.service_id WHERE a.user_id=NEW.user_id AND s.kind='grooming' AND a.status IN ('scheduled','confirmed','in_progress')  AND a.start_at<NEW.end_at AND a.end_at>NEW.start_at) THEN RAISE(ABORT,'Profissional indisponível neste intervalo') END; 
 SELECT CASE WHEN (SELECT MAX((SELECT COUNT(*) FROM appointments a JOIN services s ON s.id=a.service_id WHERE s.kind=(SELECT kind FROM services WHERE id=NEW.service_id) AND a.status IN ('scheduled','confirmed','in_progress')  AND a.start_at<=points.moment AND a.end_at>points.moment)) FROM (SELECT NEW.start_at AS moment UNION SELECT a.start_at FROM appointments a WHERE a.start_at>=NEW.start_at AND a.start_at<NEW.end_at AND a.status IN ('scheduled','confirmed','in_progress') ) points)>=COALESCE((SELECT CAST(json_extract(settings,'$.capacities.'||(SELECT kind FROM services WHERE id=NEW.service_id)) AS INTEGER) FROM organization LIMIT 1),0) THEN RAISE(ABORT,'Capacidade da modalidade excedida ou não configurada') END;
 SELECT CASE WHEN (SELECT MAX((SELECT COUNT(*) FROM appointments a WHERE a.service_id=NEW.service_id AND a.status IN ('scheduled','confirmed','in_progress')  AND a.start_at<=points.moment AND a.end_at>points.moment)) FROM (SELECT NEW.start_at AS moment UNION SELECT a.start_at FROM appointments a WHERE a.service_id=NEW.service_id AND a.start_at>=NEW.start_at AND a.start_at<NEW.end_at AND a.status IN ('scheduled','confirmed','in_progress') ) points)>=(SELECT capacity FROM services WHERE id=NEW.service_id) THEN RAISE(ABORT,'Capacidade do serviço excedida') END;
 SELECT CASE WHEN NEW.package_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM packages WHERE id=NEW.package_id AND pet_id=NEW.pet_id AND service_id=NEW.service_id AND balance>=NEW.credit_units AND expires_at>=NEW.end_at) THEN RAISE(ABORT,'Pacote incompatível, vencido ou sem saldo') END;
END;
--> statement-breakpoint
CREATE TRIGGER appointment_transition BEFORE UPDATE ON appointments BEGIN
 SELECT CASE WHEN OLD.status IN ('completed','cancelled','no_show') THEN RAISE(ABORT,'Atendimento encerrado é imutável') END;
 SELECT CASE WHEN NEW.pet_id!=OLD.pet_id OR NEW.service_id!=OLD.service_id OR NEW.package_id IS NOT OLD.package_id THEN RAISE(ABORT,'Cadastro, serviço e pacote do atendimento devem ser preservados') END;
 SELECT CASE WHEN OLD.status='in_progress' AND NEW.start_at!=OLD.start_at THEN RAISE(ABORT,'A entrada prevista não pode mudar após o check-in') END;
 SELECT CASE WHEN NOT (NEW.status=OLD.status OR (OLD.status='waitlist' AND NEW.status IN ('scheduled','confirmed','cancelled','no_show')) OR (OLD.status IN ('scheduled','confirmed') AND NEW.status IN ('confirmed','in_progress','cancelled','no_show')) OR (OLD.status='in_progress' AND NEW.status IN ('completed','cancelled'))) THEN RAISE(ABORT,'Transição de atendimento inválida') END;
 SELECT CASE WHEN NEW.status='completed' AND (NEW.actual_in IS NULL OR NEW.actual_out IS NULL OR NEW.actual_out<NEW.actual_in) THEN RAISE(ABORT,'Entrada e saída válidas são obrigatórias') END;
 SELECT CASE WHEN NEW.status='completed' AND NEW.package_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM packages WHERE id=NEW.package_id AND balance>=NEW.credit_units AND expires_at>=NEW.actual_out) THEN RAISE(ABORT,'Pacote sem saldo ou vencido') END;
 SELECT CASE WHEN NEW.status='in_progress' AND OLD.status!='in_progress' AND (SELECT COUNT(*) FROM appointments a JOIN services s ON s.id=a.service_id WHERE a.status='in_progress' AND s.kind=(SELECT kind FROM services WHERE id=NEW.service_id) AND a.id!=NEW.id)>=COALESCE((SELECT CAST(json_extract(settings,'$.capacities.'||(SELECT kind FROM services WHERE id=NEW.service_id)) AS INTEGER) FROM organization LIMIT 1),0) THEN RAISE(ABORT,'Capacidade atual excedida para entrada') END;
 SELECT CASE WHEN NEW.status='in_progress' AND OLD.status!='in_progress' AND (SELECT COUNT(*) FROM appointments WHERE status='in_progress' AND service_id=NEW.service_id AND id!=NEW.id)>=(SELECT capacity FROM services WHERE id=NEW.service_id) THEN RAISE(ABORT,'Capacidade atual do serviço excedida') END;
 SELECT CASE WHEN NEW.status='in_progress' AND EXISTS(SELECT 1 FROM appointments WHERE pet_id=NEW.pet_id AND status='in_progress' AND id!=NEW.id) THEN RAISE(ABORT,'Pet já está em atendimento') END;
 SELECT CASE WHEN NEW.status='in_progress' AND NEW.user_id IS NOT NULL AND (SELECT kind FROM services WHERE id=NEW.service_id)='grooming' AND EXISTS(SELECT 1 FROM appointments a JOIN services s ON s.id=a.service_id WHERE a.id!=NEW.id AND a.user_id=NEW.user_id AND s.kind='grooming' AND a.status='in_progress') THEN RAISE(ABORT,'Profissional já está em atendimento') END;
END;
--> statement-breakpoint
CREATE TRIGGER credit_consume AFTER INSERT ON credit_events BEGIN
 UPDATE packages SET balance=balance-NEW.units WHERE id=NEW.package_id;
END;
--> statement-breakpoint
CREATE TRIGGER appointment_complete AFTER UPDATE OF status ON appointments WHEN NEW.status='completed' AND OLD.status!='completed' BEGIN
 INSERT INTO credit_events(id,package_id,appointment_id,units,actor_id) SELECT NEW.id,NEW.package_id,NEW.id,NEW.credit_units,NEW.actor_id WHERE NEW.package_id IS NOT NULL;
 INSERT INTO invoices(id,kind,source_type,source_id,tutor_id,description,amount_cents,due_date) SELECT NEW.id,'receivable','appointment',NEW.id,p.tutor_id,'Atendimento · '||p.name||' · '||s.name,NEW.quote_cents,date(NEW.actual_out,'-3 hours') FROM pets p JOIN services s ON s.id=NEW.service_id WHERE p.id=NEW.pet_id AND NEW.quote_cents>0;
 INSERT INTO commission_candidates(id,user_id,source_type,source_id,funding_type,funding_id,condition,amount_cents,rule)
 SELECT NEW.id,u.id,'appointment',NEW.id,CASE WHEN NEW.package_id IS NULL THEN 'appointment' ELSE 'package' END,COALESCE(NEW.package_id,NEW.id),u.commission_condition,
 CASE WHEN u.commission_kind='fixed' THEN u.commission_value ELSE CAST(round((CASE WHEN u.commission_basis='allocated' AND NEW.package_id IS NOT NULL THEN (SELECT price_cents*1.0/credits*NEW.credit_units FROM packages WHERE id=NEW.package_id)+NEW.extras_cents-NEW.discount_cents ELSE NEW.quote_cents END)*u.commission_value/10000.0) AS INTEGER) END,
 json_object('kind',u.commission_kind,'value',u.commission_value,'basis',u.commission_basis,'service',NEW.service_id,'period',u.commission_period,'condition',u.commission_condition,'pay_after_period',u.commission_pay_after_period)
 FROM users u WHERE u.id=NEW.user_id AND u.commission_kind!='none' AND EXISTS(SELECT 1 FROM json_each(u.commission_services) WHERE value=NEW.service_id);
END;
--> statement-breakpoint
CREATE TRIGGER commission_invoice AFTER INSERT ON commissions WHEN NEW.amount_cents>0 BEGIN
 INSERT INTO invoices(id,kind,source_type,source_id,party_user_id,description,amount_cents,due_date) VALUES('commission-'||NEW.id,'payable','commission',NEW.id,NEW.user_id,'Comissão · '||(SELECT name FROM users WHERE id=NEW.user_id),NEW.amount_cents,
 CASE json_extract(NEW.rule,'$.period') WHEN 'monthly' THEN date(NEW.created_at,'-3 hours','start of month','+1 month','-1 day') WHEN 'weekly' THEN date(NEW.created_at,'-3 hours','weekday 0') ELSE date(NEW.created_at,'-3 hours') END);
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
CREATE TRIGGER order_freeze BEFORE UPDATE ON orders WHEN OLD.status IN ('posted','reversed') AND NOT (OLD.status='posted' AND NEW.status='reversed' AND EXISTS(SELECT 1 FROM order_returns WHERE order_id=OLD.id) AND NEW.total_cents=OLD.total_cents AND NEW.discount_cents=OLD.discount_cents) BEGIN SELECT RAISE(ABORT,'Pedido postado é imutável'); END;
--> statement-breakpoint
CREATE TRIGGER order_post AFTER UPDATE OF status ON orders WHEN NEW.status='posted' AND OLD.status='draft' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM order_items WHERE order_id=NEW.id) OR NEW.total_cents!=(SELECT SUM(quantity*unit_cents)-NEW.discount_cents FROM order_items WHERE order_id=NEW.id) THEN RAISE(ABORT,'Total ou itens inconsistentes') END;
 INSERT INTO stock_events(id,product_id,lot_id,order_item_id,quantity,reason,actor_id,kind) SELECT id,product_id,lot_id,id,CASE WHEN NEW.kind='sale' THEN -quantity ELSE quantity END,NEW.kind,NEW.user_id,NEW.kind FROM order_items WHERE order_id=NEW.id;
 INSERT INTO invoices(id,kind,source_type,source_id,tutor_id,description,amount_cents,due_date) VALUES(NEW.id,CASE WHEN NEW.kind='sale' THEN 'receivable' ELSE 'payable' END,NEW.kind,NEW.id,NEW.tutor_id,CASE WHEN NEW.kind='sale' THEN 'Venda de produtos' ELSE 'Compra de produtos' END,NEW.total_cents,substr(NEW.created_at,1,10));
 INSERT INTO commission_candidates(id,user_id,source_type,source_id,funding_type,funding_id,condition,amount_cents,rule) SELECT NEW.id,u.id,'sale',NEW.id,'sale',NEW.id,u.commission_condition,CASE WHEN u.commission_kind='fixed' THEN u.commission_value ELSE CAST(round(NEW.total_cents*u.commission_value/10000.0) AS INTEGER) END,json_object('kind',u.commission_kind,'value',u.commission_value,'basis','charged','period',u.commission_period,'condition',u.commission_condition,'pay_after_period',u.commission_pay_after_period) FROM users u WHERE u.id=NEW.user_id AND NEW.kind='sale' AND u.commission_kind!='none' AND EXISTS(SELECT 1 FROM json_each(u.commission_services) WHERE value='products');
END;
--> statement-breakpoint
CREATE TRIGGER payment_guard BEFORE INSERT ON payments BEGIN
 SELECT CASE WHEN NEW.amount_cents>0 AND EXISTS(SELECT 1 FROM invoices i JOIN commissions c ON i.source_type='commission' AND i.source_id=c.id WHERE i.id=NEW.invoice_id AND json_extract(c.rule,'$.pay_after_period')=1 AND date(NEW.created_at,'-3 hours')<=i.due_date) THEN RAISE(ABORT,'O período de apuração desta comissão ainda não terminou') END;
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
--> statement-breakpoint
CREATE TRIGGER appointment_update_capacity BEFORE UPDATE ON appointments WHEN NEW.status IN ('scheduled','confirmed','in_progress') BEGIN
 
 SELECT CASE WHEN EXISTS(SELECT 1 FROM appointments WHERE pet_id=NEW.pet_id AND status IN ('scheduled','confirmed','in_progress') AND id!=NEW.id AND start_at<NEW.end_at AND end_at>NEW.start_at) THEN RAISE(ABORT,'Pet já possui reserva neste intervalo') END;
 SELECT CASE WHEN NEW.user_id IS NOT NULL AND (SELECT kind FROM services WHERE id=NEW.service_id)='grooming' AND EXISTS(SELECT 1 FROM appointments a JOIN services s ON s.id=a.service_id WHERE a.user_id=NEW.user_id AND s.kind='grooming' AND a.status IN ('scheduled','confirmed','in_progress') AND a.id!=NEW.id AND a.start_at<NEW.end_at AND a.end_at>NEW.start_at) THEN RAISE(ABORT,'Profissional indisponível neste intervalo') END; 
 SELECT CASE WHEN (SELECT MAX((SELECT COUNT(*) FROM appointments a JOIN services s ON s.id=a.service_id WHERE s.kind=(SELECT kind FROM services WHERE id=NEW.service_id) AND a.status IN ('scheduled','confirmed','in_progress') AND a.id!=NEW.id AND a.start_at<=points.moment AND a.end_at>points.moment)) FROM (SELECT NEW.start_at AS moment UNION SELECT a.start_at FROM appointments a WHERE a.start_at>=NEW.start_at AND a.start_at<NEW.end_at AND a.status IN ('scheduled','confirmed','in_progress') AND a.id!=NEW.id) points)>=COALESCE((SELECT CAST(json_extract(settings,'$.capacities.'||(SELECT kind FROM services WHERE id=NEW.service_id)) AS INTEGER) FROM organization LIMIT 1),0) THEN RAISE(ABORT,'Capacidade da modalidade excedida ou não configurada') END;
 SELECT CASE WHEN (SELECT MAX((SELECT COUNT(*) FROM appointments a WHERE a.service_id=NEW.service_id AND a.status IN ('scheduled','confirmed','in_progress') AND a.id!=NEW.id AND a.start_at<=points.moment AND a.end_at>points.moment)) FROM (SELECT NEW.start_at AS moment UNION SELECT a.start_at FROM appointments a WHERE a.service_id=NEW.service_id AND a.start_at>=NEW.start_at AND a.start_at<NEW.end_at AND a.status IN ('scheduled','confirmed','in_progress') AND a.id!=NEW.id) points)>=(SELECT capacity FROM services WHERE id=NEW.service_id) THEN RAISE(ABORT,'Capacidade do serviço excedida') END;
 SELECT CASE WHEN NEW.package_id IS NOT NULL AND OLD.status!='in_progress' AND NOT EXISTS(SELECT 1 FROM packages WHERE id=NEW.package_id AND pet_id=NEW.pet_id AND service_id=NEW.service_id AND balance>=NEW.credit_units AND expires_at>=NEW.end_at) THEN RAISE(ABORT,'Pacote incompatível, vencido ou sem saldo') END;
END;
--> statement-breakpoint
CREATE TRIGGER commission_candidate_apply AFTER INSERT ON commission_candidates BEGIN
 INSERT OR IGNORE INTO commissions(id,user_id,source_type,source_id,amount_cents,rule) SELECT c.id,c.user_id,c.source_type,c.source_id,c.amount_cents,c.rule FROM commission_candidates c WHERE c.id=NEW.id AND c.reversed=0 AND (c.condition='completed' OR NOT EXISTS(SELECT 1 FROM invoices i WHERE ((i.source_type=c.funding_type AND i.source_id=c.funding_id) OR (c.source_type='appointment' AND i.source_type='appointment' AND i.source_id=c.source_id)) AND COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=i.id),0)<i.amount_cents));
END;
--> statement-breakpoint
CREATE TRIGGER payment_commission_apply AFTER INSERT ON payments WHEN NEW.amount_cents>0 BEGIN
 INSERT OR IGNORE INTO commissions(id,user_id,source_type,source_id,amount_cents,rule) SELECT c.id,c.user_id,c.source_type,c.source_id,c.amount_cents,c.rule FROM commission_candidates c WHERE c.condition='paid' AND c.reversed=0 AND NOT EXISTS(SELECT 1 FROM invoices i WHERE ((i.source_type=c.funding_type AND i.source_id=c.funding_id) OR (c.source_type='appointment' AND i.source_type='appointment' AND i.source_id=c.source_id)) AND COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=i.id),0)<i.amount_cents);
END;
--> statement-breakpoint
CREATE TRIGGER order_return_guard BEFORE INSERT ON order_returns BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM orders o JOIN invoices i ON i.source_id=o.id AND i.source_type=o.kind WHERE o.id=NEW.order_id AND o.status='posted' AND i.amount_cents=NEW.original_invoice_cents AND COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=i.id),0)=NEW.settled_cents) THEN RAISE(ABORT,'Pedido ou pagamentos mudaram. Atualize a conferência da devolução') END;
 SELECT CASE WHEN length(NEW.reason)<5 THEN RAISE(ABORT,'Justifique a devolução') END;
END;
--> statement-breakpoint
CREATE TRIGGER order_return_apply AFTER INSERT ON order_returns BEGIN
 UPDATE commission_candidates SET reversed=1 WHERE source_type='sale' AND source_id=NEW.order_id;
 UPDATE commissions SET reversed=1 WHERE source_type='sale' AND source_id=NEW.order_id;
 INSERT INTO stock_events(id,product_id,lot_id,quantity,reason,actor_id,kind) SELECT NEW.id||'-'||i.id,i.product_id,i.lot_id,CASE WHEN o.kind='sale' THEN i.quantity ELSE -i.quantity END,NEW.reason,NEW.actor_id,'return' FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.order_id=NEW.order_id;
 INSERT INTO invoices(id,kind,source_type,source_id,tutor_id,description,amount_cents,due_date) SELECT NEW.id,CASE WHEN o.kind='sale' THEN 'payable' ELSE 'receivable' END,'return_'||o.kind,NEW.id,o.tutor_id,CASE WHEN o.kind='sale' THEN 'Reembolso a devolver ao cliente' ELSE 'Reembolso a receber do fornecedor' END,NEW.settled_cents,date(NEW.created_at,'-3 hours') FROM orders o WHERE o.id=NEW.order_id AND NEW.settled_cents>0;
 UPDATE invoices SET original_amount_cents=amount_cents,amount_cents=NEW.settled_cents WHERE source_id=NEW.order_id AND source_type=(SELECT kind FROM orders WHERE id=NEW.order_id);
 INSERT INTO invoices(id,kind,source_type,source_id,party_user_id,description,amount_cents,due_date)
 SELECT 'recover-'||c.id,'receivable','commission_recovery',c.id,c.user_id,'Comissão paga a recuperar · '||(SELECT name FROM users WHERE id=c.user_id),COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=i.id),0),date(NEW.created_at,'-3 hours') FROM commissions c JOIN invoices i ON i.source_type='commission' AND i.source_id=c.id WHERE c.source_type='sale' AND c.source_id=NEW.order_id AND COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=i.id),0)>0;
 UPDATE invoices SET original_amount_cents=amount_cents,amount_cents=COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=invoices.id),0) WHERE source_type='commission' AND source_id IN (SELECT id FROM commissions WHERE source_type='sale' AND source_id=NEW.order_id);
 UPDATE orders SET status='reversed' WHERE id=NEW.order_id;
END;
--> statement-breakpoint
CREATE TRIGGER inventory_count_guard BEFORE INSERT ON inventory_counts BEGIN
 SELECT CASE WHEN NEW.expected!=CASE WHEN NEW.lot_id IS NULL THEN (SELECT stock FROM products WHERE id=NEW.product_id)-(SELECT COALESCE(SUM(stock),0) FROM lots WHERE product_id=NEW.product_id) ELSE (SELECT stock FROM lots WHERE id=NEW.lot_id AND product_id=NEW.product_id) END THEN RAISE(ABORT,'Estoque mudou durante a contagem. Confira novamente') END;
END;
--> statement-breakpoint
CREATE TRIGGER inventory_count_apply AFTER INSERT ON inventory_counts WHEN NEW.counted!=NEW.expected BEGIN
 INSERT INTO stock_events(id,product_id,lot_id,quantity,reason,actor_id,kind) VALUES(NEW.id,NEW.product_id,NEW.lot_id,NEW.counted-NEW.expected,NEW.reason,NEW.actor_id,'inventory');
END;
--> statement-breakpoint
CREATE TRIGGER package_adjustment_guard BEFORE INSERT ON package_adjustments BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM packages WHERE id=NEW.package_id AND balance+NEW.units BETWEEN 0 AND credits) OR length(NEW.reason)<5 THEN RAISE(ABORT,'Ajuste de pacote inválido ou sem justificativa') END;
END;
--> statement-breakpoint
CREATE TRIGGER package_adjustment_apply AFTER INSERT ON package_adjustments BEGIN UPDATE packages SET balance=balance+NEW.units WHERE id=NEW.package_id; END;
--> statement-breakpoint
CREATE TRIGGER appointment_cancel_charge AFTER UPDATE OF status ON appointments WHEN NEW.status IN ('cancelled','no_show') AND OLD.status NOT IN ('cancelled','no_show','waitlist') BEGIN
 INSERT INTO credit_events(id,package_id,appointment_id,units,actor_id) SELECT NEW.id,NEW.package_id,NEW.id,NEW.credit_units,NEW.actor_id WHERE NEW.package_id IS NOT NULL AND CASE NEW.status WHEN 'cancelled' THEN json_extract(NEW.pricing,'$.service.cancel_credit') ELSE json_extract(NEW.pricing,'$.service.no_show_credit') END=1;
 INSERT INTO invoices(id,kind,source_type,source_id,tutor_id,description,amount_cents,due_date) SELECT NEW.id,'receivable','cancellation',NEW.id,p.tutor_id,'Taxa configurada · '||NEW.status,CASE NEW.status WHEN 'cancelled' THEN COALESCE(json_extract(NEW.pricing,'$.service.cancellation_fee_cents'),0) ELSE COALESCE(json_extract(NEW.pricing,'$.service.no_show_fee_cents'),0) END,date('now','-3 hours') FROM pets p WHERE p.id=NEW.pet_id AND CASE NEW.status WHEN 'cancelled' THEN COALESCE(json_extract(NEW.pricing,'$.service.cancellation_fee_cents'),0) ELSE COALESCE(json_extract(NEW.pricing,'$.service.no_show_fee_cents'),0) END>0;
END;
--> statement-breakpoint
CREATE TRIGGER payroll_guard BEFORE INSERT ON payroll BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM payroll WHERE user_id=NEW.user_id AND kind=NEW.kind AND period_start<=NEW.period_end AND period_end>=NEW.period_start) THEN RAISE(ABORT,'Este período já possui remuneração apurada') END;
END;
--> statement-breakpoint
CREATE TRIGGER payroll_invoice AFTER INSERT ON payroll BEGIN
 INSERT INTO invoices(id,kind,source_type,source_id,party_user_id,description,amount_cents,due_date) VALUES(NEW.id,'payable','payroll',NEW.id,NEW.user_id,CASE NEW.kind WHEN 'salary' THEN 'Remuneração · ' ELSE 'Bonificação · ' END||(SELECT name FROM users WHERE id=NEW.user_id)||' · '||NEW.period_start||' a '||NEW.period_end,NEW.amount_cents,NEW.period_end);
END;
--> statement-breakpoint
CREATE TRIGGER payment_closed_period BEFORE INSERT ON payments BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM cash_closures WHERE status='closed' AND period_start<=date(NEW.created_at,'-3 hours') AND period_end>=date(NEW.created_at,'-3 hours')) THEN RAISE(ABORT,'Período financeiro fechado. Reabra com justificativa antes de registrar pagamentos') END;
END;
--> statement-breakpoint
CREATE TRIGGER shift_overlap_insert BEFORE INSERT ON shifts BEGIN SELECT CASE WHEN EXISTS(SELECT 1 FROM shifts WHERE user_id=NEW.user_id AND id!=NEW.id AND start_at<NEW.end_at AND end_at>NEW.start_at) THEN RAISE(ABORT,'A escala do profissional já ocupa este intervalo') END; END;
--> statement-breakpoint
CREATE TRIGGER shift_overlap_update BEFORE UPDATE ON shifts BEGIN SELECT CASE WHEN EXISTS(SELECT 1 FROM shifts WHERE user_id=NEW.user_id AND id!=NEW.id AND start_at<NEW.end_at AND end_at>NEW.start_at) THEN RAISE(ABORT,'A escala do profissional já ocupa este intervalo') END; END;
--> statement-breakpoint
CREATE TRIGGER closure_insert_guard BEFORE INSERT ON cash_closures WHEN NEW.status='closed' BEGIN
 SELECT CASE WHEN NEW.expected_cents-NEW.opening_cents!=COALESCE((SELECT SUM(CASE WHEN i.kind='receivable' THEN p.amount_cents ELSE -p.amount_cents END) FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE date(p.created_at,'-3 hours') BETWEEN NEW.period_start AND NEW.period_end),0) OR json_extract(NEW.snapshot,'$.payments_count')!=(SELECT COUNT(*) FROM payments WHERE date(created_at,'-3 hours') BETWEEN NEW.period_start AND NEW.period_end) THEN RAISE(ABORT,'Pagamentos mudaram durante o fechamento. Confira novamente') END;
END;
--> statement-breakpoint
CREATE TRIGGER closure_update_guard BEFORE UPDATE ON cash_closures WHEN NEW.status='closed' BEGIN
 SELECT CASE WHEN NEW.expected_cents-NEW.opening_cents!=COALESCE((SELECT SUM(CASE WHEN i.kind='receivable' THEN p.amount_cents ELSE -p.amount_cents END) FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE date(p.created_at,'-3 hours') BETWEEN NEW.period_start AND NEW.period_end),0) OR json_extract(NEW.snapshot,'$.payments_count')!=(SELECT COUNT(*) FROM payments WHERE date(created_at,'-3 hours') BETWEEN NEW.period_start AND NEW.period_end) THEN RAISE(ABORT,'Pagamentos mudaram durante o fechamento. Confira novamente') END;
END;

--> statement-breakpoint
CREATE TRIGGER file_privacy_guard BEFORE INSERT ON files WHEN NEW.pet_id IS NOT NULL BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM pets p JOIN tutors t ON t.id=p.tutor_id WHERE p.id=NEW.pet_id AND t.anonymized_at IS NOT NULL) THEN RAISE(ABORT,'Este cadastro teve seus identificadores removidos') END;
END;
--> statement-breakpoint
CREATE TRIGGER maintenance_write_guard BEFORE INSERT ON request_keys BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM maintenance_locks WHERE expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')) THEN RAISE(ABORT,'Há uma operação técnica em andamento. Aguarde sua conclusão') END;
END;

--> statement-breakpoint
CREATE TRIGGER pet_photo_owner_update BEFORE UPDATE OF photo_id ON pets WHEN NEW.photo_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM files WHERE id=NEW.photo_id AND pet_id=NEW.id AND kind='photo' AND removed_at IS NULL AND mime IN ('image/png','image/jpeg')) THEN RAISE(ABORT,'A fotografia deve pertencer ao cadastro deste pet') END;
END;
--> statement-breakpoint
CREATE TRIGGER appointment_photo_insert BEFORE INSERT ON appointments BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM pets p JOIN files f ON f.id=p.photo_id WHERE p.id=NEW.pet_id AND f.pet_id=p.id AND f.kind='photo' AND f.removed_at IS NULL AND f.mime IN ('image/png','image/jpeg')) THEN RAISE(ABORT,'Foto obrigatória pendente no cadastro do pet') END;
END;
--> statement-breakpoint
CREATE TRIGGER appointment_photo_transition BEFORE UPDATE OF status ON appointments WHEN NEW.status IN ('confirmed','in_progress','completed') AND NEW.status!=OLD.status BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM pets p JOIN files f ON f.id=p.photo_id WHERE p.id=NEW.pet_id AND f.pet_id=p.id AND f.kind='photo' AND f.removed_at IS NULL AND f.mime IN ('image/png','image/jpeg')) THEN RAISE(ABORT,'Foto obrigatória pendente no cadastro do pet') END;
END;
