const express = require("express");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

//const FRONT_DIRECTORY = "../front";
//const INDEX_FILE = "index.html";

// dir /front is static
app.use(express.static(path.join(__dirname, "front")));

// any route in index.html (SPA)
// express5 version use "/*"" to get all routes and sub-routes, but in express4 we need to use "*"
// much error in app.get('*', (req, res) => { --- IGNORE ---
// go user app.use(express.static(path.join(__dirname, FRONT_DIRECTORY))); --- IGNORE ---
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "front", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n  ✓ Weather Forecast running in http://localhost:${PORT}\n`);
});
