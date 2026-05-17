/**
 * @file Zentra Finance — Electron main process.
 * Handles window creation, IPC data operations (JSON file I/O),
 * CSV parsing (Migros / UBS / PostFinance / generic), and auto-categorization.
 * Data stored in %APPDATA%\ZentraFinance\data\ as JSON files.
 */
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const log = require('electron-log');
const updater = require('./src/updater');

// Increase GPU tile memory budget — prevents "tile memory limits exceeded" warning
// caused by multiple glass backdrop-filters and animated orbs
app.commandLine.appendSwitch('force-gpu-mem-available-mb', '512');

// ── Crash + uncaught-exception handling ──────────────────────────────────────
// electron-log writes to %APPDATA%\ZentraFinance\logs\main.log
log.transports.file.level = 'info';
log.catchErrors({
  showDialog: false,
  onError(error) {
    log.error('[uncaught]', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Zentra Finance — Unexpected Error',
        message: 'An unexpected error occurred. The error has been logged.',
        detail: String(error?.stack || error?.message || error),
        buttons: ['OK'],
      }).catch(() => {});
    }
  },
});

let mainWindow;

// Data storage path
const DATA_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'ZentraFinance', 'data');
const TRANSACTIONS_FILE = path.join(DATA_PATH, 'transactions.json');
const CATEGORIES_FILE = path.join(DATA_PATH, 'categories.json');
const BANK_ACCOUNTS_FILE = path.join(DATA_PATH, 'bankAccounts.json');
const PROFILE_FILE = path.join(DATA_PATH, 'profile.json');
const USERS_FILE = path.join(DATA_PATH, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_PATH)) {
  fs.mkdirSync(DATA_PATH, { recursive: true });
}

