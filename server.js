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
   🚀 SHOPIFY AUTH START
================================ */
app.get("/auth", (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.send("Shop missing");

  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${process.env.SHOPIFY_CLIENT_ID}` +
    `&scope=read_products,read_inventory` +
    `&redirect_uri=${process.env.REDIRECT_URI}`;

  res.redirect(installUrl);
});

/* ================================
   🔐 CALLBACK (SAVE TOKEN)
================================ */
app.get("/auth/callback", async (req, res) => {
  const { code, shop } = req.query;

  try {
    const response = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    console.error(err);
    res.status(500).send("OAuth error");
  }
});

/* ================================
   🔥 GET INVENTORY ITEM ID
================================ */
async function getInventoryItemId(variantId, shop) {
  try {
    const token = SHOP_DATA[shop];
    if (!token) return null;

    const response = await fetch(
      `https://${shop}/admin/api/2024-01/variants/${variantId}.json`,
      {
        headers: {
          "X-Shopify-Access-Token": token,
        },
      }
    );

    const data = await response.json();

    if (!data.variant) return null;

    return String(data.variant.inventory_item_id);
  } catch (err) {
    console.error(err);
    return null;
  }
}

/* ================================
   📩 SUBSCRIBE API (FRONTEND)
================================ */
app.post("/notify", async (req, res) => {
  const { email, product_id, variant_id, shop } = req.body;

  console.log("📩 Notify request:", req.body);

  if (!email || !variant_id || !shop) {
    return res.status(400).json({
      message: "email, variant_id, shop required",
    });
  }

  const inventory_item_id = await getInventoryItemId(variant_id, shop);

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
    inventory_item_id,
    shop,
    notified: false,
    createdAt: new Date(),
  });

  console.log("📦 Subscribers:", subscribers);

  res.json({
    success: true,
    message: "Subscription saved",
  });
});

/* ================================
   🔔 WEBHOOK (STOCK UPDATE)
================================ */
app.post("/webhook", async (req, res) => {
  const data = req.body;

  console.log("📦 Webhook received:", data);

  const inventoryItemId = String(data.inventory_item_id);
  const available = Number(data.available || 0);

  if (available <= 0) {
    return res.status(200).json({
      message: "No stock available",
    });
  }

  const users = subscribers.filter(
    (u) =>
      u.inventory_item_id === inventoryItemId &&
      u.notified === false
  );

  if (users.length === 0) {
    return res.status(200).json({
      message: "No subscribers found",
    });
  }

  // mark notified (NO EMAIL, ONLY STATUS UPDATE)
  for (const user of users) {
    user.notified = true;
    console.log("✅ Marked notified:", user.email);
  }

  res.status(200).json({
    success: true,
    message: "Stock updated & subscribers marked notified",
    updatedUsers: users.length,
  });
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