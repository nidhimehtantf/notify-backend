const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

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
   📧 EMAIL SETUP
================================ */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ================================
   📧 SEND EMAIL FUNCTION
================================ */
async function sendEmail(to, productId) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "🎉 Product Back in Stock!",
    text: `Good news! Product ${productId} is now available.`,
  });

  console.log("📧 Email sent to:", to);
}

/* ================================
   🚀 AUTH
================================ */
app.get("/auth", (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.send("Shop missing");

  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${process.env.SHOPIFY_CLIENT_ID}` +
    `&scope=read_inventory,read_products` +
    `&redirect_uri=https://notify-backend-2lf3.onrender.com/auth/callback`;

  res.redirect(installUrl);
});

/* ================================
   🔐 CALLBACK
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

    console.log("✅ TOKEN SAVED FOR:", shop);

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
   📩 NOTIFY API
================================ */
app.post("/notify", async (req, res) => {
  const { email, product_id, variant_id, shop } = req.body;

  console.log("📩 Notify Request:", req.body);

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
    shop,
    notified: false,
  });

  console.log("📦 Subscribers:", subscribers);

  res.json({ success: true });
});

/* ================================
   🔔 WEBHOOK
================================ */
app.post("/webhook", async (req, res) => {
  const data = req.body;

  const inventoryItemId = String(data.inventory_item_id);
  const available = data.available ?? 0;

  if (available <= 0) return res.sendStatus(200);

  const users = subscribers.filter(
    (u) =>
      u.inventory_item_id === inventoryItemId && !u.notified
  );

  for (const user of users) {
    try {
      await sendEmail(user.email, user.product_id);

      user.notified = true;

      console.log("📧 Sent:", user.email);
    } catch (err) {
      console.error("Email error:", err);
    }
  }

  res.sendStatus(200);
});

/* ================================
   🧪 HOME
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