// Extended default categories for auto-categorization (600+ keywords)
// IMPORTANT: categories are checked in insertion order — more-specific entries must come first.
// Auszahlung is intentionally before Lebensmittel so ATM deposits at Migros/UBS are not
// misidentified as grocery purchases.
const DEFAULT_CATEGORIES = {
  'Auszahlung': ['Bargeldbezug', 'ATM', 'Bancomat', 'Postomat', 'Bargeld', 'Bargeldb', 'Einzahlung', 'Geldautomateneinzahlung', 'Cash', 'Bargeldabhebung'],
  'Lebensmittel': ['Migros', 'Coop', 'Aldi', 'Lidl', 'Denner', 'Volg', 'Landi', 'SPAR', 'Primo', 'Otto', 'Märitplatz', 'Manor', 'Jelmoli', 'Globus', 'LIDL', 'ALDI', 'Migros MM', 'Rami Supermarket', 'Rami', 'Supermarket', 'avec', 'Pick Pay', 'WAL*', 'Frischmarkt', 'Confiserie', 'Confiserie Eichenberger', 'Schokolade', 'Lindt', 'Sprüngli', 'Läderach', 'Merkur', 'Alnatura', 'Bio', 'FOOD', 'ZB FOOD', 'Global Supermarkt', 'EDEKA', 'Edeka', 'Marche', 'Meier Tobler', 'Globus', 'Frischmarkt'],
  // Einnahmen is intentionally checked BEFORE Restaurant/Transport so that salary descriptions
  // containing a merchant name (e.g. "Gehaltszahlung McDonald's") are correctly classified.
  // Broad/ambiguous fragments ('bertrag', 'Verg', 'Bundes', 'Staat') are excluded here to avoid
  // forcing expense-typed transactions to income via reconcileType.
  'Einnahmen': ['Lohn', 'Gehalt', 'Gehaltszahlung', 'Lohnzahlung', 'Salär', 'Rente', 'AHV', 'IV', 'EO', 'ALV', 'Krankentaggeld', 'Mieteinnahmen', 'Dividende', 'Zins', 'Rückvergütung', 'EIDGENOSSISCHES', 'INSTITUT FUR', 'INSTITUT F.', 'INSTITUT FÜR', 'Rückerstattung', 'Rückerstatt', 'Erstattung', 'Refund', 'Einschlagweg', 'Saläreingang', 'Zahlungseingang', 'Zahlungseing', 'Lohneingang', 'Gehaltseingang'],
  'Restaurant': ['Restaurant', 'Mensa', 'Gasthaus', 'Bistro', 'Café', 'Take Away', 'McDonald', 'KFC', 'Burger King', 'Subway', 'Starbucks', 'Migros Restaurant', 'Coop Restaurant', 'Kantine', 'Imbiss', 'Burger King', 'Restaurant Uncle', 'Dining', 'SELECTA', 'Marzili Lounge', 'Pizza', 'Pizzeria', 'Ristorante', 'Lounge', 'Dine', 'Eat', 'Gaststätte', 'Wirtshaus', 'Catering', '24 / 7 Catering', 'Waffel', 'Waffel Theke', 'Cafeteria', 'Bäckerei', 'Konditorei', 'Tea Room', 'Buffet', 'SV Restaurant', 'Migros Take Away', 'Blue Lounge', 'La Villa Milli', 'Da Vinci', 'Doga', 'Sam Pizza', 'Kebab', 'König Kebab', 'Bergrestaurant', 'Bergrestaurat', 'Gelateria', 'GELATERIA', 'Beef2go', 'Tacos', 'Go4Tacos', 'OH MY GREEK', 'little istanbul', 'Cafe', 'CAFE', 'Gastro', 'Milli', 'Reinhard', 'Reinhard AG', 'Schloss Laufen', 'Rheinfall', 'Bergbahn', 'Seilbahn', 'SUMUP', 'SUMUP CASABLANCA', 'SUMUP CUCKOO', 'SUMUP CAFE 44', 'SUMUP GLEIS EIS', 'SUMUP BARBER', 'BARBERSHOP', 'Marzili', 'Bistro', 'Istanbul', 'Griechisch', 'Ruedi Russel', 'Russel', 'Grand Hotel', 'Hotel Victoria', 'Victoria-Jungfrau'],
  'Transport': ['SBB', 'ZVV', 'Bahn', 'Bus', 'Tram', 'Taxi', 'Mobility', 'Carsharing', 'UBS Rent', 'Shell', 'BP', 'Avia', 'Migrol', 'Coop Pronto', 'Agrol', 'Tamoil', 'Esso', 'SBB MOBILE', 'SBB CFF', 'CFF FFS', 'BLS', 'BLS mobil', 'Car Wash', 'Autowäsche', 'Autowaschanlage', 'Parkhaus', 'Parking', 'Garage', 'Parkplatz', 'Tiefgarage', 'Eni', 'Total', 'Agip', 'Oil', 'APCOA', 'DB FERNVERKEHR', 'Deutsche Bahn', 'Velo', 'Fahrrad', 'Bike', 'VELOPLUS', 'Ski+Velo', 'WAB', 'Grindelwald', 'Westfalen', 'Westfalen Tankstelle', 'SWISS ICE', 'ICE', 'BVB', 'BVB Klybeck'],
  'Einkaufen': ['Amazon', 'Zalando', 'Galaxus', 'Digitec', 'Apple', 'MediaMarkt', 'Interdiscount', 'IKEA', 'H&M', 'Zara', 'Mango', 'Ochsner Sport', 'Decathlon', 'Otto\'s', 'Migros Outlet', 'SportXX', 'Melectronics', 'FRANZ CARL WEBER', 'Dosenbach', 'Schuhe & Sport', 'APPLE.COM', 'Tenorshare', 'C & A', 'Loeb', 'Müller', 'Müller Handels', 'Muller', 'Muller Handels', 'Kiosk', 'Tabak', 'Buchhandlung', 'Libro', 'Papeterie', 'Zumstein', 'Papeterie Zumstein', 'Ackermann', 'Blumen', 'Blumen Ackermann', 'Flying Tiger', 'Flying Tiger Copenhagen', 'New Yorker', 'New Yorker Schweiz', 'Tally Weijl', 'S Oliver', 'C&A', 'Manor', 'Jelmoli', 'Globus', 'COOP City', 'Loeb', 'Loeb AG', 'Dosenbach', 'Deichmann', 'Bata', 'Manor Food', 'Ari Swiss', 'Ari Swiss GmbH', 'Micos', 'Migros Micos', 'Sportxx', 'Ochsner', 'Ochsner Sport', 'Jungfrau Shopping', 'Shopping', 'SHEIN', 'SHEIN.COM', 'shein.com', 'Temu', 'TEMU', 'Action', 'KiK', 'Kik', 'Chicoree', 'Chicoree Mode', 'Orchestra', 'ORCHESTRA', 'Orell Füssli', 'Orell Fussli', 'Fust', 'FUST', 'INTERSPORT', 'Intersport', 'Rent-Network', 'Rituals', 'Rituals Bern', 'Bureaurama', 'Le Petit Bazar', 'Petit Bazar', 'Mavric', 'Thangeswaran', 'Ruedu', 'RUEDU', 'Schaufelberger', 'Schaufelberger AG', 'J. Stolzenberg', 'Stolzenberg', 'Immer AG', 'Immer', 'Diba', 'Aggarwal', 'ACTALIS'],
  'Gesundheit': ['Apotheke', 'Pharmacie', 'Zahnarzt', 'Arzt', 'Spital', 'Klinik', 'Sanitas', 'CSS', 'Swica', 'Helsana', 'Assura', 'Groupe Mutuel', 'Atupri', 'Drogerie', 'Migros Drogerie', 'Physiotherapie', 'Osteopathie', 'Psychologie', 'Therapie', 'Amplifon', 'Hörgerät', 'Hörakustik', 'Optik', 'Brille', 'Augenarzt', 'Zahnklinik', 'Dental', 'Notfall', 'Rettung', 'Salon Darwish', 'Darwish'],
  'Wohnen': ['Miete', 'Nebenkosten', 'Strom', 'Wasser', 'Internet', 'Swisscom', 'Sunrise', 'Salt', 'UPC', 'Quickline', 'IKEA', 'Jumbo', 'Bauhaus', 'Coop Bau+Hobby', 'HOSTINGER', 'CLOUDFLARE', 'HETZNER', 'OBI', 'Baucenter', 'Hornbach', 'Jumbo', 'Microspot', 'Brack', 'TechShop', 'PAYPAL *HETZNER', 'hoststar', 'hoststar.ch', 'www.hoststar', 'Jysk', 'JYSK', 'Möbel', 'Einrichtung', 'Depot', 'Pfister', 'Möbel Pfister', 'Möbelpunkt', 'Interio', 'Bitwarden', 'BITWARDEN', 'Godaddy', 'GODADDY', 'GoDaddy', 'DNH*GODADDY', 'Zoho', 'ZOHO', 'Zoho-One', 'Zoho-Workplace', 'Zoho Corp', 'Moonshot', 'MOONSHOT', 'Moonshot AI', 'Coolors', 'PADDLE', 'Paddle.net', 'Anthropic', 'ANTHROPIC', 'GO RENT', 'GO RENT RESID', 'Werner Mandli', 'Mandli'],
  'Unterhaltung': ['Netflix', 'Spotify', 'Disney', 'Apple TV', 'YouTube', 'Prime Video', 'Sky', 'Cinema', 'Ticketcorner', 'Starticket', 'Pathe', 'Kitag', 'Casino', 'Lotto', 'BounceLab', 'Adventure Dome', 'Fun', 'Play', 'Spiel', 'Freizeit', 'Erlebnis', 'Events', 'Harder Kulm', 'Harder Kulm GmbH', 'Rialto', 'Rialto AG', 'Kino', 'Film', 'Movie', 'Theater', 'Konzert', 'Museum', 'Zoo', 'Tierpark', 'Seilbahn', 'Bergbahn', 'Gondelbahn', 'Aquaparc', 'Alpamare', 'Therme', 'Bad', 'Schwimmbad', 'Schloss Laufen', 'Rheinfall', 'Bern Expo', 'BERNEXPO', 'Meet Point'],
  'Bildung': ['Kurs', 'Weiterbildung', 'ETH', 'Uni', 'FH', 'Bücher', 'LinkedIn Learning', 'Udemy', 'Coursera', 'Moodle', 'StadtZug', 'Kanton Zug', 'TechSmith', 'CLAUDE.AI', 'CHATGPT', 'OPENAI', 'Software', 'Lizenz', 'Subscription', 'Microsoft', 'Microsoft Store', 'MS Store', 'Office 365', 'Adobe', 'Adobe Creative', 'AutoCAD', 'VMware', 'Oracle', 'SAP', 'Khan Academy', 'Klett', 'Lehrmittelverlag', 'Moonshot', 'MOONSHOT', 'Moonshot AI', 'Zoho', 'ZOHO', 'Zoho-One', 'Zoho-Workplace', 'Zoho Corp', 'Bitwarden', 'BITWARDEN', 'Coolors', 'PADDLE', 'Paddle.net', 'Anthropic', 'ANTHROPIC'],
  'Finanzen': ['Steuern', 'Quellensteuer', 'Vermögenssteuer', 'Bankgebühren', 'Kreditkarte', 'Visa', 'Mastercard', 'American Express', 'Hypothek', 'Darlehen', 'Kontoführung', 'Kontof', 'Saldo DL-Preisabschluss', 'Gemeinde', 'Einwohnerkontrolle', 'Pass', 'Identität', 'FINANZVERWALTUNG', 'Finanzverwaltung', 'Steueramt', 'Zoll', 'Bundes', 'Kanton', 'Gebühr', 'Gebühren', 'Strafrecht', 'Busse', 'Rechtsanwalt', 'Kontoführungsgebühr', 'Kontofhrungsgebhr', 'Verrechnung', 'Zahlungsverkehrsspesen', 'Spesen', 'BVB', 'Klybeck'],
  'Versicherungen': ['Haftpflicht', 'Autoversicherung', 'Hausrat', 'Rechtsschutz', 'Lebensversicherung', 'Allianz', 'Zurich', 'AXA', 'Die Mobiliar', 'Baloise', 'Generali', 'Helvetia', 'Versicherung', 'Pannenhilfe', 'TCS', 'ACS', 'AMAG', 'Garage', 'AutoService', 'SV Schweiz', 'SV Schweiz AG', 'Sozialversicherung', 'SV (Schweiz)', 'SV Schweiz'],
  'Dienstleistungen': ['Anwalt', 'Steuerberater', 'Treuhand', 'Buchhaltung', 'Reinigung', 'Coiffeur', 'Friseur', 'Nagelstudio', 'Massage', 'Physiotherapie', 'Post CH AG', 'Post', 'Copy Quick', 'Druckerei', 'Copyshop', 'Schlüsseldienst', 'Schreinerei', 'Installateur', 'Elektriker', 'Viber', 'WWW.VIBER', 'VIBER.COM', 'Telekom', 'Telekommunikation', 'Swisscom', 'Sunrise', 'Salt', 'Quickline', 'Wingo', 'TalkTalk', 'Barbershop', 'Barber', 'Salon', 'Darwish', 'SUMUP BARBER', 'SUMUP BARbershop'],
  'Spenden': ['Spende', 'Charity', 'UNICEF', 'WWF', 'Rotes Kreuz', 'Caritas', 'Greenpeace', 'Amnesty', 'Pro Natura', 'Glückskette', 'Solidarität', 'Hilfswerk'],
  'Transfer': ['Überweisung', 'E-Banking', 'Banktransfer', 'Standing Order', 'Dauerauftrag', 'TWINT', 'Debitkarte', 'Zahlung Debitkarte', 'Wise', 'Wise.com', 'TransferWise', 'Revolut', 'PayPal', 'Paypal', 'PAYPAL', 'MoneyGram', 'Western Union', 'Übertrag', 'bertrag', 'Vergütung', 'Vergutung'],
  'Sonstiges': []
};

