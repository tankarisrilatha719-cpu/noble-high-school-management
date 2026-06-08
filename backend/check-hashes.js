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

const uidHash = stretch('admin_noble');
const pwdHash = stretch('noble2026password');

console.log('stretched admin_noble:', uidHash);
console.log('stretched noble2026password:', pwdHash);

const _UID_HASH = '1b210a3d3027a3337315ec458904af8e6847e9ad27174f1393379b403ea6bfa5';
const _PWD_HASH = 'fa96e9ef8c4cb0ca25cb9bde0231d4cf9339c5cccd8617ae4713bf0854d07406';

console.log('Matches UID_HASH:', uidHash === _UID_HASH);
console.log('Matches PWD_HASH:', pwdHash === _PWD_HASH);
