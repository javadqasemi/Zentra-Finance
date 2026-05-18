/**
 * @file Budget / CRM / Offers SQLite database module.
 *
 * Lives separately from the original JSON storage. The legacy app continues to
 * use transactions.json / bankAccounts.json / etc. — this module only powers
 * the new Budget module exposed under window.api.budget.* / .contacts.* / .offers.*
 *
 * DB file: %APPDATA%/ZentraFinance/data/budget.db
 *
 * Schema:
 *   contacts        — CRM entries (private persons + companies)
 *   budgets         — manual budget entries (Fixkosten / Variabel / Einnahmen)
 *   offers          — comparable offers (e.g. insurance quotes)
 *   tx_links        — manual links between bank transactions (by tx ID) and contacts
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const Database = require('better-sqlite3');

const DATA_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'ZentraFinance', 'data');
const DB_FILE = path.join(DATA_PATH, 'budget.db');

if (!fs.existsSync(DATA_PATH)) fs.mkdirSync(DATA_PATH, { recursive: true });

/** @type {import('better-sqlite3').Database} */
let db = null;

function init() {
  if (db) return db;
  db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS contacts (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL CHECK(kind IN ('person','company')),
  name          TEXT NOT NULL,
  category      TEXT,
  email         TEXT,
  phone         TEXT,
  website       TEXT,
  address       TEXT,
  notes         TEXT,
  imageSrc      TEXT,
  createdAt     TEXT NOT NULL,
  updatedAt     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contacts_name     ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_contacts_category ON contacts(category);

CREATE TABLE IF NOT EXISTS budgets (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  amount        REAL NOT NULL,
  type          TEXT NOT NULL CHECK(type IN ('fix','variable','income')),
  category      TEXT,
  frequency     TEXT NOT NULL CHECK(frequency IN ('monthly','yearly','once')) DEFAULT 'monthly',
  startDate     TEXT,
  endDate       TEXT,
  contactId     TEXT,
  description   TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  createdAt     TEXT NOT NULL,
  updatedAt     TEXT NOT NULL,
  FOREIGN KEY(contactId) REFERENCES contacts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_budgets_type      ON budgets(type);
CREATE INDEX IF NOT EXISTS idx_budgets_contact   ON budgets(contactId);
CREATE INDEX IF NOT EXISTS idx_budgets_active    ON budgets(active);

CREATE TABLE IF NOT EXISTS offers (
  id            TEXT PRIMARY KEY,
  category      TEXT NOT NULL,
  title         TEXT NOT NULL,
  contactId     TEXT,
  price         REAL NOT NULL,
  frequency     TEXT NOT NULL CHECK(frequency IN ('monthly','yearly','once')) DEFAULT 'yearly',
  termMonths    INTEGER,
  benefits      TEXT,
  score         REAL,
  notes         TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  createdAt     TEXT NOT NULL,
  updatedAt     TEXT NOT NULL,
  FOREIGN KEY(contactId) REFERENCES contacts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_offers_category   ON offers(category);
CREATE INDEX IF NOT EXISTS idx_offers_contact    ON offers(contactId);

CREATE TABLE IF NOT EXISTS tx_links (
  txId          TEXT PRIMARY KEY,
  contactId     TEXT,
  budgetId      TEXT,
  updatedAt     TEXT NOT NULL,
  FOREIGN KEY(contactId) REFERENCES contacts(id) ON DELETE SET NULL,
  FOREIGN KEY(budgetId)  REFERENCES budgets(id)  ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_links_contact  ON tx_links(contactId);
CREATE INDEX IF NOT EXISTS idx_tx_links_budget   ON tx_links(budgetId);
`;

// ── Helpers ──────────────────────────────────────────────────────────────────
const nowIso = () => new Date().toISOString();
const newId  = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

function rowToBudget(r) {
  if (!r) return null;
  return { ...r, active: !!r.active };
}
function rowToOffer(r) {
  if (!r) return null;
  return { ...r, active: !!r.active };
}

// ── Contacts CRUD ────────────────────────────────────────────────────────────
const Contacts = {
  list() {
    return init().prepare('SELECT * FROM contacts ORDER BY name COLLATE NOCASE').all();
  },
  get(id) {
    return init().prepare('SELECT * FROM contacts WHERE id = ?').get(id);
  },
  create(input) {
    const id = input.id || newId('cnt');
    const ts = nowIso();
    const row = {
      id,
      kind:     input.kind || 'company',
      name:     String(input.name || '').trim(),
      category: input.category || null,
      email:    input.email    || null,
      phone:    input.phone    || null,
      website:  input.website  || null,
      address:  input.address  || null,
      notes:    input.notes    || null,
      imageSrc: input.imageSrc || null,
      createdAt: ts,
      updatedAt: ts,
    };
    if (!row.name) throw new Error('contact.name is required');
    init().prepare(`
      INSERT INTO contacts (id, kind, name, category, email, phone, website, address, notes, imageSrc, createdAt, updatedAt)
      VALUES (@id, @kind, @name, @category, @email, @phone, @website, @address, @notes, @imageSrc, @createdAt, @updatedAt)
    `).run(row);
    return row;
  },
  update(input) {
    if (!input || !input.id) throw new Error('contact.id is required');
    const existing = Contacts.get(input.id);
    if (!existing) throw new Error('contact not found');
    const merged = { ...existing, ...input, updatedAt: nowIso() };
    init().prepare(`
      UPDATE contacts SET
        kind = @kind, name = @name, category = @category,
        email = @email, phone = @phone, website = @website,
        address = @address, notes = @notes, imageSrc = @imageSrc,
        updatedAt = @updatedAt
      WHERE id = @id
    `).run(merged);
    return merged;
  },
  remove(id) {
    init().prepare('DELETE FROM contacts WHERE id = ?').run(id);
    return { success: true };
  },
};

// ── Budgets CRUD ─────────────────────────────────────────────────────────────
const Budgets = {
  list() {
    return init()
      .prepare('SELECT * FROM budgets ORDER BY type, label COLLATE NOCASE')
      .all()
      .map(rowToBudget);
  },
  get(id) {
    return rowToBudget(init().prepare('SELECT * FROM budgets WHERE id = ?').get(id));
  },
  create(input) {
    const id = input.id || newId('bdg');
    const ts = nowIso();
    const row = {
      id,
      label:       String(input.label || '').trim(),
      amount:      Number(input.amount) || 0,
      type:        input.type || 'fix',
      category:    input.category || null,
      frequency:   input.frequency || 'monthly',
      startDate:   input.startDate || null,
      endDate:     input.endDate   || null,
      contactId:   input.contactId || null,
      description: input.description || null,
      active:      input.active === false ? 0 : 1,
      createdAt:   ts,
      updatedAt:   ts,
    };
    if (!row.label) throw new Error('budget.label is required');
    init().prepare(`
      INSERT INTO budgets (id, label, amount, type, category, frequency, startDate, endDate, contactId, description, active, createdAt, updatedAt)
      VALUES (@id, @label, @amount, @type, @category, @frequency, @startDate, @endDate, @contactId, @description, @active, @createdAt, @updatedAt)
    `).run(row);
    return rowToBudget(row);
  },
  update(input) {
    if (!input || !input.id) throw new Error('budget.id is required');
    const existing = init().prepare('SELECT * FROM budgets WHERE id = ?').get(input.id);
    if (!existing) throw new Error('budget not found');
    const merged = {
      ...existing,
      ...input,
      active:    input.active === undefined ? existing.active : (input.active ? 1 : 0),
      updatedAt: nowIso(),
    };
    init().prepare(`
      UPDATE budgets SET
        label = @label, amount = @amount, type = @type, category = @category,
        frequency = @frequency, startDate = @startDate, endDate = @endDate,
        contactId = @contactId, description = @description, active = @active,
        updatedAt = @updatedAt
      WHERE id = @id
    `).run(merged);
    return rowToBudget(merged);
  },
  remove(id) {
    init().prepare('DELETE FROM budgets WHERE id = ?').run(id);
    return { success: true };
  },
};

// ── Offers CRUD ──────────────────────────────────────────────────────────────
const Offers = {
  list() {
    return init()
      .prepare('SELECT * FROM offers ORDER BY category, score DESC, price ASC')
      .all()
      .map(rowToOffer);
  },
  byCategory(category) {
    return init()
      .prepare('SELECT * FROM offers WHERE category = ? ORDER BY score DESC, price ASC')
      .all(category)
      .map(rowToOffer);
  },
  create(input) {
    const id = input.id || newId('ofr');
    const ts = nowIso();
    const row = {
      id,
      category:   String(input.category || '').trim(),
      title:      String(input.title    || '').trim(),
      contactId:  input.contactId || null,
      price:      Number(input.price) || 0,
      frequency:  input.frequency || 'yearly',
      termMonths: input.termMonths == null ? null : Number(input.termMonths),
      benefits:   input.benefits || null,
      score:      input.score == null ? null : Number(input.score),
      notes:      input.notes || null,
      active:     input.active === false ? 0 : 1,
      createdAt:  ts,
      updatedAt:  ts,
    };
    if (!row.category || !row.title) throw new Error('offer.category and title are required');
    init().prepare(`
      INSERT INTO offers (id, category, title, contactId, price, frequency, termMonths, benefits, score, notes, active, createdAt, updatedAt)
      VALUES (@id, @category, @title, @contactId, @price, @frequency, @termMonths, @benefits, @score, @notes, @active, @createdAt, @updatedAt)
    `).run(row);
    return rowToOffer(row);
  },
  update(input) {
    if (!input || !input.id) throw new Error('offer.id is required');
    const existing = init().prepare('SELECT * FROM offers WHERE id = ?').get(input.id);
    if (!existing) throw new Error('offer not found');
    const merged = {
      ...existing,
      ...input,
      active:    input.active === undefined ? existing.active : (input.active ? 1 : 0),
      updatedAt: nowIso(),
    };
    init().prepare(`
      UPDATE offers SET
        category = @category, title = @title, contactId = @contactId,
        price = @price, frequency = @frequency, termMonths = @termMonths,
        benefits = @benefits, score = @score, notes = @notes, active = @active,
        updatedAt = @updatedAt
      WHERE id = @id
    `).run(merged);
    return rowToOffer(merged);
  },
  remove(id) {
    init().prepare('DELETE FROM offers WHERE id = ?').run(id);
    return { success: true };
  },
};

// ── Transaction ↔ Contact / Budget links ─────────────────────────────────────
const TxLinks = {
  list() {
    return init().prepare('SELECT * FROM tx_links').all();
  },
  set(txId, { contactId = null, budgetId = null }) {
    const ts = nowIso();
    init().prepare(`
      INSERT INTO tx_links (txId, contactId, budgetId, updatedAt)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(txId) DO UPDATE SET
        contactId = excluded.contactId,
        budgetId  = excluded.budgetId,
        updatedAt = excluded.updatedAt
    `).run(txId, contactId, budgetId, ts);
    return { txId, contactId, budgetId, updatedAt: ts };
  },
  unset(txId) {
    init().prepare('DELETE FROM tx_links WHERE txId = ?').run(txId);
    return { success: true };
  },
};

function close() {
  if (db) { db.close(); db = null; }
}

module.exports = { init, close, Contacts, Budgets, Offers, TxLinks, DB_FILE };