// Pre-built lowercase keyword lookup for fast autoCategorize
const _lowerCategoryMap = Object.entries(DEFAULT_CATEGORIES).map(([cat, kws]) => [
  cat,
  kws.map(k => k.toLowerCase())
]);

// Flat keyword→original-casing lookup for extractQuelle
const _quelleKeywords = [];
for (const kws of Object.values(DEFAULT_CATEGORIES)) {
  for (const kw of kws) {
    _quelleKeywords.push({ lower: kw.toLowerCase(), original: kw });
  }
}
// Sort longest first so "Migros Restaurant" matches before "Migros"
_quelleKeywords.sort((a, b) => b.lower.length - a.lower.length);

/**
 * Extract the Quelle (source entity) from a transaction description.
 * Returns the matched keyword in its original casing, or falls back to
 * the first meaningful segment of the description.
 * @param {string} description - Cleaned transaction description.
 * @returns {string} Extracted source entity name.
 */
function extractQuelle(description) {
  if (!description) return '';
  const lower = description.toLowerCase();

  // Try to match longest known keyword first
  for (const { lower: kw, original } of _quelleKeywords) {
    if (kw.length >= 3 && lower.includes(kw)) {
      return original;
    }
  }

  // Fallback: take the first meaningful segment of the description
  // Strip common prefixes like "Einkauf", "Zahlung", "TWINT", etc.
  let fallback = description
    .replace(/^(Einkauf|Zahlung|Gutschrift|Belastung|TWINT|Debitkarte|Kreditkarte|E-Banking|Dauerauftrag|Standing Order)\s*/i, '')
    .trim();
  // Take first segment (split on common delimiters)
  const seg = fallback.split(/[,;|\/]/).filter(Boolean)[0];
  return (seg || description).trim().substring(0, 60);
}

