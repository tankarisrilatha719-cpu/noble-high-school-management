const crypto = require('crypto');

const SALT = 'NHS_Vault_v1_2026';
const ROUNDS = 50000;

function stretch(input) {
  let buf = Buffer.from(SALT + input);
  for (let i = 0; i < ROUNDS; i++) {
    buf = crypto.createHash('sha256').update(buf).digest();
  }
  return buf.toString('hex');
}

const _UID_HASH = '1b210a3d3027a3337315ec458904af8e6847e9ad27174f1393379b403ea6bfa5';
const _PWD_HASH = 'fa96e9ef8c4cb0ca25cb9bde0231d4cf9339c5cccd8617ae4713bf0854d07406';

const usernames = [
  'admin',
  'admin_noble',
  'noble_admin',
  'noble',
  'admin@noble',
  'admin123',
  'superadmin',
  'NHS_admin'
];

const passwords = [
  'noble2026password',
  'noble2026',
  'noblepassword',
  'admin',
  'admin123',
  'password',
  'noble@2026',
  'noble2026#',
  'admin_noble',
  'noble_school',
  'student123',
  'noble123'
];

console.log('--- Checking Usernames ---');
for (const u of usernames) {
  const h = stretch(u);
  if (h === _UID_HASH) {
    console.log(`FOUND USERNAME: "${u}" matches _UID_HASH!`);
  }
}

console.log('--- Checking Passwords ---');
for (const p of passwords) {
  const h = stretch(p);
  if (h === _PWD_HASH) {
    console.log(`FOUND PASSWORD: "${p}" matches _PWD_HASH!`);
  }
}
