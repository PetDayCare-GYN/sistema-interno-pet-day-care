// Generated schema defaults for importing older snapshots.
export const columnDefaults = {
  "activities": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "alert_states": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "appointments": {
    "status": "'scheduled'",
    "extras": "'[]'",
    "extras_cents": 0,
    "discount_cents": 0,
    "credit_units": 1,
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "attempts": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "audit": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "backup_files": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "backups": {
    "status": "'logical'",
    "file_count": 0,
    "copied_files": 0,
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "brands": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "cash_closures": {
    "status": "'closed'",
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "categories": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "challenges": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "commission_candidates": {
    "reversed": 0,
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "commissions": {
    "reversed": 0,
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "communications": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "contacts": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "credit_events": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "files": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "financial_categories": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "health": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "infrastructure": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "inventory_counts": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "invoices": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "lots": {
    "stock": 0,
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "maintenance_locks": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "order_items": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "order_returns": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "orders": {
    "status": "'draft'",
    "discount_cents": 0,
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "organization": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "package_adjustments": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "package_templates": {
    "active": 1,
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "packages": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "payments": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "payroll": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "pets": {
    "archived": 0,
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "privacy_jobs": {
    "processed_files": 0,
    "purge_backups": 0,
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "products": {
    "stock": 0,
    "active": 1,
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "request_keys": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "seasons": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "services": {
    "cancel_credit": 0,
    "no_show_credit": 0,
    "cancellation_fee_cents": 0,
    "no_show_fee_cents": 0,
    "active": 0,
    "tolerance_minutes": 0,
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "shifts": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "stock_events": {
    "kind": "'adjustment'",
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "suppliers": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "tasks": {
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "tutors": {
    "archived": 0,
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  },
  "users": {
    "commission_pay_after_period": 0,
    "commission_period": "'monthly'",
    "commission_condition": "'completed'",
    "bonus_kind": "'none'",
    "bonus_value": 0,
    "bonus_target": 0,
    "permissions": "'{}'",
    "active": 1,
    "salary_cents": 0,
    "commission_kind": "'none'",
    "commission_value": 0,
    "commission_basis": "'charged'",
    "commission_services": "'[]'",
    "created_at": "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  }
};