// Initialize storage
function initStorage() {
  if (!fs.existsSync(TRANSACTIONS_FILE)) {
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(CATEGORIES_FILE)) {
    fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(DEFAULT_CATEGORIES));
  }
  if (!fs.existsSync(BANK_ACCOUNTS_FILE)) {
    fs.writeFileSync(BANK_ACCOUNTS_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(PROFILE_FILE)) {
    fs.writeFileSync(PROFILE_FILE, JSON.stringify({
      firstName: '',
      lastName: '',
      email: '',
      imageSrc: null
    }));
  }
  if (!fs.existsSync(USERS_FILE)) {
    // Seed from existing profile if available
    let seedProfile = { firstName: '', lastName: '', email: '', imageSrc: null };
    try {
      const existing = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8'));
      if (existing.firstName || existing.lastName) seedProfile = existing;
    } catch (_e) { /* ignore missing profile */ }
    const adminUser = {
      id: 'usr_' + Date.now(),
      firstName: seedProfile.firstName || 'Admin',
      lastName: seedProfile.lastName || '',
      email: seedProfile.email || '',
      role: 'admin',
      imageSrc: seedProfile.imageSrc || null,
      createdAt: new Date().toISOString()
    };
    fs.writeFileSync(USERS_FILE, JSON.stringify([adminUser], null, 2));
  }
}

initStorage();

/**
 * Read and parse a JSON file, returning a fallback value on error.
 * @param {string} filePath - Absolute path to the JSON file.
 * @param {*} [fallback=[]] - Value returned when the file is missing or unparseable.
 * @returns {Promise<*>} Parsed JSON content or the fallback.
 */
async function readJSON(filePath, fallback = []) {
  try {
    return JSON.parse(await fsp.readFile(filePath, 'utf8'));
  } catch (err) {
    console.warn('readJSON failed:', filePath, err.message);
    return fallback;
  }
}

/**
 * Write data as pretty-printed JSON. Throws on failure.
 * @param {string} filePath - Absolute path to the JSON file.
 * @param {*} data - Data to serialize.
 * @returns {Promise<void>}
 */
async function safeWrite(filePath, data) {
  try {
    await fsp.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Write failed:', filePath, err.message);
    throw err;
  }
}

// In-memory caches — avoid re-reading JSON files on every IPC call
let _categoryCache = null;
async function getCategories() {
  if (!_categoryCache) _categoryCache = await readJSON(CATEGORIES_FILE, DEFAULT_CATEGORIES);
  return _categoryCache;
}
function invalidateCategoryCache() { _categoryCache = null; }

let _transactionCache = null;
async function getTransactions() {
  if (!_transactionCache) _transactionCache = await readJSON(TRANSACTIONS_FILE, []);
  return _transactionCache;
}

let _bankAccountCache = null;
async function getBankAccounts() {
  if (!_bankAccountCache) _bankAccountCache = await readJSON(BANK_ACCOUNTS_FILE, []);
  return _bankAccountCache;
}

/**
 * Match a transaction description against 600+ keywords to assign a category.
 * Uses the pre-built `_lowerCategoryMap` for case-insensitive first-match-wins lookup.
 * @param {string} description - Transaction description text.
 * @returns {string} Category name (defaults to 'Sonstiges').
 */
function autoCategorize(description) {
  const lowerDesc = description.toLowerCase();

  for (const [category, lowerKeywords] of _lowerCategoryMap) {
    for (const kw of lowerKeywords) {
      if (lowerDesc.includes(kw)) {
        return category;
      }
    }
  }
  return 'Sonstiges';
}

/** Categories whose transactions are always treated as income. */
const INCOME_CATEGORIES = new Set(['Einnahmen']);

/**
 * Override transaction type when it contradicts the category.
 * e.g. a negative-amount transaction categorized as 'Einnahmen' becomes 'income'.
 * @param {string} type - Current type ('income'|'expense'|'transfer').
 * @param {string} category - Resolved category name.
 * @returns {string} Corrected type.
 */
function reconcileType(type, category) {
  if (INCOME_CATEGORIES.has(category)) return 'income';
  return type;
}

/**
 * Parse a Migros Bank CSV file (semicolon-separated, Swiss number format).
 * @param {string} filePath - Absolute path to the CSV file.
 * @returns {Promise<Object[]>} Array of transaction objects.
 */
async function parseMigrosCSV(filePath) {
  const content = await fsp.readFile(filePath, 'utf8');
  const lines = content.split('\n');
  const transactions = [];
  
  let headerFound = false;
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    if (line.includes('Datum') && line.includes('Buchungstext') && line.includes('Betrag')) {
      headerFound = true;
      continue;
    }
    
    if (!headerFound) continue;
    
    const parts = line.split(';');
    if (parts.length >= 3) {
      const date = parts[0].trim();
      const description = parts[1].trim();
      const amountStr = parts[2].trim().replace('CHF', '').replace('USD', '').trim();
      const amount = parseFloat(amountStr.replace(/'/g, '').replace(',', '.'));
      
      if (!isNaN(amount) && amount !== 0) {
        const category = autoCategorize(description);
        const cleaned = cleanDescription(description);
        transactions.push({
          id: 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11),
          date: convertDate(date),
          description: cleaned,
          originalDescription: description,
          amount: Math.abs(amount),
          type: reconcileType(amount < 0 ? 'expense' : 'income', category),
          category,
          quelle: extractQuelle(cleaned),
          source: 'migros',
          bankAccountId: null,
          importedAt: new Date().toISOString()
        });
      }
    }
  }
  
  return transactions;
}

/**
 * Parse a UBS CSV file (22-column UTF-8 BOM format, debit/credit columns).
 * @param {string} filePath - Absolute path to the CSV file.
 * @returns {Promise<Object[]>} Array of transaction objects.
 */
