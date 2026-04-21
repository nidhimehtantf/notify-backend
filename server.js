const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let subscribers = [];

/* ================================
   🔐 GLOBAL TOKEN STORAGE
================================ */
let SHOPIFY_ACCESS_TOKEN = "";

/* ================================
   🚀 START OAUTH
================================ */
app.get("/auth", (req, res) => {
  const shop = req.query.shop;

  if (!shop) return res.send("Shop parameter missing");

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const redirectUri =
    "https://notify-backend-2lf3.onrender.com/auth/callback";
  const scopes = "read_inventory,read_products";

  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${clientId}` +
    `&scope=${scopes}` +
    `&redirect_uri=${redirectUri}`;

  res.redirect(installUrl);
});

/* ================================
   🔐 CALLBACK (TOKEN GENERATION)
================================ */
app.get("/auth/callback", async (req, res) => {
  const { code, shop } = req.query;

  if (!code) return res.send("No code received");

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

    SHOPIFY_ACCESS_TOKEN = data.access_token;

    console.log("✅ TOKEN SAVED:", SHOPIFY_ACCESS_TOKEN);

    res.send("App installed successfully 🚀");
  } catch (err) {
    console.error(err);
    res.status(500).send("OAuth error");
  }
});

/* ================================
   🔥 INVENTORY FETCH
================================ */
async function getInventoryItemId(variantId, shop) {
  try {
    const response = await fetch(
      `https://${shop}/admin/api/2024-01/variants/${variantId}.json`,
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        },
      }
    );

    const data = await response.json();

    console.log("Shopify Response:", data);

    if (!data.variant) return null;

    return String(data.variant.inventory_item_id);
  } catch (err) {
    console.error(err);
    return null;
  }
}

/* ================================
   📩 NOTIFY API
================================ */
app.post("/notify", async (req, res) => {
  const { email, product_id, variant_id, shop } = req.body;

  if (!email || !variant_id || !shop) {
    return res.status(400).json({
      message: "Email, shop & variant_id required",
    });
  }

  const inventory_item_id = await getInventoryItemId(variant_id, shop);

  if (!inventory_item_id) {
    return res.status(500).json({
      message: "Inventory item not found",
    });
  }

  const exists = subscribers.find(
    (u) => u.email === email && u.variant_id == variant_id
  );

  if (exists) {
    return res.json({ message: "Already subscribed" });
  }

  subscribers.push({
    email,
    product_id,
    variant_id,
    inventory_item_id,
    notified: false,
  });

  console.log("📦 Subscribers:", subscribers);

  res.json({ success: true });
});

/* ================================
   🔔 WEBHOOK
================================ */
app.post("/webhook", (req, res) => {
  const data = req.body;

  const inventoryItemId = String(data.inventory_item_id);
  const available = data.available ?? 0;

  const users = subscribers.filter(
    (u) => u.inventory_item_id === inventoryItemId && !u.notified
  );

  if (available > 0 && users.length > 0) {
    users.forEach((user) => {
      console.log(`📧 Email to: ${user.email}`);
      user.notified = true;
    });
  }

  res.sendStatus(200);
});

/* ================================
   🧪 TEST
================================ */
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

/* ================================
   🚀 START SERVER
================================ */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});