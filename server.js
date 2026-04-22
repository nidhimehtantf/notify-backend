const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🔐 Shopify Access Token (Render ENV me set karo)
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const KLAVIYO_API_KEY = process.env.KLAVIYO_API_KEY;
// 📦 Temporary storage (production me DB use karo)
let subscribers = [];

/* =================================
   📧 KLAVIYO EVENT FUNCTION
================================= */
async function sendKlaviyoEvent(email) {
  try {
    const res = await fetch("https://a.klaviyo.com/api/events/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
        "revision": "2023-10-15",
      },
      body: JSON.stringify({
        data: {
          type: "event",
          attributes: {
            profile: {
              data: {
                type: "profile",
                attributes: {
                  email: email,
                },
              },
            },
            metric: {
              data: {
                type: "metric",
                attributes: {
                  name: "Back In Stock",
                },
              },
            },
          },
        },
      }),
    });

    const data = await res.json();
    console.log("✅ Klaviyo event sent:", data);

  } catch (err) {
    console.error("❌ Klaviyo error:", err);
  }
}

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
app.post("/webhook", async (req, res) => {
  try {
    const { inventory_item_id, available } = req.body;

    console.log("📦 Webhook received:", req.body);

    console.log("📌 Stored subscribers:", subscribers);
    console.log("🔍 Incoming inventory_item_id:", inventory_item_id);

      // ❗ Agar stock 0 hai to kuch mat karo
    if (available <= 0) {
      console.log("⛔ Still out of stock");
      return res.sendStatus(200);
    }

    console.log("🟢 Stock available → checking users");

    // 🟢 MATCH USERS
    const matchedUsers = subscribers.filter(
      (sub) =>
        sub.inventory_item_id.toString() === inventory_item_id.toString()
    );

    console.log("🎯 Matched Users:", matchedUsers);

    if (matchedUsers.length === 0) {
      console.log("⚠️ No matching subscribers found");
    } else {
      console.log("✅ Sending Klaviyo events");

      for (const user of matchedUsers) {
        await sendKlaviyoEvent(user.email);
      }

      // 🧹 Remove users (duplicate email avoid)
      subscribers = subscribers.filter(
        (sub) =>
          sub.inventory_item_id.toString() !== inventory_item_id.toString()
      );
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