async function parseUBSCSV(filePath) {
  let content = await fsp.readFile(filePath, 'utf8');

  // Remove UTF-8 BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.substring(1);
  }

  const lines = content.split('\n');
  const transactions = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip header line
    if (i === 0) continue;
    
    const parts = line.split(';');
    
    if (parts.length >= 22) {
      const bookingDate = parts[10]?.trim();
      const description = parts[12]?.trim();
      const debit = (parts[18]?.trim() || '').replace(/'/g, '').replace(',', '.');
      const credit = (parts[19]?.trim() || '').replace(/'/g, '').replace(',', '.');
      
      let amount = 0;
      let type = 'expense';
      
      if (debit && parseFloat(debit) > 0) {
        amount = parseFloat(debit);
        type = 'expense';
      } else if (credit && parseFloat(credit) > 0) {
        amount = parseFloat(credit);
        type = 'income';
      }
      
      if (amount > 0 && description) {
        const category = autoCategorize(description);
        const cleaned = cleanUBSDescription(description);
        transactions.push({
          id: 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11),
          date: convertDate(bookingDate),
          description: cleaned,
          originalDescription: description,
          amount: amount,
          type: reconcileType(type, category),
          category,
          quelle: extractQuelle(cleaned),
          source: 'ubs',
          bankAccountId: null,
          importedAt: new Date().toISOString()
        });
      }
    }
  }
  
  return transactions;
}

/**
 * Parse a generic CSV file (PostFinance and unknown formats).
 * Auto-detects header rows containing 'datum'/'buchungstext'.
 * @param {string} filePath - Absolute path to the CSV file.
 * @returns {Promise<Object[]>} Array of transaction objects.
 */
async function parseGenericCSV(filePath) {
  const content = await fsp.readFile(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const transactions = [];
  
  let headerFound = false;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (!line.trim()) continue;

    // Skip header
    if (line.toLowerCase().includes('datum') && line.toLowerCase().includes('buchungstext')) {
      headerFound = true;
      continue;
    }

    // Treat the very first non-empty line as a header if it hasn't been identified yet
    if (!headerFound && li === 0) {
      headerFound = true;
      continue;
    }
    
    const parts = line.split(';');
    if (parts.length >= 3) {
      const date = parts[0].trim();
      const description = parts[1].trim();
      const amountStr = parts[2].trim().replace('CHF', '').replace('USD', '').trim();
      
      // Handle both comma and dot as decimal separator
      const amountNormalized = amountStr.replace(/'/g, '').replace(',', '.');
      const amount = parseFloat(amountNormalized);
      
      if (!isNaN(amount) && amount !== 0) {
        const category = autoCategorize(description);
        const cleaned = cleanDescription(description);
        transactions.push({
          id: 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11),
          date: convertDate(date),
          description: cleaned,
          originalDescription: description,
          amount: Math.abs(amount),
          type: reconcileType(amount < 0 ? 'expense' : 'income', category),
          category,
          quelle: extractQuelle(cleaned),
          source: 'generic',
          bankAccountId: null,
          importedAt: new Date().toISOString()
        });
      }
    }
  }
  
  return transactions;
}

/**
 * Strip noise from UBS transaction descriptions (phone numbers, IDs, amounts).
 * @param {string} desc - Raw UBS description.
 * @returns {string} Cleaned description.
 */
function cleanUBSDescription(desc) {
  return desc
    .replace(/\s+/g, ' ')
    .replace(/\+41\d{9}/g, '')
    .replace(/TWINT-ACC\.:.*?\s/g, '')
    .replace(/993\d+/g, '')
    .replace(/AH\d+/g, '')
    .replace(/,\s*CH\/.*/g, '')
    .replace(/VOM \d{2}\.\d{2}\.\d{2}.*/g, '')
    .replace(/ID:\s*\d+/g, '')
    .replace(/BETRAG CHF \d+\.?\d*/g, '')
    .trim();
}

/**
 * Convert Swiss date format DD.MM.YYYY to ISO YYYY-MM-DD.
 * Falls back to Date.parse for other formats. Returns null on invalid input.
 * @param {string} dateStr - Date string to convert.
 * @returns {string|null} ISO date string or null.
 */
function convertDate(dateStr) {
  if (!dateStr) {
    console.warn('convertDate: empty date string');
    return null;
  }
  const parts = dateStr.trim().split('.');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const iso = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    if (!isNaN(Date.parse(iso))) return iso;
    console.warn('convertDate: invalid DD.MM.YYYY date:', dateStr);
    return null;
  }
  if (!isNaN(Date.parse(dateStr))) return dateStr;
  console.warn('convertDate: unrecognized date format:', dateStr);
  return null;
}

/**
 * Strip card numbers, amounts, and timestamps from Migros/generic descriptions.
 * @param {string} desc - Raw description.
 * @returns {string} Cleaned description.
 */
function cleanDescription(desc) {
  return desc
    .replace(/Einkauf\s*/g, '')
    .replace(/Karte:\s*\d+\*+\d+/g, '')
    .replace(/Betrag:\s*(CHF|USD)\s*[\d.,]+/g, '')
    .replace(/\d{2}\.\d{2}\.\d{4}\s*\d{2}:\d{2}/g, '')
    .replace(/TWINT Belastung\s*/g, 'TWINT ')
    .trim();
}

// ============ IPC Handlers ============

// Transactions
ipcMain.handle('db:getTransactions', async () => {
  const transactions = await getTransactions();
  // Repair any existing transactions whose type contradicts their category
  let dirty = false;
  transactions.forEach(t => {
    const correct = reconcileType(t.type, t.category);
    if (correct !== t.type) { t.type = correct; dirty = true; }
    // Self-transfers (Übertrag / UEBERTRAG between own accounts) are neutral — not income.
    // Check description regardless of category: 'Gutschrift Übertrag' lands in Einnahmen
    // (due to 'Gutschrift' keyword) but is still a self-transfer, not real income.
    if (t.type === 'income') {
      const desc = (t.description || t.originalDescription || '').toLowerCase();
      if (desc.includes('bertrag') || desc.includes('uebertrag')) {
        t.type = 'transfer';
        dirty = true;
      }
    }
    // Backfill quelle for transactions that don't have it yet
    if (!t.quelle) {
      t.quelle = extractQuelle(t.description || t.originalDescription || '');
      if (t.quelle) dirty = true;
    }
  });
  if (dirty) { await safeWrite(TRANSACTIONS_FILE, transactions); _transactionCache = transactions; }
  return transactions;
});

