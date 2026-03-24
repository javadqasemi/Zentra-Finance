const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Increase GPU tile memory budget — prevents "tile memory limits exceeded" warning
// caused by multiple glass backdrop-filters and animated orbs
app.commandLine.appendSwitch('force-gpu-mem-available-mb', '512');

let mainWindow;

// Data storage path
const DATA_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'ZentraFinance', 'data');
const TRANSACTIONS_FILE = path.join(DATA_PATH, 'transactions.json');
const CATEGORIES_FILE = path.join(DATA_PATH, 'categories.json');
const BANK_ACCOUNTS_FILE = path.join(DATA_PATH, 'bankAccounts.json');
const PROFILE_FILE = path.join(DATA_PATH, 'profile.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_PATH)) {
  fs.mkdirSync(DATA_PATH, { recursive: true });
}

// Extended default categories for auto-categorization (600+ keywords)
const DEFAULT_CATEGORIES = {
  'Lebensmittel': ['Migros', 'Coop', 'Aldi', 'Lidl', 'Denner', 'Volg', 'Landi', 'SPAR', 'Primo', 'Otto', 'Märitplatz', 'Manor', 'Jelmoli', 'Globus', 'LIDL', 'ALDI', 'Migros MM', 'Rami Supermarket', 'Rami', 'Supermarket', 'avec', 'Pick Pay', 'WAL*', 'Frischmarkt', 'Confiserie', 'Confiserie Eichenberger', 'Schokolade', 'Lindt', 'Sprüngli', 'Läderach', 'Merkur', 'Alnatura', 'Bio', 'FOOD', 'ZB FOOD', 'Global Supermarkt', 'EDEKA', 'Edeka', 'Marche', 'Meier Tobler', 'Globus', 'Frischmarkt'],
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
  'Einnahmen': ['Lohn', 'Gehalt', 'Rente', 'AHV', 'IV', 'EO', 'ALV', 'Krankentaggeld', 'Mieteinnahmen', 'Dividende', 'Zins', 'Rückvergütung', 'Zahlungseingang', 'Überweisung', 'Vergütung', 'Gutschrift', 'EIDGENOSSISCHES', 'INSTITUT FUR', 'INSTITUT F.', 'INSTITUT FÜR', 'Bundes', 'Staat', 'Rückerstattung', 'Rückerstatt', 'Erstattung', 'Refund', 'Verg', 'bertrag', 'Einschlagweg', 'Saläreingang'],
  'Auszahlung': ['Bargeldbezug', 'ATM', 'Bancomat', 'Postomat', 'Bargeld', 'Bargeldb', 'Einzahlung', 'Cash', 'Bargeldabhebung'],
  'Transfer': ['Überweisung', 'E-Banking', 'Banktransfer', 'Standing Order', 'Dauerauftrag', 'TWINT', 'Debitkarte', 'Zahlung Debitkarte', 'Wise', 'Wise.com', 'TransferWise', 'Revolut', 'PayPal', 'Paypal', 'PAYPAL', 'MoneyGram', 'Western Union', 'Übertrag', 'bertrag'],
  'Sonstiges': []
};

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
      email: ''
    }));
  }
}

initStorage();

// Safe JSON file reader — returns fallback on parse error instead of crashing
function readJSON(filePath, fallback = []) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

// Auto-categorize based on description
function autoCategorize(description) {
  const categories = readJSON(CATEGORIES_FILE, DEFAULT_CATEGORIES);
  const lowerDesc = description.toLowerCase();

  for (const [category, keywords] of Object.entries(categories)) {
    for (const keyword of keywords) {
      if (lowerDesc.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }
  return 'Sonstiges';
}

// Categories that always imply income regardless of amount sign
const INCOME_CATEGORIES = new Set(['Einnahmen']);

// Reconcile type with category — Einnahmen should always be income
function reconcileType(type, category) {
  if (INCOME_CATEGORIES.has(category)) return 'income';
  return type;
}

// Parse Migros Bank CSV
function parseMigrosCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
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
        transactions.push({
          id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          date: convertDate(date),
          description: cleanDescription(description),
          originalDescription: description,
          amount: Math.abs(amount),
          type: reconcileType(amount < 0 ? 'expense' : 'income', autoCategorize(description)),
          category: autoCategorize(description),
          source: 'migros',
          bankAccountId: null,
          importedAt: new Date().toISOString()
        });
      }
    }
  }
  
  return transactions;
}

