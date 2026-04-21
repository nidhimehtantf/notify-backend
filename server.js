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
let SHOP_DATA = {}; // token store (optional future use)

/* ================================
   🔥 GET INVENTORY ITEM ID (Shopify)
   (NOTE: requires shop + token in real case)
================================ */
async function getInventoryItemId(variantId) {
  try {
    // ⚠️ DEMO LOGIC (since no shop/token given in request)
    // Real Shopify API call yaha lagega
    console.log("Fetching inventory item for variant:", variantId);

    // 👉 TEMP mapping (replace with Shopify API later)
    return "inv_" + variantId;
  } catch (err) {
    console.error(err);
    return null;
  }
}

/* ================================
   📩 SAVE SUBSCRIBER
================================ */
app.post("/notify", async (req, res) => {
  const { email, product_id, variant_id } = req.body;

  console.log("📩 Notify Request:", req.body);

  if (!email || !variant_id) {
    return res.status(400).json({
      message: "email and variant_id required",
    });
  }

  const inventory_item_id = await getInventoryItemId(variant_id);

  if (!inventory_item_id) {
    return res.status(500).json({
      message: "Inventory ID not found",
    });
  }

  const exists = subscribers.find(
    (u) => u.email === email && u.variant_id === variant_id
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
   🔔 WEBHOOK (STOCK UPDATE)
================================ */
app.post("/webhook", (req, res) => {
  const data = req.body;

  console.log("📦 Webhook received:", data);

  const inventoryItemId = String(data.inventory_item_id);
  const available = Number(data.available || 0);

  if (available > 0) {
    const users = subscribers.filter(
      (u) =>
        u.inventory_item_id === inventoryItemId &&
        u.notified === false
    );

    if (users.length > 0) {
      users.forEach((user) => {
        console.log("📧 Notify user:", user.email);
        user.notified = true;
      });

      console.log("✅ SUCCESS: Stock matched & notifications sent");
    } else {
      console.log("⚠️ No matching subscribers found");
    }
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