ipcMain.handle('db:updateTransaction', async (e, data) => {
  const transactions = await getTransactions();
  const idx = transactions.findIndex(t => t.id === data.id);
  
  if (idx >= 0) {
    transactions[idx] = { ...transactions[idx], ...data, updatedAt: new Date().toISOString() };
  } else {
    transactions.push({ ...data, createdAt: new Date().toISOString() });
  }
  
  await safeWrite(TRANSACTIONS_FILE, transactions);
  _transactionCache = transactions;
  return { success: true };
});

ipcMain.handle('db:deleteTransaction', async (e, id) => {
  const transactions = await getTransactions();
  const filtered = transactions.filter(t => t.id !== id);
  await safeWrite(TRANSACTIONS_FILE, filtered);
  _transactionCache = filtered;
  return { success: true };
});

let _importLock = false;
ipcMain.handle('db:importTransactions', async (e, newTransactions) => {
  if (_importLock) return { success: false, count: 0, error: 'Import already in progress' };
  if (!Array.isArray(newTransactions)) return { success: false, count: 0 };
  _importLock = true;
  try {
  const transactions = await getTransactions();
  let added = 0;

  // Build a hash set from existing transactions for O(1) duplicate lookups
  const txKey = t => `${t.date}|${Math.round(t.amount * 100)}|${t.description}`;
  const existingKeys = new Set(transactions.map(txKey));

  for (const t of newTransactions) {
    if (!t || typeof t !== 'object') continue;
    const key = txKey(t);
    if (!existingKeys.has(key)) {
      // Fix self-transfers before storing: 'Gutschrift Übertrag' etc. → type 'transfer'
      if (t.type === 'income') {
        const desc = (t.description || t.originalDescription || '').toLowerCase();
        if (desc.includes('bertrag') || desc.includes('uebertrag')) {
          t.type = 'transfer';
        }
      }
      transactions.push(t);
      existingKeys.add(key);
      added++;
    }
  }

  await safeWrite(TRANSACTIONS_FILE, transactions);
  _transactionCache = transactions;
  return { success: true, count: added };
  } finally { _importLock = false; }
});

// Categories
ipcMain.handle('db:getCategories', async () => {
  return await readJSON(CATEGORIES_FILE, {});
});

ipcMain.handle('db:saveCategories', async (e, categories) => {
  await safeWrite(CATEGORIES_FILE, categories);
  invalidateCategoryCache();
  return { success: true };
});

// Bank Accounts
ipcMain.handle('db:getBankAccounts', async () => {
  return await getBankAccounts();
});

ipcMain.handle('db:saveBankAccount', async (e, account) => {
  const accounts = await getBankAccounts();
  const idx = accounts.findIndex(a => a.id === account.id);
  
  if (idx >= 0) {
    accounts[idx] = { ...accounts[idx], ...account, updatedAt: new Date().toISOString() };
  } else {
    accounts.push({ ...account, createdAt: new Date().toISOString() });
  }
  
  await safeWrite(BANK_ACCOUNTS_FILE, accounts);
  _bankAccountCache = accounts;
  return { success: true };
});

ipcMain.handle('db:updateBankAccount', async (e, account) => {
  const accounts = await getBankAccounts();
  const idx = accounts.findIndex(a => a.id === account.id);

  if (idx >= 0) {
    accounts[idx] = { ...accounts[idx], ...account, updatedAt: new Date().toISOString() };
    await safeWrite(BANK_ACCOUNTS_FILE, accounts);
    _bankAccountCache = accounts;
  }

  return { success: true };
});

ipcMain.handle('db:deleteBankAccount', async (e, id) => {
  const accounts = await getBankAccounts();
  const filtered = accounts.filter(a => a.id !== id);
  await safeWrite(BANK_ACCOUNTS_FILE, filtered);
  _bankAccountCache = filtered;

  // Remove bankAccountId from transactions
  const transactions = await getTransactions();
  transactions.forEach(t => {
    if (t.bankAccountId === id) t.bankAccountId = null;
  });
  await safeWrite(TRANSACTIONS_FILE, transactions);
  _transactionCache = transactions;
  
  return { success: true };
});

// Profile
ipcMain.handle('db:getProfile', async () => {
  return await readJSON(PROFILE_FILE, { firstName: '', lastName: '', email: '' });
});

ipcMain.handle('db:saveProfile', async (e, profile) => {
  await safeWrite(PROFILE_FILE, profile);
  return { success: true };
});

// Users
ipcMain.handle('db:getUsers', async () => {
  return await readJSON(USERS_FILE, []);
});

ipcMain.handle('db:saveUser', async (e, user) => {
  const users = await readJSON(USERS_FILE, []);
  if (!user.id) {
    user.id = 'usr_' + Date.now();
    user.createdAt = new Date().toISOString();
  }
  const idx = users.findIndex(u => u.id === user.id);
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...user };
  } else {
    users.push(user);
  }
  await safeWrite(USERS_FILE, users);
  return { success: true, user: idx >= 0 ? users[idx] : user };
});

ipcMain.handle('db:deleteUser', async (e, userId) => {
  let users = await readJSON(USERS_FILE, []);
  users = users.filter(u => u.id !== userId);
  await safeWrite(USERS_FILE, users);
  return { success: true };
});

// Stats
ipcMain.handle('db:getStats', async () => {
  const transactions = await getTransactions();
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  
  const byCategory = {};
  transactions.forEach(t => {
    if (!byCategory[t.category]) byCategory[t.category] = 0;
    byCategory[t.category] += t.amount;
  });
  
  const byMonth = {};
  transactions.forEach(t => {
    const month = t.date.substring(0, 7);
    if (!byMonth[month]) byMonth[month] = { income: 0, expense: 0 };
    if (t.type === 'income') byMonth[month].income += t.amount;
    else byMonth[month].expense += t.amount;
  });
  
  return { 
    totalIncome, 
    totalExpense, 
    totalBalance: totalIncome - totalExpense,
    transactionCount: transactions.length,
    byCategory,
    byMonth
  };
});