// Parse UBS CSV
function parseUBSCSV(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

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
      const debit = parts[18]?.trim().replace(/'/g, '').replace(',', '.');
      const credit = parts[19]?.trim().replace(/'/g, '').replace(',', '.');
      
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
        transactions.push({
          id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          date: convertDate(bookingDate),
          description: cleanUBSDescription(description),
          originalDescription: description,
          amount: amount,
          type: reconcileType(type, autoCategorize(description)),
          category: autoCategorize(description),
          source: 'ubs',
          bankAccountId: null,
          importedAt: new Date().toISOString()
        });
      }
    }
  }
  
  return transactions;
}

// Parse generic CSV (Datum;Buchungstext;Betrag format)
function parseGenericCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const transactions = [];
  
  let headerFound = false;
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Skip header
    if (line.toLowerCase().includes('datum') && line.toLowerCase().includes('buchungstext')) {
      headerFound = true;
      continue;
    }
    
    if (!headerFound && lines.indexOf(line) === 0) {
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
        transactions.push({
          id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          date: convertDate(date),
          description: cleanDescription(description),
          originalDescription: description,
          amount: Math.abs(amount),
          type: reconcileType(amount < 0 ? 'expense' : 'income', autoCategorize(description)),
          category: autoCategorize(description),
          source: 'generic',
          bankAccountId: null,
          importedAt: new Date().toISOString()
        });
      }
    }
  }
  
  return transactions;
}

// Clean UBS description
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

// Convert DD.MM.YYYY to YYYY-MM-DD — returns today on invalid input
function convertDate(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const parts = dateStr.trim().split('.');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const iso = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    return isNaN(Date.parse(iso)) ? new Date().toISOString().split('T')[0] : iso;
  }
  return isNaN(Date.parse(dateStr)) ? new Date().toISOString().split('T')[0] : dateStr;
}

// Clean description text
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
ipcMain.handle('db:getTransactions', () => {
  const transactions = readJSON(TRANSACTIONS_FILE, []);
  // Repair any existing transactions whose type contradicts their category
  let dirty = false;
  transactions.forEach(t => {
    const correct = reconcileType(t.type, t.category);
    if (correct !== t.type) { t.type = correct; dirty = true; }
  });
  if (dirty) fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2));
  return transactions;
});

ipcMain.handle('db:updateTransaction', (e, data) => {
  const transactions = readJSON(TRANSACTIONS_FILE, []);
  const idx = transactions.findIndex(t => t.id === data.id);
  
  if (idx >= 0) {
    transactions[idx] = { ...transactions[idx], ...data, updatedAt: new Date().toISOString() };
  } else {
    transactions.push({ ...data, createdAt: new Date().toISOString() });
  }
  
  fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2));
  return { success: true };
});

ipcMain.handle('db:deleteTransaction', (e, id) => {
  const transactions = readJSON(TRANSACTIONS_FILE, []);
  const filtered = transactions.filter(t => t.id !== id);
  fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(filtered, null, 2));
  return { success: true };
});

ipcMain.handle('db:importTransactions', (e, newTransactions) => {
  const transactions = readJSON(TRANSACTIONS_FILE, []);
  let added = 0;
  
  for (const t of newTransactions) {
    const exists = transactions.some(
      existing => existing.date === t.date && 
                  existing.amount === t.amount &&
                  existing.description === t.description
    );
    if (!exists) {
      transactions.push(t);
      added++;
    }
  }
  
  fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2));
  return { success: true, count: added };
});

// Categories
ipcMain.handle('db:getCategories', () => {
  return readJSON(CATEGORIES_FILE, {});
});

ipcMain.handle('db:saveCategories', (e, categories) => {
  fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(categories, null, 2));
  return { success: true };
});

// Bank Accounts
ipcMain.handle('db:getBankAccounts', () => {
  return readJSON(BANK_ACCOUNTS_FILE, []);
});

