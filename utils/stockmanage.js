const fs = require("fs");
const path = require("path");

const STOCK_DB = path.join(__dirname, "../database/stocks.json");

// ================== SAFE JSON ==================
function safeReadJSON(filePath, defaultData) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }

    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) return defaultData;

    return JSON.parse(raw);
  } catch (e) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
}

function safeWriteJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ================== NORMALIZER ==================
function normId(productId) {
  return String(productId || "").trim().toUpperCase();
}

function normalizeLinesToArray(text) {
  // terima input "List Stock" dari modal (multi-line)
  // hasil: array stock, buang baris kosong
  return String(text || "")
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

// ================== CORE ==================
function loadStocks() {
  // format: { "PDR-001": ["a","b"], "PDR-002": ["x"] }
  return safeReadJSON(STOCK_DB, {});
}

function saveStocks(data) {
  safeWriteJSON(STOCK_DB, data);
}

function ensureProduct(stocksData, productId) {
  const id = normId(productId);
  if (!id) throw new Error("productId kosong");
  if (!Array.isArray(stocksData[id])) stocksData[id] = [];
  return id;
}

// ================== API ==================
function getStockList(productId) {
  const stocks = loadStocks();
  const id = normId(productId);
  return Array.isArray(stocks[id]) ? stocks[id] : [];
}

function getStockCount(productId) {
  return getStockList(productId).length;
}

function setStockList(productId, listOrText) {
  const stocks = loadStocks();
  const id = ensureProduct(stocks, productId);

  const list = Array.isArray(listOrText)
    ? listOrText.map(x => String(x).trim()).filter(Boolean)
    : normalizeLinesToArray(listOrText);

  stocks[id] = list;
  saveStocks(stocks);
  return { id, count: list.length };
}

function addStocks(productId, listOrText) {
  const stocks = loadStocks();
  const id = ensureProduct(stocks, productId);

  const incoming = Array.isArray(listOrText)
    ? listOrText.map(x => String(x).trim()).filter(Boolean)
    : normalizeLinesToArray(listOrText);

  stocks[id].push(...incoming);
  saveStocks(stocks);
  return { id, added: incoming.length, count: stocks[id].length };
}

function popOneStock(productId) {
  const stocks = loadStocks();
  const id = ensureProduct(stocks, productId);

  if (stocks[id].length === 0) return null;

  const item = stocks[id].shift(); // ambil paling atas
  saveStocks(stocks);
  return item;
}

function removeStockAt(productId, index) {
  const stocks = loadStocks();
  const id = ensureProduct(stocks, productId);

  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || i >= stocks[id].length) return null;

  const removed = stocks[id].splice(i, 1)[0];
  saveStocks(stocks);
  return removed;
}

function clearStocks(productId) {
  const stocks = loadStocks();
  const id = normId(productId);
  if (!id) throw new Error("productId kosong");

  stocks[id] = [];
  saveStocks(stocks);
  return true;
}

function deleteProductStocks(productId) {
  const stocks = loadStocks();
  const id = normId(productId);
  if (!id) throw new Error("productId kosong");

  const existed = Object.prototype.hasOwnProperty.call(stocks, id);
  if (existed) {
    delete stocks[id];
    saveStocks(stocks);
  }
  return existed;
}

function renameProductId(oldId, newId) {
  const stocks = loadStocks();
  const from = normId(oldId);
  const to = normId(newId);

  if (!from || !to || from === to) return false;

  // kalau tidak ada stok lama, tetap buat yang baru kosong
  const oldList = Array.isArray(stocks[from]) ? stocks[from] : [];

  // pindahin stok ke id baru
  stocks[to] = oldList;

  // hapus key lama (kalau beda)
  if (from !== to) delete stocks[from];

  saveStocks(stocks);
  return true;
}


module.exports = {
  STOCK_DB,
  loadStocks,
  saveStocks,
  getStockList,
  getStockCount,
  setStockList,
  addStocks,
  popOneStock,
  removeStockAt,
  clearStocks,
  deleteProductStocks,
  renameProductId, // <-- tambah ini
};