// Rename a category across all transactions
ipcMain.handle('db:renameCategory', async (e, { oldName, newName }) => {
  const trimmed = (newName || '').trim();
  if (!oldName || !trimmed || trimmed === oldName) {
    return { success: false, count: 0, error: 'Invalid category name' };
  }
  const transactions = await getTransactions();
  let count = 0;
  transactions.forEach(t => {
    if (t.category === oldName) { t.category = trimmed; count++; }
  });
  await safeWrite(TRANSACTIONS_FILE, transactions);
  _transactionCache = transactions;
  return { success: true, count };
});

// Clear all data
ipcMain.handle('db:clearAllData', async () => {
  await safeWrite(TRANSACTIONS_FILE, []);
  await safeWrite(BANK_ACCOUNTS_FILE, []);
  await safeWrite(PROFILE_FILE, { firstName: '', lastName: '', email: '' });
  _transactionCache = [];
  _bankAccountCache = [];
  invalidateCategoryCache();
  return { success: true };
});

// File dialog for CSV import
ipcMain.handle('dialog:openCSV', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];

    // Validate file path
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) return { success: false, error: 'Selected path is not a file' };
    } catch {
      return { success: false, error: 'File not found or inaccessible' };
    }
    if (!filePath.toLowerCase().endsWith('.csv')) {
      return { success: false, error: 'Only .csv files are supported' };
    }

    const fileName = path.basename(filePath).toLowerCase();

    // Detect by filename first
    if (fileName.includes('migros')) {
      const transactions = await parseMigrosCSV(filePath);
      return { success: true, transactions, source: 'migrosbank', filePath, count: transactions.length };
    } else if (fileName.includes('ubs')) {
      // UBS exports come in two flavours:
      //  - raw 22-column e-banking export (contains 'Zahlungsbeschreibung' / 'Bewertungsdatum')
      //  - simplified 4-column export (Datum;Buchungstext;Betrag;Valuta) — same shape as Migros
      // Pick parser by header content, not by filename, so the simplified export doesn't
      // silently drop every row when parts.length < 22.
      const peek = (await fsp.readFile(filePath, 'utf8')).substring(0, 2000);
      const isFullUbs = peek.includes('Zahlungsbeschreibung') || peek.includes('Bewertungsdatum');
      const transactions = isFullUbs
        ? await parseUBSCSV(filePath)
        : await parseGenericCSV(filePath);
      return { success: true, transactions, source: 'ubs', filePath, count: transactions.length };
    }

    // Detect by content
    const content = (await fsp.readFile(filePath, 'utf8')).substring(0, 2000);

    if (content.includes('Zahlungsbeschreibung') || content.includes('Bewertungsdatum')) {
      const transactions = await parseUBSCSV(filePath);
      return { success: true, transactions, source: 'ubs', filePath, count: transactions.length };
    } else if (fileName.includes('postfinance') || fileName.includes('post')) {
      const transactions = await parseGenericCSV(filePath);
      return { success: true, transactions, source: 'postfinance', filePath, count: transactions.length };
    } else {
      // Try generic CSV format (Datum;Buchungstext;Betrag)
      const transactions = await parseGenericCSV(filePath);
      if (transactions.length > 0) {
        return { success: true, transactions, source: 'generic', filePath, count: transactions.length };
      }
    }
    
    return { success: false, error: 'Unknown CSV format - expected columns: Datum;Buchungstext;Betrag' };
  }
  return { success: false };
});

// ============ CSV Export ============

/**
 * Export transactions as a semicolon-separated CSV file (BOM prefix for Excel).
 * @param {Object} opts
 * @param {Object[]} opts.transactions - Array of transaction objects.
 * @param {string} [opts.format='simple'] - 'simple' (date;description;amount;category;type) or 'full' (all fields).
 * @returns {Promise<{success: boolean, filePath?: string}>}
 */
ipcMain.handle('dialog:exportCSV', async (e, { transactions: txs, format = 'simple' }) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Transactions',
    defaultPath: `zentra-export-${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: 'CSV Files', extensions: ['csv'] }],
  });
  if (!filePath) return { success: false };

  let header, rows;
  if (format === 'full') {
    header = 'Date;Description;Amount;Type;Category;Quelle;Account ID;Source;Imported At';
    rows = txs.map(t =>
      [t.date, `"${(t.description || '').replace(/"/g, '""')}"`, t.amount, t.type, t.category || '', `"${(t.quelle || '').replace(/"/g, '""')}"`, t.bankAccountId || '', t.source || '', t.importedAt || ''].join(';')
    );
  } else {
    header = 'Date;Description;Amount;Category;Type;Quelle';
    rows = txs.map(t =>
      [t.date, `"${(t.description || '').replace(/"/g, '""')}"`, t.amount, t.category || '', t.type, `"${(t.quelle || '').replace(/"/g, '""')}"`].join(';')
    );
  }

  const csv = '\uFEFF' + header + '\n' + rows.join('\n');
  await fsp.writeFile(filePath, csv, 'utf8');
  return { success: true, filePath };
});

// ============ JSON Backup / Restore ============

/**
 * Export all app data as a single JSON backup file.
 * @returns {Promise<{success: boolean, filePath?: string}>}
 */
ipcMain.handle('dialog:exportPDF', async (e, { html }) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save PDF Report',
    defaultPath: `zentra-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  });
  if (!filePath) return { success: false };

  const { BrowserWindow } = require('electron');
  const pdfWin = new BrowserWindow({ show: false, width: 900, height: 700 });
  pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise(resolve => pdfWin.webContents.on('did-finish-load', resolve));
  // small delay for images/charts to render
  await new Promise(resolve => setTimeout(resolve, 500));
  const pdfBuffer = await pdfWin.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
  });
  pdfWin.destroy();
  await fsp.writeFile(filePath, pdfBuffer);
  return { success: true, filePath };
});

