// Student passwords are stored encoded with the same character map the
// admin portal uses when it saves a student (frontend/js/app.js, setupVault).
// Keep the two maps identical.
const CHAR_MAP = {
  'A':'7*k9P!mQ','B':'2#mQv&zL','C':'L5&tS9!w','D':'9!wX1@rZ','E':'b4@rZ*kN',
  'F':'G8^nJ3$a','G':'0%hV6vB9','H':'kM3$YpC2','I':'1(pL9fS6','J':'qW2!f7*k',
  'K':'5*dN8xM9','L':'rT0#xbL0','M':'jZ7@b4#b','N':'6&uK4rY2','O':'vB9%m1^j',
  'P':'3$aC2vD3','Q':'fY1^gqW0','R':'xO5*k9%k','S':'nL8!h5*r','T':'4@sR0bP0',
  'U':'iE6&w7&z','V':'zQ3#j1*v','W':'pD9%v0%m','X':'7*mN1fP9','Y':'uY4$t3!x',
  'Z':'2!kX8uD6',
  'a':'k8*P9!mQ','b':'v2#mQz&L','c':'sL5&t9!w','d':'r9!wX@rZ','e':'zb4@r*kN',
  'f':'jG8^n3$a','g':'v0%hVvB9','h':'ykM3$pC2','i':'91(pLfS6','j':'fqW2!7*k',
  'k':'85*dNxM9','l':'xrT0#bL0','m':'bjZ7@4#b','n':'26&uKrY2','o':'mvB9%1^j',
  'p':'33$aCvD3','q':'gfY1^qW0','r':'kxO5*9%k','s':'hnL8!5*r','t':'04@sRbP0',
  'u':'wiE6&7&z','v':'jzQ3#1*v','w':'vpD9%0%m','x':'17*mNfP9','y':'tuY4$3!x',
  'z':'82!kXuD6',
  '0':'wQ5&k7*b','1':'9*rP2pZ1','2':'bL0#v4#b','3':'7!mX49!z','4':'kZ8@nkM6',
  '5':'1$jT33*t','6':'fS6^grY2','7':'xM9%h5^n','8':'pC2!wjP9','9':'uR5*y1(h',
  ' ':'9!zL1vD3','@':'4#bV80)x','$':'kM6&p7!f','%':'3*tX0bK5','^':'rY2@sqW0',
  '&':'5^nQ7mZ8','(':'1(hB41^j',')':'0)xM69%k','_':'7!fR94!h','=':'bK5*tbP0',
  '[':'mZ8$p1*v',']':'xS2@l0%m','{':'1^jV4fP9','}':'9%kQ03!x','|':'4!hM77*b',
  ':':'bP0#xpZ1',';':'7&zL94#b',"'":'qY2$w9!z','"':'kS5^nkM6',',':'1vR83t',
  '.':'0%mQ3rY2','/':'fP9@k5^n','?':'3!xJ2jP9','<':'uD6&t1(h','!':'pZ1$wvD3',
  '#':'aE7@m6&L','*':'b0)kS9rY','+':'cP3!nT8x','-':'dQ4#xJ2j','>':'eR5^vB9%',
  '~':'fT6&w7&z','`':'gU7$tuY4','\\':'hV8@l0%m'
};

function encode(plain) {
  if (plain == null) return '';
  let out = '';
  for (const ch of String(plain)) out += CHAR_MAP[ch] !== undefined ? CHAR_MAP[ch] : ch;
  return out;
}

// Accepts the encoded form and legacy plain-text records.
function verify(typed, stored) {
  if (stored == null || typed == null || typed === '') return false;
  return typed === stored || encode(typed) === stored;
}

module.exports = { encode, verify };
