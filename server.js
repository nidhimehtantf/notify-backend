const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🔐 Shopify Access Token (Render ENV me set karo)
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// 📦 Temporary storage (production me DB use karo)
let subscribers = [];

/* =================================
   📩 NOTIFY API (Frontend hit karega)
================================= */
app.post("/notify", async (req, res) => {
  try {
    const { email, variant_id, shop } = req.body;

    console.log("📥 Notify Request:", req.body);

    if (!email || !variant_id || !shop) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // 🟢 STEP 1: Variant → Inventory Item ID
    const response = await fetch(
      `https://${shop}/admin/api/2024-01/variants/${variant_id}.json`,
      {
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!data.variant) {
      console.log("❌ Variant not found");
      return res.status(404).json({ error: "Variant not found" });
    }

    const inventory_item_id = data.variant.inventory_item_id;

    console.log("✅ Inventory Item ID:", inventory_item_id);

    // 🟢 STEP 2: Save subscriber (IMPORTANT)
    subscribers.push({
      email,
      inventory_item_id,
    });

    console.log("📌 Subscribers List:", subscribers);

    res.json({ success: true });

  } catch (error) {
    console.error("❌ Error in /notify:", error);
    res.status(500).json({ error: "Server error" });
  }
});


/* =================================
   🔔 WEBHOOK (Shopify se aayega)
================================= */
app.post("/webhook", (req, res) => {
  try {
    const { inventory_item_id, available } = req.body;

    console.log("📦 Webhook received:", req.body);

    console.log("📌 Stored subscribers:", subscribers);
    console.log("🔍 Incoming inventory_item_id:", inventory_item_id);

    // 🟢 MATCH USERS
    const matchedUsers = subscribers.filter(
      (sub) =>
        sub.inventory_item_id.toString() === inventory_item_id.toString()
    );

    console.log("🎯 Matched Users:", matchedUsers);

    if (matchedUsers.length === 0) {
      console.log("⚠️ No matching subscribers found");
    } else {
      console.log("✅ Users found → send email");

      // 👉 yaha email logic add kar sakte ho
      matchedUsers.forEach((user) => {
        console.log(`📧 Send email to: ${user.email}`);
      });
    }

    res.sendStatus(200);

  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.sendStatus(500);
  }
});


/* =================================
   🚀 SERVER START
================================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});