ipcMain.handle('db:saveBankAccount', (e, account) => {
  const accounts = readJSON(BANK_ACCOUNTS_FILE, []);
  const idx = accounts.findIndex(a => a.id === account.id);
  
  if (idx >= 0) {
    accounts[idx] = { ...accounts[idx], ...account, updatedAt: new Date().toISOString() };
  } else {
    accounts.push({ ...account, createdAt: new Date().toISOString() });
  }
  
  fs.writeFileSync(BANK_ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
  return { success: true };
});

ipcMain.handle('db:updateBankAccount', (e, account) => {
  const accounts = readJSON(BANK_ACCOUNTS_FILE, []);
  const idx = accounts.findIndex(a => a.id === account.id);
  
  if (idx >= 0) {
    accounts[idx] = { ...accounts[idx], ...account, updatedAt: new Date().toISOString() };
    fs.writeFileSync(BANK_ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
  }
  
  return { success: true };
});

ipcMain.handle('db:deleteBankAccount', (e, id) => {
  const accounts = readJSON(BANK_ACCOUNTS_FILE, []);
  const filtered = accounts.filter(a => a.id !== id);
  fs.writeFileSync(BANK_ACCOUNTS_FILE, JSON.stringify(filtered, null, 2));

  // Remove bankAccountId from transactions
  const transactions = readJSON(TRANSACTIONS_FILE, []);
  transactions.forEach(t => {
    if (t.bankAccountId === id) {
      t.bankAccountId = null;
    }
  });
  fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2));
  
  return { success: true };
});

// Profile
ipcMain.handle('db:getProfile', () => {
  return readJSON(PROFILE_FILE, { firstName: '', lastName: '', email: '' });
});

ipcMain.handle('db:saveProfile', (e, profile) => {
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2));
  return { success: true };
});

// Stats
ipcMain.handle('db:getStats', () => {
  const transactions = readJSON(TRANSACTIONS_FILE, []);
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
ipcMain.handle('db:renameCategory', (e, { oldName, newName }) => {
  const transactions = readJSON(TRANSACTIONS_FILE, []);
  let count = 0;
  transactions.forEach(t => {
    if (t.category === oldName) {
      t.category = newName;
      count++;
    }
  });
  fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2));
  return { success: true, count };
});

// Clear all data
ipcMain.handle('db:clearAllData', () => {
  fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify([]));
  fs.writeFileSync(BANK_ACCOUNTS_FILE, JSON.stringify([]));
  fs.writeFileSync(PROFILE_FILE, JSON.stringify({ firstName: '', lastName: '', email: '' }));
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
    const fileName = path.basename(filePath).toLowerCase();
    
    // Detect by filename first
    if (fileName.includes('migros')) {
      const transactions = parseMigrosCSV(filePath);
      return { success: true, transactions, source: 'migrosbank', filePath, count: transactions.length };
    } else if (fileName.includes('ubs')) {
      const transactions = parseUBSCSV(filePath);
      return { success: true, transactions, source: 'ubs', filePath, count: transactions.length };
    }
    
    // Detect by content
    const content = fs.readFileSync(filePath, 'utf8').substring(0, 2000);
    
    if (content.includes('Zahlungsbeschreibung') || content.includes('Bewertungsdatum')) {
      const transactions = parseUBSCSV(filePath);
      return { success: true, transactions, source: 'ubs', filePath, count: transactions.length };
    } else if (fileName.includes('postfinance') || fileName.includes('post')) {
      const transactions = parseGenericCSV(filePath);
      return { success: true, transactions, source: 'postfinance', filePath, count: transactions.length };
    } else {
      // Try generic CSV format (Datum;Buchungstext;Betrag)
      const transactions = parseGenericCSV(filePath);
      if (transactions.length > 0) {
        return { success: true, transactions, source: 'generic', filePath, count: transactions.length };
      }
    }
    
    return { success: false, error: 'Unknown CSV format - expected columns: Datum;Buchungstext;Betrag' };
  }
  return { success: false };
});

// Create window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 950,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    show: true,
    backgroundColor: '#0a0a0b'
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
