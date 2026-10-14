// Generated foreign keys used to validate recovery snapshots.
export const tableRelations = {
  "activities": [
    {
      "columns": [
        "pet_id"
      ],
      "target": "pets",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "appointment_id"
      ],
      "target": "appointments",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "actor_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "alert_states": [
    {
      "columns": [
        "user_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "actor_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "appointments": [
    {
      "columns": [
        "pet_id"
      ],
      "target": "pets",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "service_id"
      ],
      "target": "services",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "user_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "package_id"
      ],
      "target": "packages",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "actor_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "attempts": [
    {
      "columns": [
        "user_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "audit": [
    {
      "columns": [
        "actor_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "backup_files": [
    {
      "columns": [
        "backup_id"
      ],
      "target": "backups",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "file_id"
      ],
      "target": "files",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "backups": [
    {
      "columns": [
        "actor_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "brands": [],
  "cash_closures": [
    {
      "columns": [
        "actor_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "categories": [],
  "challenges": [
    {
      "columns": [
        "user_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "commission_candidates": [
    {
      "columns": [
        "user_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "commissions": [
    {
      "columns": [
        "user_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "communications": [
    {
      "columns": [
        "health_id"
      ],
      "target": "health",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "tutor_id"
      ],
      "target": "tutors",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "actor_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "contacts": [
    {
      "columns": [
        "pet_id"
      ],
      "target": "pets",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "credit_events": [
    {
      "columns": [
        "package_id"
      ],
      "target": "packages",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "appointment_id"
      ],
      "target": "appointments",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "actor_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "files": [
    {
      "columns": [
        "appointment_id"
      ],
      "target": "appointments",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "activity_id"
      ],
      "target": "activities",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "pet_id"
      ],
      "target": "pets",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "health_id"
      ],
      "target": "health",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "actor_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "financial_categories": [],
  "health": [
    {
      "columns": [
        "pet_id"
      ],
      "target": "pets",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "infrastructure": [],
  "inventory_counts": [
    {
      "columns": [
        "product_id"
      ],
      "target": "products",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "lot_id"
      ],
      "target": "lots",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "actor_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "invoices": [
    {
      "columns": [
        "category_id"
      ],
      "target": "financial_categories",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "party_user_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "tutor_id"
      ],
      "target": "tutors",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "lots": [
    {
      "columns": [
        "product_id"
      ],
      "target": "products",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "maintenance_locks": [],
  "order_items": [
    {
      "columns": [
        "order_id"
      ],
      "target": "orders",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "product_id"
      ],
      "target": "products",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "lot_id"
      ],
      "target": "lots",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "order_returns": [
    {
      "columns": [
        "order_id"
      ],
      "target": "orders",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "actor_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "orders": [
    {
      "columns": [
        "tutor_id"
      ],
      "target": "tutors",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "pet_id"
      ],
      "target": "pets",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "supplier_id"
      ],
      "target": "suppliers",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "user_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "organization": [],
  "package_adjustments": [
    {
      "columns": [
        "package_id"
      ],
      "target": "packages",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "actor_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "package_templates": [
    {
      "columns": [
        "service_id"
      ],
      "target": "services",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "packages": [
    {
      "columns": [
        "pet_id"
      ],
      "target": "pets",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "template_id"
      ],
      "target": "package_templates",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "service_id"
      ],
      "target": "services",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "payments": [
    {
      "columns": [
        "invoice_id"
      ],
      "target": "invoices",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "actor_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "payroll": [
    {
      "columns": [
        "user_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "actor_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "pets": [
    {
      "columns": [
        "tutor_id"
      ],
      "target": "tutors",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "privacy_jobs": [
    {
      "columns": [
        "tutor_id"
      ],
      "target": "tutors",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "actor_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "products": [
    {
      "columns": [
        "brand_id"
      ],
      "target": "brands",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "category_id"
      ],
      "target": "categories",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "supplier_id"
      ],
      "target": "suppliers",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "request_keys": [
    {
      "columns": [
        "actor_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "seasons": [
    {
      "columns": [
        "service_id"
      ],
      "target": "services",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "services": [],
  "shifts": [
    {
      "columns": [
        "user_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "stock_events": [
    {
      "columns": [
        "product_id"
      ],
      "target": "products",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "lot_id"
      ],
      "target": "lots",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "order_item_id"
      ],
      "target": "order_items",
      "targetColumns": [
        "id"
      ]
    },
    {
      "columns": [
        "actor_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "suppliers": [],
  "tasks": [
    {
      "columns": [
        "user_id"
      ],
      "target": "users",
      "targetColumns": [
        "id"
      ]
    }
  ],
  "tutors": [],
  "users": []
};