ipcMain.handle('dialog:exportBackup', async () => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Backup',
    defaultPath: `zentra-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
  });
  if (!filePath) return { success: false };

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: await getTransactions(),
    bankAccounts: await getBankAccounts(),
    categories: await getCategories(),
    profile: await readJSON(PROFILE_FILE, { firstName: '', lastName: '', email: '' }),
  };
  await fsp.writeFile(filePath, JSON.stringify(backup, null, 2), 'utf8');
  return { success: true, filePath };
});

/**
 * Import a JSON backup file, replacing all current data.
 * @returns {Promise<{success: boolean, error?: string, counts?: Object}>}
 */
ipcMain.handle('dialog:importBackup', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Backup',
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (!filePaths || !filePaths.length) return { success: false };

  try {
    const raw = await fsp.readFile(filePaths[0], 'utf8');
    const data = JSON.parse(raw);

    if (!data.transactions || !Array.isArray(data.transactions)) {
      return { success: false, error: 'Invalid backup: missing transactions array' };
    }

    await safeWrite(TRANSACTIONS_FILE, data.transactions);
    _transactionCache = data.transactions;

    if (Array.isArray(data.bankAccounts)) {
      await safeWrite(BANK_ACCOUNTS_FILE, data.bankAccounts);
      _bankAccountCache = data.bankAccounts;
    }
    if (data.categories && typeof data.categories === 'object') {
      await safeWrite(CATEGORIES_FILE, data.categories);
      invalidateCategoryCache();
    }
    if (data.profile && typeof data.profile === 'object') {
      await safeWrite(PROFILE_FILE, data.profile);
    }

    return {
      success: true,
      counts: {
        transactions: data.transactions.length,
        bankAccounts: (data.bankAccounts || []).length,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── Budget / CRM / Offers (SQLite) ───────────────────────────────────────────
// Powers the new Budget module in src-svelte/. Stored in a separate budget.db
// so the original JSON files (transactions.json, etc.) remain untouched.
const budgetDb = require('./db/budget-db');

const safeHandle = (fn) => async (...args) => {
  try { return { success: true, data: await fn(...args) }; }
  catch (err) {
    console.error('[budget-db]', err);
    return { success: false, error: err.message };
  }
};

ipcMain.handle('budget:list',     safeHandle(()        => budgetDb.Budgets.list()));
ipcMain.handle('budget:get',      safeHandle((e, id)   => budgetDb.Budgets.get(id)));
ipcMain.handle('budget:create',   safeHandle((e, data) => budgetDb.Budgets.create(data)));
ipcMain.handle('budget:update',   safeHandle((e, data) => budgetDb.Budgets.update(data)));
ipcMain.handle('budget:delete',   safeHandle((e, id)   => budgetDb.Budgets.remove(id)));

ipcMain.handle('contacts:list',   safeHandle(()        => budgetDb.Contacts.list()));
ipcMain.handle('contacts:get',    safeHandle((e, id)   => budgetDb.Contacts.get(id)));
ipcMain.handle('contacts:create', safeHandle((e, data) => budgetDb.Contacts.create(data)));
ipcMain.handle('contacts:update', safeHandle((e, data) => budgetDb.Contacts.update(data)));
ipcMain.handle('contacts:delete', safeHandle((e, id)   => budgetDb.Contacts.remove(id)));

ipcMain.handle('offers:list',     safeHandle(()        => budgetDb.Offers.list()));
ipcMain.handle('offers:byCategory', safeHandle((e, c)  => budgetDb.Offers.byCategory(c)));
ipcMain.handle('offers:create',   safeHandle((e, data) => budgetDb.Offers.create(data)));
ipcMain.handle('offers:update',   safeHandle((e, data) => budgetDb.Offers.update(data)));
ipcMain.handle('offers:delete',   safeHandle((e, id)   => budgetDb.Offers.remove(id)));

ipcMain.handle('txlinks:list',    safeHandle(()                  => budgetDb.TxLinks.list()));
ipcMain.handle('txlinks:set',     safeHandle((e, { txId, link }) => budgetDb.TxLinks.set(txId, link || {})));
ipcMain.handle('txlinks:unset',   safeHandle((e, txId)           => budgetDb.TxLinks.unset(txId)));

// Initialise DB lazily once at app start so the schema is created on first run.
app.whenReady().then(() => { try { budgetDb.init(); } catch (e) { console.error('[budget-db] init failed:', e); } });

/** Create the main BrowserWindow and load the renderer (src/index.html). */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 950,
    minWidth: 1200,
    minHeight: 700,
    icon: path.join(__dirname, 'src', 'logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // preload uses ipcRenderer.invoke (CommonJS) — keep sandbox off
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'src', 'preload.js')
    },
    show: true,
    backgroundColor: '#0a0a0b'
  });

  // ── Window security hardening ──────────────────────────────────────────────
  // Open all window.open() / target=_blank links in the user's default browser
  // instead of in a new Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url).catch((e) => log.warn('openExternal failed', e));
    }
    return { action: 'deny' };
  });

  // Block in-app navigation to anything other than the local renderer.
  mainWindow.webContents.on('will-navigate', (event, navUrl) => {
    const isDev = process.env.ELECTRON_IS_DEV === '1';
    const allowed =
      navUrl.startsWith('file://') ||
      (isDev && navUrl.startsWith('http://localhost:5173'));
    if (!allowed) {
      event.preventDefault();
      if (/^https?:\/\//i.test(navUrl)) {
        shell.openExternal(navUrl).catch(() => {});
      }
    }
  });

  // Refuse webview attachment — we don't use <webview> tags.
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());

  // ELECTRON_IS_DEV=1  → Vite dev server (npm run dev)
  // ELECTRON_SVELTE=1  → built Svelte renderer (dist-renderer/)
  // default (npm start) → always loads src/index.html (production)
  const isDev    = process.env.ELECTRON_IS_DEV === '1';
  const isSvelte = process.env.ELECTRON_SVELTE === '1';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else if (isSvelte) {
    const distRenderer = path.join(__dirname, 'dist-renderer', 'index.html');
    if (fs.existsSync(distRenderer)) {
      mainWindow.loadFile(distRenderer);
    } else {
      mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Initialise auto-updater once the window is ready to receive events.
  mainWindow.webContents.once('did-finish-load', () => {
    try {
      updater.init(mainWindow);
    } catch (err) {
      log.error('[updater] init failed', err);
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
