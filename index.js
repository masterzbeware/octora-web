const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ================== STATIC WEBSITE ==================
app.use(express.static(path.join(__dirname, "public")));

// ================== MAIN ROUTE ==================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ================== HEALTH CHECK ==================
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// ================== START SERVER ==================
app.listen(PORT, () => {
  console.log(`🌐 Website aktif di port ${PORT}`);
});
