const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let subscribers = [];
app.get("/install", (req, res) => {
  const shop = process.env.SHOP_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const redirectUri = `https://notify-backend-2lf3.onrender.com/callback`;
  const scopes = "read_inventory,read_products";

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&response_type=code`;

  res.redirect(installUrl);
});

// ✅ NEW — Callback route (token yahan milega)
app.get("/callback", async (req, res) => {
  const { code } = req.query;
  const shop = process.env.SHOP_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

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
  res.send(`Your token: ${data.access_token}`);
});

// ✅ Variant route (inventory_item_id fetch karne ke liye)
app.get("/variant/:variantId", async (req, res) => {
  const { variantId } = req.params;

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
    res.json({ inventory_item_id: data.variant.inventory_item_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch variant" });
  }
});

app.post("/notify", (req, res) => {
  const { email, product_id, variant_id, inventory_item_id } = req.body;

  if (!email || !variant_id || !inventory_item_id) {
    return res.status(400).json({ message: "Email, variant_id & inventory_item_id required" });
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
    inventory_item_id: String(inventory_item_id), // ✅ string mein save karo
    notified: false,
  });

  console.log("Saved subscribers:", subscribers);
  res.json({ success: true });
});


// ✅ WEBHOOK — ab sahi match hoga
app.post("/webhook", (req, res) => {
  const data = req.body;
  console.log("🔥 Webhook received:", data);

  const inventoryItemId = String(data.inventory_item_id);
  const available = data.available ?? 0;

  if (!inventoryItemId) {
    console.log("❌ No inventory_item_id found");
    return res.sendStatus(200);
  }

  console.log("Inventory Item ID:", inventoryItemId);
  console.log("Available:", available);

  // ✅ Ab inventory_item_id se match hoga
  const users = subscribers.filter(
    (u) => u.inventory_item_id === inventoryItemId && !u.notified
  );

  console.log("Matched users:", users.length);

  if (available > 0 && users.length > 0) {
    users.forEach((user) => {
      console.log(`📧 Sending email to: ${user.email}`);
      user.notified = true;
    });
  }

  res.sendStatus(200);
});
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});