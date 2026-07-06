import os

file_path = r"d:\Rojsewa-main\backend\routes\adminRoutes.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add require
if "partnerPolicyController" not in content:
    content = content.replace(
        "const router = express.Router();",
        "const router = express.Router();\nconst partnerPolicyController = require('../controllers/partnerPolicyController');"
    )

# Add routes before module.exports
routes = """
// Partner Policy Management
router.get('/partner-policies', protect, admin, partnerPolicyController.getPolicies);
router.post('/partner-policies', protect, admin, partnerPolicyController.savePolicy);

"""

if "/partner-policies" not in content:
    content = content.replace("module.exports = router;", routes + "module.exports = router;")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated adminRoutes.js with partner policies.")
