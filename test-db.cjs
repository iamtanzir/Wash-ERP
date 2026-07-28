const Database = require('better-sqlite3');
const db = new Database('wash_erp.sqlite');
console.log("Buyer Data Bank:", db.prepare("SELECT count(*) as count FROM buyer_data_bank").get());
