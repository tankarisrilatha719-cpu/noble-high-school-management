(function(){
const BACKEND_URL = localStorage.getItem('nhs_custom_backend_url') || 
  ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? (window.location.port === '5000' ? window.location.origin : 'http://localhost:5000')
    : ((window.location.protocol === 'file:' || !window.location.hostname || (window.location.origin && window.location.origin.startsWith('file://')) || window.location.origin === 'null')
      ? 'http://localhost:5000'
      : 'https://noble-high-school-management.onrender.com'));
let currentLang='en',chatOpen=false,awaitingFeeStudentId=false;
const T={en:{welcome:"Namaste! 🙏 I'm Noble Mitra, your assistant for Noble High School, Kandukur. How can I help you today?",qr:["Fee Details","Admissions","School Timings","Contact Info","About School"]},te:{welcome:"నమస్తే! 🙏 నేను Noble Mitra, Noble High School సహాయకుడిని. నేను మీకు ఏ విధంగా సహాయం చేయగలను?",qr:["ఫీజు వివరాలు","అడ్మిషన్లు","పాఠశాల సమయాలు","సంప్రదింపు","పాఠశాల గురించి"]},hi:{welcome:"नमस्ते! 🙏 मैं Noble Mitra हूं, Noble High School का सहायक। मैं आपकी कैसे मदद कर सकता हूं?",qr:["फीस विवरण","प्रवेश","स्कूल समय","संपर्क","स्कूल के बारे में"]}};
const R={en:{fee:"Please enter your **Student ID** to check fee details:",admission:"📋 **Admission Process:**\n\n1️⃣ Visit school OR fill online form on website\n2️⃣ Required documents:\n• Aadhaar Card (Student & Parent)\n• Previous TC & Marks Memo\n• Passport photos (4)\n• Caste Certificate\n• Birth Certificate\n\n📞 +91 90599 92147",timings:"⏰ **School Timings:**\n\n🕗 Opens: 8:00 AM\n🕓 Closes: 4:00 PM\n\n• Mon-Fri: Full day\n• Saturday: Working (except 2nd Saturday)\n• 2nd Saturday: Holiday\n🌞 Summer Holidays: April 25 to June end",exam:"📝 **Exam Schedule:**\n\n• FA1, FA2, FA3, FA4\n• SA1, SA2\n• Mid Term Exams\n• Pre-Final Exams\n• Weekend Exams\n\n📊 Results published on website",contact:"📞 **Contact:**\n\n🏫 Noble High School\n📍 Kandukur 'X' Road, Kandukur Mandal, Rangareddy District, Telangana\n📱 +91 90599 92147\n👨💼 Principal: Bairu Kondal Reddy",about:"🏫 **About Noble High School:**\n\n✅ Serving Kandukur since 1995\n✅ Classes from Nursery, LKG and UKG up to Class 10\n✅ Online admission form on the website\n✅ Student Portal: report cards, hall tickets, fees and notices\n👨‍💼 Principal: Bairu Kondal Reddy\n\n📞 +91 90599 92147",notfound:"Student ID not found. Contact school: +91 90599 92147",loginFirst:"🔒 Fee details are private. Please log in to the **Student Portal** first, then ask me again.",ownOnly:"🔒 You can only view fee details for your own Student ID.",def:"I can help with:\n• 💰 Fee Details\n• 📋 Admissions\n• ⏰ School Timings\n• 📞 Contact Info\n• 🏫 About School"},te:{fee:"ఫీజు వివరాలు తెలుసుకోవడానికి మీ **Student ID** ఇవ్వండి:",admission:"📋 **అడ్మిషన్ ప్రక్రియ:**\n\n1️⃣ పాఠశాలకు వెళ్ళండి లేదా వెబ్సైట్లో ఆన్లైన్ ఫారం పూరించండి\n2️⃣ అవసరమైన పత్రాలు:\n• ఆధార్ కార్డ్\n• మునుపటి TC & మార్కులు మెమో\n• పాస్పోర్ట్ ఫోటోలు (4)\n• కులధృవీకరణ పత్రం\n\n📞 +91 90599 92147",timings:"⏰ **పాఠశాల సమయాలు:**\n\n🕗 తెరవడం: 8:00 AM\n🕓 మూయడం: 4:00 PM\n\n• సోమ-శుక్ర: పూర్తి రోజు\n• శనివారం: పని దినం (2వ శనివారం తప్ప)\n🌞 వేసవి సెలవులు: ఏప్రిల్ 25 నుండి జూన్ వరకు",exam:"📝 **పరీక్ష షెడ్యూల్:**\n\n• FA1, FA2, FA3, FA4\n• SA1, SA2\n• మిడ్ టర్మ్, ప్రీ-ఫైనల్\n• వీకెండ్ పరీక్షలు\n\n📊 ఫలితాలు వెబ్సైట్లో",contact:"📞 **సంప్రదింపు:**\n\n📍 కందుకూర్ 'X' రోడ్, కందుకూర్ మండల్, రంగారెడ్డి జిల్లా\n📱 +91 90599 92147\n👨💼 ప్రిన్సిపల్: Bairu Kondal Reddy",about:"🏫 **Noble High School సేవలు:**\n\n✅ విద్యార్థి సమాచార నిర్వహణ\n✅ ఫీజు చెల్లింపు ట్రాకింగ్\n✅ అకాడమిక్ రిపోర్ట్లు\n✅ పరీక్ష షెడ్యూల్లు\n\n📞 +91 90599 92147",notfound:"Student ID కనుగొనబడలేదు. పాఠశాలను సంప్రదించండి: +91 90599 92147",loginFirst:"🔒 ఫీజు వివరాలు ప్రైవేట్. దయచేసి ముందుగా **Student Portal**‌లో లాగిన్ అవ్వండి.",ownOnly:"🔒 మీ స్వంత Student ID ఫీజు వివరాలు మాత్రమే చూడగలరు.",def:"నేను సహాయం చేయగలను:\n• 💰 ఫీజు వివరాలు\n• 📋 అడ్మిషన్లు\n• ⏰ పాఠశాల సమయాలు"},hi:{fee:"फीस विवरण के लिए **Student ID** दर्ज करें:",admission:"📋 **प्रवेश प्रक्रिया:**\n\n1️⃣ स्कूल जाएं या वेबसाइट पर फॉर्म भरें\n2️⃣ आवश्यक दस्तावेज:\n• आधार कार्ड\n• पिछली TC और मार्क्स मेमो\n• पासपोर्ट फोटो (4)\n• जाति प्रमाण पत्र\n\n📞 +91 90599 92147",timings:"⏰ **स्कूल समय:**\n\n🕗 खुलने का: 8:00 AM\n🕓 बंद होने का: 4:00 PM\n\n• सोम-शुक्र: पूरा दिन\n• शनिवार: कार्य दिवस (दूसरे शनिवार को छोड़कर)\n🌞 गर्मी छुट्टियां: 25 अप्रैल से जून तक",exam:"📝 **परीक्षा अनुसूची:**\n\n• FA1, FA2, FA3, FA4\n• SA1, SA2\n• Mid Term, Pre-Final\n• Weekend परीक्षाएं\n\n📊 परिणाम वेबसाइट पर",contact:"📞 **संपर्क:**\n\n📍 कंदुकूर 'X' रोड, रंगारेड्डी जिला, तेलंगाना\n📱 +91 90599 92147\n👨💼 प्रिंसिपल: Bairu Kondal Reddy",about:"🏫 **Noble High School सेवाएं:**\n\n✅ छात्र जानकारी प्रबंधन\n✅ फीस भुगतान ट्रैकिंग\n✅ परीक्षा अनुसूची\n\n📞 +91 90599 92147",notfound:"Student ID नहीं मिला। स्कूल से संपर्क करें: +91 90599 92147",loginFirst:"🔒 फीस विवरण निजी है। कृपया पहले **Student Portal** में लॉगिन करें।",ownOnly:"🔒 आप केवल अपनी Student ID का फीस विवरण देख सकते हैं।",def:"मैं मदद कर सकता हूं:\n• 💰 फीस विवरण\n• 📋 प्रवेश\n• ⏰ स्कूल समय"}};

// Load fonts dynamically
const fontLink=document.createElement('link');
fontLink.rel='stylesheet';
fontLink.href='https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;600&family=Poppins:wght@400;500;600;700&display=swap';
document.head.appendChild(fontLink);

// Inject styles
const style=document.createElement('style');
style.textContent=`
#nm-toggle{position:fixed;bottom:24px;right:24px;width:64px;height:64px;background:transparent;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:1500;transition:transform 0.2s;padding:0;}
@media (max-width:600px){#nm-toggle{width:52px;height:52px;bottom:16px;right:16px}#nm-toggle svg{width:52px;height:52px}#nm-window{right:16px;bottom:80px}}
@media (prefers-reduced-motion:reduce){#nm-toggle *{animation:none!important}}
#nm-toggle:hover{transform:scale(1.08);}
#nm-badge{position:absolute;top:-3px;right:-3px;background:#e53935;color:#fff;font-size:9px;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;}
#nm-window{position:fixed;bottom:100px;right:24px;width:360px;max-width:calc(100vw - 32px);height:540px;max-height:calc(100vh - 120px);background:#fff;border-radius:20px;box-shadow:0 8px 40px rgba(26,58,107,0.25);display:flex;flex-direction:column;overflow:hidden;z-index:1499;transform:scale(0.95) translateY(20px);opacity:0;pointer-events:none;transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1);}
#nm-window.nm-open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}
.nm-header{background:#1a3a6b;padding:12px 14px;display:flex;align-items:center;gap:10px;flex-shrink:0;}
.nm-avatar{width:40px;height:40px;border-radius:50%;background:#c8a951;display:flex;align-items:center;justify-content:center;font-size:18px;border:2px solid #f0d98a;}
.nm-title{color:#fff;font-size:14px;font-weight:700;font-family:Poppins,sans-serif;}
.nm-sub{color:#f0d98a;font-size:11px;font-family:Poppins,sans-serif;}
.nm-dot{width:7px;height:7px;background:#4caf50;border-radius:50%;display:inline-block;margin-right:4px;animation:nm-pulse 2s infinite;}
@keyframes nm-pulse{0%,100%{opacity:1}50%{opacity:0.4}}
.nm-close{margin-left:auto;background:none;border:none;color:#fff;font-size:18px;cursor:pointer;opacity:0.7;padding:4px;}
.nm-close:hover{opacity:1;}
.nm-lang{background:#f5f7ff;padding:5px 12px;display:flex;gap:5px;border-bottom:1px solid #e0e8ff;flex-shrink:0;}
.nm-lb{padding:3px 9px;border-radius:12px;border:1px solid #1a3a6b;background:transparent;color:#1a3a6b;font-size:10px;cursor:pointer;font-family:Poppins,sans-serif;transition:all 0.2s;}
.nm-lb.nm-active{background:#1a3a6b;color:#fff;}
.nm-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#f8faff;}
.nm-msgs::-webkit-scrollbar{width:3px;}
.nm-msgs::-webkit-scrollbar-thumb{background:#c0ccee;border-radius:3px;}
.nm-msg{display:flex;align-items:flex-end;gap:6px;animation:nm-fadeup 0.3s ease;}
@keyframes nm-fadeup{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.nm-msg.nm-user{flex-direction:row-reverse;}
.nm-mavatar{width:26px;height:26px;border-radius:50%;background:#1a3a6b;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;}
.nm-msg.nm-user .nm-mavatar{background:#c8a951;}
.nm-bubble{max-width:78%;padding:9px 13px;border-radius:16px;font-size:12px;line-height:1.5;word-break:break-word;font-family:Poppins,sans-serif;}
.nm-msg.nm-bot .nm-bubble{background:#1a3a6b;color:#fff;border-bottom-left-radius:3px;}
.nm-msg.nm-user .nm-bubble{background:#c8a951;color:#1a1a1a;border-bottom-right-radius:3px;font-weight:500;}
.nm-time{font-size:9px;opacity:0.6;margin-top:3px;display:block;}
.nm-qr{display:flex;flex-wrap:wrap;gap:5px;padding:6px 12px 8px;background:#f8faff;border-top:1px solid #e8eeff;flex-shrink:0;}
.nm-qrb{padding:4px 10px;border-radius:14px;border:1.5px solid #1a3a6b;background:transparent;color:#1a3a6b;font-size:10px;cursor:pointer;font-family:Poppins,sans-serif;transition:all 0.2s;white-space:nowrap;}
.nm-qrb:hover{background:#1a3a6b;color:#fff;}
.nm-input{display:flex;align-items:center;gap:6px;padding:8px 12px;border-top:1px solid #e0e8ff;background:#fff;flex-shrink:0;}
.nm-input input{flex:1;border:1.5px solid #d0d8f0;border-radius:18px;padding:7px 12px;font-size:12px;font-family:Poppins,sans-serif;outline:none;}
.nm-input input:focus{border-color:#1a3a6b;}
.nm-send{width:35px;height:35px;border-radius:50%;background:#1a3a6b;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.nm-send:hover{background:#c8a951;}
.nm-send svg{width:16px;height:16px;fill:#fff;}
.nm-typing{display:flex;align-items:center;gap:3px;padding:7px 10px;background:#1a3a6b;border-radius:16px;border-bottom-left-radius:3px;width:fit-content;}
.nm-td{width:5px;height:5px;background:rgba(255,255,255,0.7);border-radius:50%;animation:nm-bounce 1.2s infinite;}
.nm-td:nth-child(2){animation-delay:0.2s}.nm-td:nth-child(3){animation-delay:0.4s}
@keyframes nm-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}
.nm-pw{text-align:center;font-size:9px;color:#aaa;padding:3px;background:#fff;flex-shrink:0;}
`;
document.head.appendChild(style);

// Create HTML
const toggle=document.createElement('button');
toggle.type='button';
toggle.id='nm-toggle';
toggle.setAttribute('aria-label','Open the Noble Mitra chat assistant');
toggle.setAttribute('aria-expanded','false');
toggle.setAttribute('aria-controls','nm-window');
toggle.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" style="overflow:visible;">  <style>    .nm-halo {      animation: haloPulse 2s ease-in-out infinite alternate;    }    .nm-robot-group {      animation: floatMotion 2s ease-in-out infinite alternate;    }    .nm-eye-l {      animation: blink 3s infinite;      transform-origin: 24px 27px;    }    .nm-eye-r {      animation: blink 3s infinite;      transform-origin: 40px 27px;    }    .nm-antenna-glow {      animation: glowPulse 1.5s ease-in-out infinite alternate;      transform-origin: 32px 9px;    }    .nm-mouth-glow {      animation: flicker 0.3s infinite;    }    @keyframes floatMotion {      0% { transform: translateY(0px); }      100% { transform: translateY(-2px); }    }    @keyframes blink {      0%, 90%, 100% { transform: scaleY(1); }      95% { transform: scaleY(0.1); }    }    @keyframes glowPulse {      0% { r: 3px; opacity: 0.4; }      100% { r: 7px; opacity: 1; }    }    @keyframes haloPulse {      0% { filter: drop-shadow(0 0 2px rgba(200, 169, 81, 0.4)); }      100% { filter: drop-shadow(0 0 6px rgba(200, 169, 81, 0.8)); }    }    @keyframes flicker {      0%, 100% { opacity: 0.9; }      50% { opacity: 0.4; }    }  </style>  <g class="nm-halo">    <g class="nm-robot-group">      <!-- Antenna -->      <rect x="31" y="11" width="2" height="7" fill="#c8a951" />      <circle cx="32" cy="9" r="2.5" fill="#c8a951" />      <circle class="nm-antenna-glow" cx="32" cy="9" r="5" fill="#c8a951" opacity="0.6" />            <!-- Ear Bolts -->      <rect x="11" y="27" width="3" height="6" rx="1" fill="#c8a951" />      <rect x="50" y="27" width="3" height="6" rx="1" fill="#c8a951" />            <!-- Neck -->      <rect x="28" y="42" width="8" height="4" fill="#c8a951" />            <!-- Body/Chest -->      <path d="M 18,45 L 46,45 L 49,58 L 15,58 Z" fill="#1a3a6b" stroke="#c8a951" stroke-width="1.5" />      <rect x="23" y="49" width="18" height="7" rx="1" fill="#c8a951" />      <text x="32" y="54" font-family="\'Poppins\', \'Arial\', sans-serif" font-size="4.5" font-weight="bold" fill="#1a3a6b" text-anchor="middle">NOBLE</text>            <!-- Head -->      <rect x="14" y="18" width="36" height="25" rx="5" ry="5" fill="#1a3a6b" stroke="#c8a951" stroke-width="2" />            <!-- Visor -->      <rect x="18" y="22" width="28" height="11" rx="2.5" ry="2.5" fill="#0d1f3d" />            <!-- Eyes -->      <circle class="nm-eye-l" cx="24" cy="27" r="3" fill="#c8a951" />      <circle class="nm-eye-r" cx="40" cy="27" r="3" fill="#c8a951" />            <!-- Mouth Panel -->      <g class="nm-mouth-glow">        <rect x="22" y="36" width="20" height="4.5" rx="1" fill="#c8a951" />        <!-- Teeth (navy rectangles) -->        <rect x="25" y="37" width="2" height="2.5" fill="#1a3a6b" />        <rect x="31" y="37" width="2" height="2.5" fill="#1a3a6b" />        <rect x="37" y="37" width="2" height="2.5" fill="#1a3a6b" />      </g>    </g>  </g></svg><div id="nm-badge">1</div>';
toggle.onclick=toggleNM;

const win=document.createElement('div');
win.id='nm-window';
win.innerHTML=`
<div class="nm-header">
  <div class="nm-avatar">🤖</div>
  <div><div class="nm-title">Noble Mitra</div><div class="nm-sub"><span class="nm-dot"></span>Noble High School Assistant</div></div>
  <button type="button" class="nm-close" aria-label="Close chat" onclick="document.getElementById('nm-window').classList.remove('nm-open');window._nmOpen=false;document.getElementById('nm-toggle').setAttribute('aria-expanded','false');">✕</button>
</div>
<div class="nm-lang">
  <button class="nm-lb nm-active" onclick="setNMLang('en',this)">English</button>
  <button class="nm-lb" onclick="setNMLang('te',this)">తెలుగు</button>
  <button class="nm-lb" onclick="setNMLang('hi',this)">हिंदी</button>
</div>
<div class="nm-msgs" id="nm-msgs"></div>
<div class="nm-qr" id="nm-qr"></div>
<div class="nm-input">
  <input type="text" id="nm-inp" placeholder="Type your question..." onkeydown="if(event.key==='Enter')sendNM()">
  <button class="nm-send" onclick="sendNM()"><svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg></button>
</div>
<div class="nm-pw">Powered by Noble High School AI</div>`;

document.body.appendChild(toggle);
document.body.appendChild(win);

window._nmOpen=false;

function toggleNM(){
  window._nmOpen=!window._nmOpen;
  document.getElementById('nm-window').classList.toggle('nm-open',window._nmOpen);
  document.getElementById('nm-badge').style.display='none';
  const t=document.getElementById('nm-toggle');
  t.setAttribute('aria-expanded',String(window._nmOpen));
  t.setAttribute('aria-label',window._nmOpen?'Close the chat assistant':'Open the Noble Mitra chat assistant');
}

window.setNMLang=function(lang,btn){
  currentLang=lang;
  document.querySelectorAll('.nm-lb').forEach(b=>b.classList.remove('nm-active'));
  btn.classList.add('nm-active');
  setNMQR(T[lang].qr);
  document.getElementById('nm-inp').placeholder=lang==='te'?'మీ ప్రశ్న టైప్ చేయండి...':lang==='hi'?'अपना सवाल टाइप करें...':'Type your question...';
};

function getTime(){return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}

function addNMMsg(text,sender){
  const c=document.getElementById('nm-msgs');
  const m=document.createElement('div');
  m.className=`nm-msg nm-${sender}`;
  const av=document.createElement('div');
  av.className='nm-mavatar';
  av.textContent=sender==='bot'?'🤖':'👤';
  const b=document.createElement('div');
  b.className='nm-bubble';
  b.innerHTML=text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>')+`<span class="nm-time">${getTime()}</span>`;
  m.appendChild(av);m.appendChild(b);
  c.appendChild(m);c.scrollTop=c.scrollHeight;
}

function showNMTyping(){
  const c=document.getElementById('nm-msgs');
  const m=document.createElement('div');
  m.className='nm-msg nm-bot';m.id='nm-typing';
  const av=document.createElement('div');av.className='nm-mavatar';av.textContent='🤖';
  const b=document.createElement('div');b.className='nm-typing';
  b.innerHTML='<div class="nm-td"></div><div class="nm-td"></div><div class="nm-td"></div>';
  m.appendChild(av);m.appendChild(b);c.appendChild(m);c.scrollTop=c.scrollHeight;
}
function removeNMTyping(){const e=document.getElementById('nm-typing');if(e)e.remove();}

function setNMQR(replies){
  const c=document.getElementById('nm-qr');c.innerHTML='';
  replies.forEach(r=>{const b=document.createElement('button');b.className='nm-qrb';b.textContent=r;b.onclick=()=>{addNMMsg(r,'user');processNM(r.toLowerCase());};c.appendChild(b);});
}

// Fee details are private, so they are only shown to the logged-in student
// for their own ID, using the data already loaded for the student portal.
async function fetchNMFee(id){
  const student = (typeof currentStudent !== 'undefined') ? currentStudent : null;
  if(!student) return R[currentLang].loginFirst;
  const wanted = id.trim().toLowerCase();
  if(wanted !== String(student.id).toLowerCase() && wanted !== String(student.loginId).toLowerCase()) return R[currentLang].ownOnly;
  const payments=(DB.get('fees')||[]).filter(f=>f.studentId===student.id);
  const paid=payments.reduce((a,f)=>a+(f.amount||0),0);
  let msg=`📊 **Fee Details for ${student.name}:**\n\n🎓 Class: ${student.className}-${student.section}\n💰 Total Paid: ₹${paid.toLocaleString()}\n`;
  if(student.totalFee){
    const due=student.totalFee-paid;
    msg+=`📌 Total Fee: ₹${student.totalFee.toLocaleString()}\n${due>0?'⚠️':'✅'} Due: ₹${Math.max(0,due).toLocaleString()}`;
  }
  return msg;
}

function processNM(text){
  showNMTyping();
  setTimeout(async()=>{
    removeNMTyping();
    if(awaitingFeeStudentId){
      awaitingFeeStudentId=false;
      showNMTyping();
      const msg=await fetchNMFee(text.trim());
      removeNMTyping();
      addNMMsg(msg,'bot');
      setNMQR(T[currentLang].qr);
      return;
    }
    const r=R[currentLang];
    let res='';
    if(/fee|fees|payment|due|paid|ఫీజు|फीस|amount/.test(text)){awaitingFeeStudentId=true;res=r.fee;}
    else if(/^nhs\d+/i.test(text.trim())){
      showNMTyping();
      const msg=await fetchNMFee(text.trim());
      removeNMTyping();
      addNMMsg(msg,'bot');
      setNMQR(T[currentLang].qr);
      return;
    }
    else if(/admission|join|enroll|document|అడ్మిషన్|ప్రवेश/.test(text)){res=r.admission;}
    else if(/time|timing|hour|open|close|holiday|saturday|summer|సమయ|समय/.test(text)){res=r.timings;}
    else if(/exam|test|fa1|fa2|sa1|sa2|result|schedule|పరీక్ష|परीक्षा/.test(text)){res=r.exam;}
    else if(/contact|phone|address|location|principal|సంప్రదింపు|संपर्क/.test(text)){res=r.contact;}
    else if(/about|school|noble|service|గురించి|కే بارے/.test(text)){res=r.about;}
    else{res=r.def;}
    addNMMsg(res,'bot');
    if(!awaitingFeeStudentId)setNMQR(T[currentLang].qr);
  },800+Math.random()*400);
}

window.sendNM=function(){
  const inp=document.getElementById('nm-inp');
  const t=inp.value.trim();if(!t)return;
  addNMMsg(t,'user');inp.value='';processNM(t.toLowerCase());
};

// Init
setTimeout(()=>{
  showNMTyping();
  setTimeout(()=>{removeNMTyping();addNMMsg(T[currentLang].welcome,'bot');setNMQR(T[currentLang].qr);},1000);
},500);
// === SMART SECTION DIVISION LOGIC ===
function initSmartSectioning() {
  document.getElementById('smartSectioningResults').style.display = 'none';
  document.getElementById('sectionsAllocatedGrid').innerHTML = '';
}

function runSmartSectioning() {
  const selectedClass = document.getElementById('ssClassSelect').value;
  const numSections = parseInt(document.getElementById('ssCountSelect').value, 10);
  
  const allStudents = DB.get('students') || [];
  const classStudents = allStudents.filter(s => s.status === 'active' && s.className === selectedClass);
  
  if (classStudents.length === 0) {
    showToast(`No active students found in Class ${selectedClass}.`, 'warning');
    initSmartSectioning();
    return;
  }
  
  const reports = DB.get('reports') || [];
  const attendances = DB.get('attendance') || {};
  
  // Calculate score helper
  function stableHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  }
  
  const studentsWithScores = classStudents.map(student => {
    // 1. Academic marks calculation
    const studentReports = reports.filter(r => r.studentId === student.id);
    let totalPct = 0;
    let reportCount = 0;
    
    studentReports.forEach(r => {
      const allSubjects = getSubjectsByClass(student.className);
      const subjects = allSubjects.filter(sub => r.marks && r.marks[sub] !== 'NE');
      if (subjects.length > 0) {
        const numericMarks = subjects.map(s => {
          const v = r.marks[s];
          if (v === 'A') return 0;
          return isNaN(parseFloat(v)) ? 0 : parseFloat(v);
        });
        const obtained = numericMarks.reduce((a, b) => a + b, 0);
        const possible = subjects.length * r.totalPerSubj;
        if (possible > 0) {
          totalPct += (obtained / possible) * 100;
          reportCount++;
        }
      }
    });
    
    let academicScore = reportCount > 0 ? (totalPct / reportCount) : null;
    let isMockAcademic = false;
    if (academicScore === null) {
      academicScore = (stableHash(student.id + "academic") % 36) + 60; // 60% to 95%
      isMockAcademic = true;
    }
    
    // 2. Attendance calculation
    let presentDays = 0;
    let workingDays = 0;
    
    studentReports.forEach(r => {
      if (r.workingDays > 0) {
        presentDays += parseFloat(r.presentDays) || 0;
        workingDays += parseFloat(r.workingDays) || 0;
      }
    });
    
    let attendanceScore = workingDays > 0 ? (presentDays / workingDays) * 100 : null;
    let isMockAttendance = false;
    
    if (attendanceScore === null) {
      let totalDays = 0;
      let presentDaysCount = 0;
      Object.keys(attendances).forEach(date => {
        const dayData = attendances[date] || {};
        Object.keys(dayData).forEach(key => {
          const [cls, sec] = key.split('-');
          if (cls === student.className && (sec === 'ALL' || sec === student.section)) {
            totalDays++;
            const dayRecord = dayData[key] || {};
            const absentList = dayRecord.absent || [];
            if (!absentList.includes(student.id)) {
              presentDaysCount++;
            }
          }
        });
      });
      if (totalDays > 0) {
        attendanceScore = (presentDaysCount / totalDays) * 100;
      }
    }
    
    if (attendanceScore === null) {
      attendanceScore = (stableHash(student.id + "attendance") % 25) + 75; // 75% to 99%
      isMockAttendance = true;
    }
    
    const compositeScore = (0.7 * academicScore) + (0.3 * attendanceScore);
    
    return {
      student,
      academicScore,
      attendanceScore,
      compositeScore,
      isMockAcademic,
      isMockAttendance
    };
  });
  
  // Sort descending by composite score
  studentsWithScores.sort((a, b) => b.compositeScore - a.compositeScore);
  
  // Divide into N sections
  const sections = [];
  for (let i = 0; i < numSections; i++) {
    sections.push({
      name: String.fromCharCode(65 + i), // A, B, C, D
      students: []
    });
  }
  
  const N = studentsWithScores.length;
  const countPerSec = Math.floor(N / numSections);
  const remainder = N % numSections;
  
  let cursor = 0;
  for (let i = 0; i < numSections; i++) {
    const limit = countPerSec + (i < remainder ? 1 : 0);
    for (let j = 0; j < limit; j++) {
      if (cursor < N) {
        sections[i].students.push(studentsWithScores[cursor]);
        cursor++;
      }
    }
  }
  
  window.proposedSmartSections = sections.map(sec => ({
    name: sec.name,
    studentIds: sec.students.map(item => item.student.id)
  }));
  
  const grid = document.getElementById('sectionsAllocatedGrid');
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${numSections}, 1fr)`;
  
  sections.forEach((sec, idx) => {
    let colClass = 'sec-a';
    let subHeader = 'High Performers';
    if (sec.name === 'B') { colClass = 'sec-b'; subHeader = 'Average Performers'; }
    else if (sec.name === 'C') { colClass = 'sec-c'; subHeader = 'Needs Improvement'; }
    else if (sec.name === 'D') { colClass = 'sec-d'; subHeader = 'Requires Attention'; }
    
    const colHTML = `
      <div class="section-column">
        <div class="section-col-header ${colClass}">
          <div>Section ${sec.name}</div>
          <span style="font-size:0.8rem;background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:10px;">${sec.students.length} Students</span>
        </div>
        <div style="padding: 10px 14px 4px; font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border);">${subHeader}</div>
        <div class="section-student-list">
          ${sec.students.map(item => {
            const stu = item.student;
            const scoreClass = sec.name.toLowerCase();
            return `
              <div class="section-student-card" onclick="showSmartStudentDetail('${stu.id}', '${sec.name}', ${item.academicScore}, ${item.attendanceScore}, ${item.compositeScore})">
                <div class="sec-stu-left">
                  <div class="sec-stu-avatar">
                    ${stu.photo ? `<img src="${stu.photo}">` : `<svg viewBox="0 0 24 24" width="20" height="20" fill="#bbb"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`}
                  </div>
                  <div>
                    <div class="sec-stu-name">${stu.name}</div>
                    <div class="sec-stu-sub">Roll: ${stu.rollNo || 'N/A'} | ID: ${stu.id}</div>
                  </div>
                </div>
                <span class="sec-stu-badge ${scoreClass}">${item.compositeScore.toFixed(1)}%</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    grid.insertAdjacentHTML('beforeend', colHTML);
  });
  
  document.getElementById('smartSectioningResults').style.display = 'block';
  showToast(`Analyzed ${N} students. Division complete.`, 'success');
}

function applySmartSections() {
  if (!window.proposedSmartSections || window.proposedSmartSections.length === 0) return;
  
  const selectedClass = document.getElementById('ssClassSelect').value;
  if (!confirm(`Are you sure you want to permanently apply these sections for Class ${selectedClass}? This will update the section details of all allocated students in the database.`)) {
    return;
  }
  
  const students = DB.get('students') || [];
  let updatedCount = 0;
  
  window.proposedSmartSections.forEach(sec => {
    sec.studentIds.forEach(id => {
      const idx = students.findIndex(s => s.id === id);
      if (idx !== -1) {
        students[idx].section = sec.name;
        updatedCount++;
      }
    });
  });
  
  try {
    DB.set('students', students);
    showToast(`Successfully updated sections for ${updatedCount} students in Class ${selectedClass}!`, 'success');
    renderStudentTable();
    initSmartSectioning();
  } catch (err) {
    console.error(err);
    showToast('Failed to save updated sections.', 'error');
  }
}

function showSmartStudentDetail(studentId, allocatedSection, academicScore, attendanceScore, compositeScore) {
  const students = DB.get('students') || [];
  const student = students.find(s => s.id === studentId);
  if (!student) return;
  
  function getGaugeColor(score) {
    if (score >= 85) return 'green';
    if (score >= 70) return 'blue';
    if (score >= 50) return 'orange';
    return 'red';
  }
  
  const academicColor = getGaugeColor(academicScore);
  const attendanceColor = getGaugeColor(attendanceScore);
  
  const subjects = getSubjectsByClass(student.className);
  
  function stableHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  }
  
  const reports = DB.get('reports') || [];
  const studentReports = reports.filter(r => r.studentId === student.id);
  
  const subjectProgressBarsHTML = subjects.map(sub => {
    let sum = 0;
    let count = 0;
    studentReports.forEach(r => {
      if (r.marks && r.marks[sub] !== undefined && r.marks[sub] !== 'NE' && r.marks[sub] !== 'A') {
        const val = parseFloat(r.marks[sub]);
        if (!isNaN(val)) {
          sum += (val / r.totalPerSubj) * 100;
          count++;
        }
      }
    });
    
    let subMark = count > 0 ? (sum / count) : null;
    if (subMark === null) {
      const randOffset = (stableHash(student.id + sub) % 20) - 10;
      subMark = Math.min(100, Math.max(35, Math.round(academicScore + randOffset)));
    }
    
    let fillClass = 'blue';
    if (subMark >= 85) fillClass = 'green';
    else if (subMark < 50) fillClass = 'red';
    else if (subMark < 70) fillClass = 'orange';
    
    return `
      <div class="ss-subject-bar-item">
        <div class="ss-sub-label-row">
          <span>${sub}</span>
          <span style="font-weight:700;">${subMark.toFixed(0)}%</span>
        </div>
        <div class="ss-bar-bg">
          <div class="ss-bar-fill" style="width: ${subMark}%; background-color: var(--${fillClass === 'blue' ? 'primary' : fillClass});"></div>
        </div>
      </div>
    `;
  }).join('');
  
  let allocationTier = 'Upper';
  if (allocatedSection === 'B') allocationTier = 'Middle (Average)';
  else if (allocatedSection === 'C') allocationTier = 'Lower';
  else if (allocatedSection === 'D') allocationTier = 'Needs Improvement';
  
  const modalHTML = `
    <div class="ss-detail-overlay" id="ssDetailOverlay" onclick="closeSmartStudentDetail(event)">
      <div class="ss-detail-modal" onclick="event.stopPropagation()">
        <div class="ss-modal-header">
          <h3 class="ss-modal-title">Performance Analytics</h3>
          <button class="ss-modal-close" onclick="closeSmartStudentDetail()">&times;</button>
        </div>
        <div class="ss-modal-body">
          <div class="ss-stu-profile-row">
            <div class="ss-stu-profile-photo">
              ${student.photo ? `<img src="${student.photo}">` : `<svg viewBox="0 0 24 24" width="36" height="36" fill="#aaa" style="margin-top:12px;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`}
            </div>
            <div class="ss-stu-profile-details">
              <h4 style="margin-top: 0; margin-bottom: 6px; font-weight:700;">${student.name}</h4>
              <p><strong>Student ID / Login ID:</strong> ${student.id}</p>
              <p><strong>Roll No:</strong> ${student.rollNo || 'N/A'} | <strong>Class:</strong> Class ${student.className}</p>
              <p><strong>Emergency Contact:</strong> ${student.emergencyPhone || student.phone || 'N/A'}</p>
            </div>
          </div>

          <!-- GAUGES -->
          <div class="ss-gauges-row">
            <div class="ss-gauge-card">
              <span class="ss-gauge-title">Academic Average</span>
              <svg class="ss-gauge-svg">
                <circle class="ss-gauge-bg" cx="50" cy="50" r="40" />
                <circle class="ss-gauge-fill ${academicColor}" cx="50" cy="50" r="40" style="stroke-dashoffset: ${251.2 - (251.2 * academicScore) / 100}" />
              </svg>
              <div class="ss-gauge-text">${academicScore.toFixed(1)}%</div>
              <span class="ss-gauge-sub">Exams Average</span>
            </div>

            <div class="ss-gauge-card">
              <span class="ss-gauge-title">Attendance Rate</span>
              <svg class="ss-gauge-svg">
                <circle class="ss-gauge-bg" cx="50" cy="50" r="40" />
                <circle class="ss-gauge-fill ${attendanceColor}" cx="50" cy="50" r="40" style="stroke-dashoffset: ${251.2 - (251.2 * attendanceScore) / 100}" />
              </svg>
              <div class="ss-gauge-text">${attendanceScore.toFixed(1)}%</div>
              <span class="ss-gauge-sub">Term Attendance</span>
            </div>
          </div>

          <!-- ACADEMIC SUBJECT WISE BREAKDOWN -->
          <div class="ss-perf-details-card">
            <h4 class="ss-perf-details-title">Academic Marks Breakdown</h4>
            <div class="ss-subject-bar-row">
              ${subjectProgressBarsHTML}
            </div>
          </div>

          <!-- ALLOCATION REASONING / ANALYSIS -->
          <div class="ss-analysis-text">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#d97706" style="flex-shrink:0; margin-top:2px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
            <div>
              <strong>Section Placement Analysis:</strong> This student has been placed in <strong>Section ${allocatedSection}</strong> because their composite score of <strong>${compositeScore.toFixed(1)}%</strong> (70% exams + 30% attendance weightage) ranks in the <strong>${allocationTier}</strong> tier of Class ${student.className}.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeSmartStudentDetail(event) {
  if (event && event.target !== event.currentTarget && event.target.className !== 'ss-modal-close') return;
  const overlay = document.getElementById('ssDetailOverlay');
  if (overlay) {
    overlay.remove();
  }
}

})();