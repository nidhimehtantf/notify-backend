const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let subscribers = [];

/* ================================
   🔐 INSTALL (OAuth start)
================================ */
app.get("/install", (req, res) => {
  const shop = process.env.SHOP_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const redirectUri = `https://notify-backend-2lf3.onrender.com/callback`;
  const scopes = "read_inventory,read_products";

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&response_type=code`;

  res.redirect(installUrl);
});

/* ================================
   🔐 CALLBACK (Access token)
================================ */
app.get("/callback", async (req, res) => {
  const { code } = req.query;
  const shop = process.env.SHOP_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  try {
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code
      })
    });

    const data = await response.json();

    console.log("✅ ACCESS TOKEN:", data.access_token);

    res.send("App installed successfully ✅");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error installing app");
  }
});

/* ================================
   🔥 FUNCTION: Get inventory_item_id
================================ */
async function getInventoryItemId(variantId) {
  try {
    const response = await fetch(
      `https://${process.env.SHOP_DOMAIN}/admin/api/2024-01/variants/${variantId}.json`,
      {
        headers: {
          "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN
        }
      }
    );

    const data = await response.json();

    return String(data.variant.inventory_item_id);
  } catch (err) {
    console.error("Error fetching inventory item:", err);
    return null;
  }
}

/* ================================
   📩 NOTIFY API
================================ */
app.post("/notify", async (req, res) => {
  const { email, product_id, variant_id } = req.body;

  if (!email || !variant_id) {
    return res.status(400).json({ message: "Email & variant_id required" });
  }

  try {
    // 🔥 inventory_item_id backend se niklega
    const inventory_item_id = await getInventoryItemId(variant_id);

    if (!inventory_item_id) {
      return res.status(500).json({ message: "Inventory item not found" });
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

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ================================
   🔔 WEBHOOK (Inventory update)
================================ */
app.post("/webhook", (req, res) => {
  const data = req.body;

  console.log("🔥 Webhook received:", data);

  const inventoryItemId = String(data.inventory_item_id);
  const available = data.available ?? 0;

  if (!inventoryItemId) {
    return res.sendStatus(200);
  }

  const users = subscribers.filter(
    (u) => u.inventory_item_id === inventoryItemId && !u.notified
  );

  console.log("👥 Matched users:", users.length);

  if (available > 0 && users.length > 0) {
    users.forEach((user) => {
      console.log(`📧 Send email to: ${user.email}`);
      user.notified = true;
    });
  }

  res.sendStatus(200);
});

/* ================================
   🧪 TEST ROUTE
================================ */
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});