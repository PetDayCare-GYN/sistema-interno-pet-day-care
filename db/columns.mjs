// Generated from the current Drizzle schema; contains no runtime data.
export const tableColumns = {
  "activities": [
    "id",
    "pet_id",
    "appointment_id",
    "kind",
    "notes",
    "actor_id",
    "created_at"
  ],
  "appointments": [
    "id",
    "pet_id",
    "service_id",
    "user_id",
    "package_id",
    "start_at",
    "end_at",
    "status",
    "quote_cents",
    "base_cents",
    "extras",
    "extras_cents",
    "discount_cents",
    "credit_units",
    "pricing",
    "actual_in",
    "actual_out",
    "delivered_by",
    "collected_by",
    "belongings",
    "instructions",
    "notes",
    "actor_id",
    "created_at"
  ],
  "attempts": [
    "id",
    "user_id",
    "created_at"
  ],
  "audit": [
    "id",
    "actor_id",
    "action",
    "entity",
    "record_id",
    "reason",
    "created_at"
  ],
  "backups": [
    "id",
    "name",
    "object_key",
    "actor_id",
    "created_at"
  ],
  "categories": [
    "id",
    "name",
    "created_at"
  ],
  "challenges": [
    "id",
    "user_id",
    "token_hash",
    "expires_at",
    "created_at"
  ],
  "commissions": [
    "id",
    "user_id",
    "source_type",
    "source_id",
    "amount_cents",
    "rule",
    "created_at"
  ],
  "communications": [
    "id",
    "tutor_id",
    "kind",
    "notes",
    "actor_id",
    "created_at"
  ],
  "contacts": [
    "id",
    "pet_id",
    "name",
    "phone",
    "relationship",
    "created_at"
  ],
  "credit_events": [
    "id",
    "package_id",
    "appointment_id",
    "units",
    "actor_id",
    "created_at"
  ],
  "files": [
    "id",
    "pet_id",
    "health_id",
    "kind",
    "name",
    "mime",
    "size",
    "actor_id",
    "created_at"
  ],
  "health": [
    "id",
    "pet_id",
    "kind",
    "name",
    "applied_date",
    "due_date",
    "proof_status",
    "notes",
    "created_at"
  ],
  "infrastructure": [
    "id",
    "name",
    "kind",
    "url",
    "provider",
    "status",
    "owner",
    "notes",
    "created_at"
  ],
  "invoices": [
    "id",
    "kind",
    "source_type",
    "source_id",
    "tutor_id",
    "description",
    "amount_cents",
    "due_date",
    "created_at"
  ],
  "lots": [
    "id",
    "product_id",
    "name",
    "expires_date",
    "stock",
    "created_at"
  ],
  "order_items": [
    "id",
    "order_id",
    "product_id",
    "lot_id",
    "quantity",
    "unit_cents",
    "created_at"
  ],
  "orders": [
    "id",
    "kind",
    "tutor_id",
    "pet_id",
    "supplier_id",
    "user_id",
    "status",
    "total_cents",
    "discount_cents",
    "notes",
    "created_at"
  ],
  "organization": [
    "id",
    "name",
    "settings",
    "theme",
    "technical_hash",
    "created_at"
  ],
  "package_templates": [
    "id",
    "name",
    "service_id",
    "credits",
    "price_cents",
    "valid_days",
    "active",
    "created_at"
  ],
  "packages": [
    "id",
    "pet_id",
    "template_id",
    "service_id",
    "name",
    "credits",
    "price_cents",
    "expires_at",
    "balance",
    "created_at"
  ],
  "payments": [
    "id",
    "invoice_id",
    "amount_cents",
    "method",
    "reason",
    "actor_id",
    "created_at"
  ],
  "pets": [
    "id",
    "tutor_id",
    "name",
    "species",
    "breed",
    "size",
    "coat",
    "birth_date",
    "weight",
    "behavior",
    "allergies",
    "diet",
    "medication",
    "emergency",
    "notes",
    "photo_id",
    "archived",
    "created_at"
  ],
  "products": [
    "id",
    "category_id",
    "supplier_id",
    "name",
    "brand",
    "sku",
    "barcode",
    "unit",
    "cost_cents",
    "price_cents",
    "min_stock",
    "stock",
    "storage",
    "active",
    "created_at"
  ],
  "request_keys": [
    "id",
    "actor_id",
    "fingerprint",
    "result_id",
    "created_at"
  ],
  "seasons": [
    "id",
    "name",
    "service_id",
    "start_date",
    "end_date",
    "size",
    "price_cents",
    "created_at"
  ],
  "services": [
    "id",
    "name",
    "kind",
    "price_cents",
    "duration_minutes",
    "capacity",
    "active",
    "boarding_policy",
    "tolerance_minutes",
    "extra_hour_cents",
    "partial_policy",
    "created_at"
  ],
  "stock_events": [
    "id",
    "product_id",
    "lot_id",
    "order_item_id",
    "quantity",
    "reason",
    "actor_id",
    "created_at"
  ],
  "suppliers": [
    "id",
    "name",
    "phone",
    "email",
    "notes",
    "created_at"
  ],
  "tasks": [
    "id",
    "name",
    "due_date",
    "user_id",
    "priority",
    "status",
    "notes",
    "created_at"
  ],
  "tutors": [
    "id",
    "name",
    "phone",
    "email",
    "address",
    "emergency",
    "notes",
    "archived",
    "created_at"
  ],
  "users": [
    "id",
    "identity_id",
    "email",
    "name",
    "role",
    "permissions",
    "active",
    "salary_cents",
    "commission_kind",
    "commission_value",
    "commission_basis",
    "commission_services",
    "created_at"
  ]
};
