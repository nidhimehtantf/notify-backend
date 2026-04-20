const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Temporary storage (real project me DB use karo)
let subscribers = [];

// ✅ API to save email
app.post("/notify", (req, res) => {
  const { email, product_id, variant_id } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email required" });
  }

  // duplicate check
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
    notified: false,
  });

  console.log("Saved:", subscribers);

  res.json({ success: true });
});

// ✅ Shopify Webhook (REAL structure)
app.post("/webhook", (req, res) => {
  const data = req.body;

  console.log("Webhook data:", data);

  const variantId = data.variant_id;
  const available = data.available;

  if (available > 0) {
    const users = subscribers.filter(
      (u) => u.variant_id == variantId && !u.notified
    );

    users.forEach((user) => {
      console.log(`📧 Send email to: ${user.email}`);

      // 👉 yaha real email function call hoga (next step)
      user.notified = true;
    });
  }

  res.sendStatus(200);
});

// ✅ Test route
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});