const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let subscribers = [];

/* -----------------------------
   ✅ SAVE EMAIL (Frontend)
------------------------------*/
app.post("/notify", (req, res) => {
  const { email, product_id, variant_id } = req.body;

  if (!email || !variant_id) {
    return res.status(400).json({ message: "Email & variant_id required" });
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
    notified: false,
  });

  console.log("Saved subscribers:", subscribers);

  res.json({ success: true });
});


/* -----------------------------
   ✅ SHOPIFY WEBHOOK (INVENTORY LEVEL)
------------------------------*/
app.post("/webhook", (req, res) => {
  const data = req.body;

  console.log("🔥 Webhook received:", data);

  /**
   * Shopify inventory webhook usually sends:
   * inventory_item_id OR variant_id OR inventory_levels
   */

  const inventoryItemId =
    data.inventory_item_id ||
    data.inventoryItemId ||
    data.id;

  const available =
    data.available ??
    data.available_quantity ??
    data.quantity ??
    0;

  if (!inventoryItemId) {
    console.log("❌ No inventory_item_id found");
    return res.sendStatus(200);
  }

  console.log("Inventory Item ID:", inventoryItemId);
  console.log("Available:", available);

  // ✅ MATCH subscribers
  const users = subscribers.filter(
    (u) => u.variant_id == inventoryItemId && !u.notified
  );

  console.log("Matched users:", users.length);

  if (available > 0 && users.length > 0) {
    users.forEach((user) => {
      console.log(`📧 Sending email to: ${user.email}`);

      // TODO: integrate real email service (Klaviyo / SendGrid)
      user.notified = true;
    });
  }

  res.sendStatus(200);
});


/* -----------------------------
   HOME
------------------------------*/
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});