---
name: Railway entrypoint detection
description: Distinguish GitHub auto-detection from separately applied Railway CLI infrastructure.
---

Verify Railway's root-level build and start detection independently of CLI-managed infrastructure configuration.

**Why:** Connecting the repository through Railway's GitHub UI did not apply the optional CLI infrastructure file. Testing only the nested web package missed the resulting missing-start failure.

**How to apply:** Test the production build from the repository root without Replit-provided variables, then start the production server with only its assigned port. Keep GitHub auto-detection and optional CLI configuration consistent. Preserve an explicit all-workspace command when the default build targets the website alone.
