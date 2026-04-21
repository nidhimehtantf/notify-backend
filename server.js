const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* ================================
   📦 MEMORY STORAGE
================================ */
let subscribers = [];
let SHOP_DATA = {};

/* ================================
   🔐 AUTH CALLBACK TOKEN STORE
================================ */
app.get("/auth/callback", async (req, res) => {
  const { code, shop } = req.query;

  try {
    const response = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.SHOPIFY_CLIENT_ID,
          client_secret: process.env.SHOPIFY_CLIENT_SECRET,
          code,
        }),
      }
    );

    const data = await response.json();

    SHOP_DATA[shop] = data.access_token;

    console.log("✅ Token saved for:", shop);

    res.send("App installed successfully 🚀");
  } catch (err) {
    console.error("OAuth error:", err);
    res.status(500).send("OAuth error");
  }
});

/* ================================
   🔥 GET REAL INVENTORY ITEM ID
================================ */
async function getInventoryItemId(variantId, shop, token) {
  try {
    const response = await fetch(
      `https://${shop}/admin/api/2024-01/variants/${variantId}.json`,
      {
        headers: {
          "X-Shopify-Access-Token": token,
        },
      }
    );

    const data = await response.json();

    console.log("📦 Variant API response:", data);

    return data?.variant?.inventory_item_id;
  } catch (err) {
    console.error("❌ inventory fetch error:", err);
    return null;
  }
}

/* ================================
   📩 SUBSCRIBE API
================================ */
app.post("/notify", async (req, res) => {
  const { email, product_id, variant_id, shop } = req.body;

  console.log("📩 Notify Request:", req.body);

  if (!email || !variant_id || !shop) {
    return res.status(400).json({
      message: "email, variant_id, shop required",
    });
  }

  const token = SHOP_DATA[shop];

  if (!token) {
    return res.status(400).json({
      message: "Shop not authenticated",
    });
  }

  const inventory_item_id = await getInventoryItemId(
    variant_id,
    shop,
    token
  );

  if (!inventory_item_id) {
    return res.status(500).json({
      message: "Inventory ID not found",
    });
  }

  const exists = subscribers.some(
    (u) =>
      u.email === email &&
      u.variant_id === variant_id &&
      u.shop === shop
  );

  if (exists) {
    return res.json({ message: "Already subscribed" });
  }

  subscribers.push({
    email,
    product_id,
    variant_id,
    inventory_item_id: String(inventory_item_id),
    shop,
    notified: false,
  });

  console.log("📦 Subscribers:", subscribers);

  res.json({ success: true });
});

/* ================================
   🔔 SHOPIFY WEBHOOK
================================ */
app.post("/webhook", (req, res) => {
  const data = req.body;

  console.log("📦 Webhook received:", data);

  const inventoryItemId = String(data.inventory_item_id);
  const available = Number(data.available || 0);

  if (available <= 0) {
    return res.sendStatus(200);
  }

  const users = subscribers.filter(
    (u) =>
      String(u.inventory_item_id) === inventoryItemId &&
      !u.notified
  );

  if (users.length > 0) {
    users.forEach((user) => {
      console.log("📧 Notifying:", user.email);
      user.notified = true;
    });

    console.log("✅ SUCCESS: Stock matched & users notified");
  } else {
    console.log("⚠️ No matching subscribers found");
  }

  res.sendStatus(200);
});

/* ================================
   🏠 HOME
================================ */
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

/* ================================
   🚀 START SERVER
================================ */
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});