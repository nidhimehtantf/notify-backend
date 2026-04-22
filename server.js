const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🔐 Shopify credentials (Render env me already add kiye honge)
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

/* ================================
   📩 NOTIFY API
================================ */
app.post("/notify", async (req, res) => {
  try {
    const { email, product_id, variant_id, shop } = req.body;

    console.log("📥 Request aayi:", req.body);

    if (!variant_id || !shop) {
      return res.status(400).json({ error: "Missing data" });
    }

    /* ================================
       🟢 STEP 1: Variant → Inventory Item ID
    ================================= */
    const variantRes = await fetch(
      `https://${shop}/admin/api/2024-01/variants/${variant_id}.json`,
      {
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const variantData = await variantRes.json();

    if (!variantData.variant) {
      return res.status(404).json({ error: "Variant not found" });
    }

    const inventory_item_id = variantData.variant.inventory_item_id;

    console.log("✅ Inventory Item ID:", inventory_item_id);

    /* ================================
       🟢 STEP 2: Inventory Levels (Stock)
    ================================= */
    const inventoryRes = await fetch(
      `https://${shop}/admin/api/2024-01/inventory_levels.json?inventory_item_ids=${inventory_item_id}`,
      {
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN,
        },
      }
    );

    const inventoryData = await inventoryRes.json();

    console.log("📦 Inventory Data:", inventoryData);

    const available =
      inventoryData.inventory_levels?.[0]?.available ?? 0;

    console.log("📊 Available Stock:", available);

    /* ================================
       🟢 RESPONSE
    ================================= */
    res.json({
      success: true,
      inventory_item_id,
      available,
    });

  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================================
   🚀 START SERVER
================================ */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});