import os
import re

file_path = r"d:\Rojsewa-main\backend\models\Provider.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fields to inject
new_fields = """
    // Partner Policy Tracking Fields
    surakshaNidhiOptIn: { type: Boolean, default: false },
    badges: [{ type: String }],
    performanceDiscount: { type: Number, default: 0 },
    lastOrderDate: { type: Date, default: null },
    completedBookingsCount: { type: Number, default: 0 },
"""

# Inject before timestamps
target = "}, {\n    timestamps: true,"
content = content.replace(target, new_fields + target)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated Provider.js with partner policy tracking fields.")
