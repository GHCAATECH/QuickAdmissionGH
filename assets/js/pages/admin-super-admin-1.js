/* ============ MOCK DATA ============ */
const crestColors=['#1557B0','#1F4E79','#8A3A3A','#5A4FB0','#B07A1A','#2D6E6E','#7A3F8A'];
let schools=[
  {id:1,code:'ASM001',name:'Asuom Senior High School',short:'AS',admin:'Isaac Addo',plan:'Standard',students:245,admission:'OPENED',status:'active',charge:30,expiry:'2026-12-31',email:'asuomshs1970@gmail.com',phone:'0244791325',color:0},
  {id:2,code:'KMA002',name:'Kumasi Academy',short:'KA',admin:'Grace Owusu',plan:'Premium',students:512,admission:'OPENED',status:'active',charge:35,expiry:'2027-06-30',email:'info@kumasiacademy.edu.gh',phone:'0322041188',color:1},
  {id:3,code:'WGT003',name:'Wesley Girls High School',short:'WG',admin:'Abena Sarpong',plan:'Premium',students:438,admission:'CLOSED',status:'active',charge:30,expiry:'2026-09-30',email:'admin@wgshs.edu.gh',phone:'0332091044',color:3},
  {id:4,code:'PRE004',name:'Prempeh College',short:'PC',admin:'Yaw Boateng',plan:'Standard',students:301,admission:'OPENED',status:'active',charge:30,expiry:'2026-12-31',email:'office@prempeh.edu.gh',phone:'0322022019',color:2},
  {id:5,code:'ACH005',name:'Achimota School',short:'AC',admin:'Comfort Mensah',plan:'Standard',students:189,admission:'CLOSED',status:'active',charge:25,expiry:'2026-08-15',email:'info@achimota.edu.gh',phone:'0302401234',color:5},
  {id:6,code:'OPK006',name:'Opoku Ware School',short:'OW',admin:'Daniel Asare',plan:'Basic',students:78,admission:'CLOSED',status:'suspended',charge:30,expiry:'2025-12-31',email:'ows@opokuware.edu.gh',phone:'0322060700',color:6},
];
let nextSchoolId=7;
const firstNames=['Kofi','Ama','Yaw','Akua','Kwame','Esi','Kojo','Adwoa','Kwabena','Abena','Fiifi','Efua'];
const lastNames=['Mensah','Owusu','Asante','Boateng','Addo','Sarpong','Agyei','Darko','Appiah','Ofori'];
const progs=['General Science','General Arts','Business','Visual Arts','Home Economics'];
const stat=['pending','approved','enrolled'];
let students=[];
let admins=[]; let SA_UID=null;
let SA_DASH_SUMMARY={};
(function seed(){
  let idx=100000000000;
  schools.forEach(s=>{
    const n=Math.min(s.students,40);
    for(let i=0;i<n;i++){
      students.push({
        name:firstNames[Math.floor(Math.random()*firstNames.length)]+' '+lastNames[Math.floor(Math.random()*lastNames.length)],
        index:(idx+=1+Math.floor(Math.random()*7))+'',
        schoolId:s.id, programme:progs[Math.floor(Math.random()*progs.length)],
        status:stat[Math.floor(Math.random()*stat.length)],
        reg:randDate()
      });
    }
  });
})();
function randDate(){const d=new Date();d.setDate(d.getDate()-Math.floor(Math.random()*28));return d.toISOString().slice(0,10);}
let payments=[];
let financePaymentsLoadError='';
(function(){const methods=['Paystack','Hubtel','Flutterwave','Bank'];const st=['completed','completed','completed','pending','failed'];
  for(let i=0;i<28;i++){const s=schools[Math.floor(Math.random()*schools.length)];
    payments.push({date:randDate(),student:students[Math.floor(Math.random()*students.length)].name,schoolId:s.id,amount:s.charge,method:methods[Math.floor(Math.random()*methods.length)],status:st[Math.floor(Math.random()*st.length)],txn:'TXN'+(Math.floor(Math.random()*900000)+100000)});
  }})();
let activity=[
  {type:'reg',school:1,text:'New student registered',time:'2 min ago'},
  {type:'pay',school:2,text:'Token payment completed - GHS 35',time:'6 min ago'},
  {type:'sms',school:3,text:'Bulk SMS logged while delivery was disconnected',time:'14 min ago'},
  {type:'reg',school:4,text:'New student registered',time:'22 min ago'},
  {type:'sys',school:6,text:'Admission closed by school admin',time:'38 min ago'},
  {type:'pay',school:1,text:'Token payment completed - GHS 30',time:'51 min ago'},
  {type:'reg',school:2,text:'New student registered',time:'1 hr ago'},
  {type:'sms',school:5,text:'Reporting reminder logged while delivery was disconnected',time:'1 hr ago'},
];
let smsHistory=[
  {date:'2026-06-08',school:1,group:'Approved',recip:142,msg:'Your admission has been approved. Report on 18 Oct.',status:'pending'},
  {date:'2026-06-07',school:2,group:'All',recip:512,msg:'Reminder: complete your application before 15 June.',status:'pending'},
  {date:'2026-06-05',school:3,group:'Pending',recip:34,msg:'Action needed: finish your programme selection.',status:'pending'},
];
let smsBalance=12480;
let financePayQuery='';
let financePayPage=1;
const FINANCE_PAY_PAGE_SIZE=25;
const FINANCE_IT_RATE=5;
const FINANCE_HEAD_RATE=7.5;
const FINANCE_CHARGE_RATE=.01;
const FINANCE_TOTAL_RATE=FINANCE_IT_RATE+FINANCE_HEAD_RATE;
const FINANCE_BRAND_NAME='AXIOMBYTE HUB';
const FINANCE_BANK_NAME='GCB Bank PLC';
const FINANCE_CONTACT_PHONES='+233 (0)256744028 | +233 (0)544762763';
const FINANCE_CONTACT_EMAIL='axiombytehub@quickadmissiongh.com';
const FINANCE_REF_PREFIX='ABH/PAY/AD';
const FINANCE_BRAND_ICON=`<svg width="76" height="76" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="AXIOMBYTE HUB icon">
  <defs>
    <linearGradient id="abhTopFaceSA" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#34d399"/>
      <stop offset="1" stop-color="#10B981"/>
    </linearGradient>
    <linearGradient id="abhRightFaceSA" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0d9466"/>
      <stop offset="1" stop-color="#047857"/>
    </linearGradient>
    <linearGradient id="abhBottomFaceSA" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#065f46"/>
      <stop offset="1" stop-color="#0F172A"/>
    </linearGradient>
  </defs>
  <ellipse cx="82" cy="148" rx="66" ry="11" fill="#0F172A" opacity="0.18"/>
  <polygon points="22,116 130,116 148,134 40,134" fill="url(#abhBottomFaceSA)"/>
  <polygon points="130,18 130,116 148,134 148,36" fill="url(#abhRightFaceSA)"/>
  <rect x="20" y="14" width="110" height="104" rx="26" fill="url(#abhTopFaceSA)"/>
  <rect x="20" y="14" width="110" height="104" rx="26" fill="none" stroke="#ffffff" stroke-opacity="0.4" stroke-width="1.5"/>
  <g stroke="#ffffff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M75 38 L52 100"/>
    <path d="M75 38 L98 100"/>
  </g>
  <rect x="60" y="80" width="30" height="11" rx="5" fill="#ffffff"/>
  <circle cx="75" cy="38" r="7" fill="#ffffff"/>
</svg>`;

/* ============ HELPERS ============ */
const $=id=>document.getElementById(id);
const sById=id=>schools.find(s=>s.id===id)||{name:'-',short:'?',color:0,code:''};
const fmt=n=>n.toLocaleString('en-US');
const money=n=>'GHS '+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const moneyBare=n=>Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const round2=n=>Math.round((Number(n)||0)*100)/100;
const HTML_ESCAPE_MAP={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'};
function escapeHtml(v){ return String(v==null?'':v).replace(/[&<>"'`]/g,function(ch){ return HTML_ESCAPE_MAP[ch]; }); }
function escapeAttr(v){ return escapeHtml(v).replace(/\r?\n/g,'&#10;'); }
function safeHtml(v,fallback){ const text=String(v==null?'':v).trim(); return text?escapeHtml(text):(fallback||'&mdash;'); }
function crest(s){return `<span class="sch-crest" style="background:${crestColors[s.color]}">${escapeHtml(s.short)}</span>`;}
function toast(msg){$('toastMsg').textContent=msg;const t=$('toast');t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2600);}
function settledStudentCount(raw,maxCount){
  const clean=Math.max(parseInt(raw,10)||0,0);
  return typeof maxCount==='number' ? Math.min(clean,Math.max(maxCount,0)) : clean;
}
function completedFinancePaymentCount(source,schoolId){
  const seen=new Set();
  (source||[]).forEach(function(payment){
    const status=String(payment&&payment.status||'').trim().toLowerCase();
    if(!['completed','success','successful','paid'].includes(status)) return;
    if(schoolId!=null&&payment.schoolId!==schoolId) return;
    const index=String(payment&&payment.index||'').trim();
    const reference=String(payment&&payment.txn||'').trim();
    const key=(payment&&payment.studentId)
      ? 'student:'+String(payment.studentId)
      : (index&&index!=='—'&&index!=='-')
        ? 'school-index:'+String(payment.schoolId)+':'+index
        : reference
          ? 'reference:'+reference
          : '';
    if(key) seen.add(key);
  });
  return seen.size;
}
function hasSubmittedPersonalRecord(st){
  return !!(st&&(
    st.submitted ||
    (st.personalDone&&st.programmeDone&&st.undertakingDone) ||
    st.submittedAt
  ));
}
function financeSettlementForSchool(s){
  const schoolStudents=students.filter(function(st){ return st.schoolId===s.id; });
  const hasCompletionFlag=schoolStudents.some(function(st){
    return ['submitted','personalDone','programmeDone','undertakingDone','submittedAt'].some(function(k){ return typeof st[k]!=='undefined'; });
  });
  const registered=Math.max(hasCompletionFlag ? schoolStudents.filter(hasSubmittedPersonalRecord).length : Number(s.students||0),0);
  const completedStudents=completedFinancePaymentCount(payments,s.id);
  const total=Math.max(Number(s.placements||0),registered,completedStudents);
  const paidStudents=settledStudentCount(s&&s.financeSettledStudents,completedStudents);
  const dueStudents=Math.max(completedStudents-paidStudents,0);
  const pendingPlacements=Math.max(total-registered,0);
  const itGross=round2(dueStudents*FINANCE_IT_RATE);
  const itCharge=round2(itGross*FINANCE_CHARGE_RATE);
  const headGross=round2(dueStudents*FINANCE_HEAD_RATE);
  const headCharge=round2(headGross*FINANCE_CHARGE_RATE);
  const totalGross=round2(dueStudents*FINANCE_TOTAL_RATE);
  const paidAmount=round2(paidStudents*FINANCE_TOTAL_RATE);
  return {
    registered:registered,
    total:total,
    completedStudents:completedStudents,
    paidStudents:paidStudents,
    dueStudents:dueStudents,
    itGross:itGross,
    itCharge:itCharge,
    itNet:round2(itGross*(1-FINANCE_CHARGE_RATE)),
    headGross:headGross,
    headCharge:headCharge,
    headNet:round2(headGross*(1-FINANCE_CHARGE_RATE)),
    totalGross:totalGross,
    paidAmount:paidAmount,
    completedAmount:round2(completedStudents*FINANCE_TOTAL_RATE),
    hasHistory:paidStudents>0,
    pendingPlacements:pendingPlacements,
    claimStatus:completedStudents<=0?'NO PAYMENT':(paidStudents<=0?'UNPAID':(dueStudents<=0?'PAID':'PARTIAL'))
  };
}
function financeClaimStatusClass(status){
  return String(status||'').trim().toLowerCase().replace(/\s+/g,'-');
}
function financeAcademicYearValue(raw){
  const text=String(raw==null?'':raw).trim();
  if(!text) return String(new Date().getFullYear());
  const years=text.match(/20\d{2}/g);
  return years&&years.length ? years[years.length-1] : text;
}
function financeClaimAcademicYearValue(raw){
  const text=String(raw==null?'':raw).trim();
  if(!text) return '';
  const years=text.match(/20\d{2}/g);
  return years&&years.length ? years[years.length-1] : text;
}
function financeClaimCountValue(raw){
  return Math.max(parseInt(raw,10)||0,0);
}
function financeClaimSequence(raw){
  return String(financeClaimCountValue(raw)+1).padStart(4,'0');
}
function financeReferenceNumber(rawAcademicYear,rawClaimCount){
  return FINANCE_REF_PREFIX+'/'+financeAcademicYearValue(rawAcademicYear)+'/'+financeClaimSequence(rawClaimCount);
}
function financePrintDate(){
  return new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
}
function financeClaimPageHTML(opts){
  const schoolName=safeHtml(opts.schoolName||'School Name');
  const sectionTitle=safeHtml(opts.sectionTitle||'REQUEST FOR PAYMENT DETAILS');
  const studentsCount=safeHtml(fmt(opts.studentsCount||0));
  const rate=safeHtml(opts.rateText||'0.00');
  const gross=safeHtml(moneyBare(opts.gross||0));
  const charge=safeHtml(moneyBare(opts.charge||0));
  const net=safeHtml(moneyBare(opts.net||0));
  const refNo=safeHtml(opts.referenceNo||financeReferenceNumber('',0));
  return `<section class="claim-page">
    <div class="claim-header">
      <div class="claim-brand-icon">${FINANCE_BRAND_ICON}</div>
      <div class="claim-brand-copy">
        <div class="claim-brand-name">${safeHtml(FINANCE_BRAND_NAME)}</div>
        <div class="claim-meta-row"><strong>Bankers -</strong> ${safeHtml(FINANCE_BANK_NAME)}</div>
        <div class="claim-meta-row"><strong>PHONE:</strong> ${safeHtml(FINANCE_CONTACT_PHONES)}</div>
        <div class="claim-meta-row"><strong>EMAIL:</strong> ${safeHtml(FINANCE_CONTACT_EMAIL)}</div>
      </div>
    </div>
    <div class="claim-ref-grid">
      <div><strong>Our Ref. No.</strong> ${refNo}</div>
      <div><strong>Your Ref. No.</strong> ....................</div>
    </div>
    <p class="claim-salute">Dear Sir/Madam,</p>
    <h1 class="claim-title">${sectionTitle}</h1>
    <div class="claim-school"><strong>NAME OF SCHOOL:</strong> ${schoolName}</div>
    <p class="claim-copy">Statistics of Admission at the close of admission on ${safeHtml(financePrintDate())}</p>
    <dl class="claim-stats">
      <div><dt>Total Registered Students:</dt><dd>${studentsCount}</dd></div>
      <div><dt>Rate:</dt><dd>GHS ${rate}</dd></div>
      <div><dt>Total Revenue:</dt><dd>GHS ${gross}</dd></div>
      <div><dt>Momo/Bank charges (1%):</dt><dd>GHS ${charge}</dd></div>
      <div><dt>Amount Payable:</dt><dd>GHS ${net}</dd></div>
    </dl>
    <p class="claim-copy">Kindly provide your Account or Momo Details (Merchant Numbers and Rural Banks excluded):</p>
    <div class="claim-line"><span>Account No/Momo Number:</span><i></i></div>
    <div class="claim-line"><span>Account Name/Name on Momo:</span><i></i></div>
    <div class="claim-line"><span>Bank Name and Branch/Network Provider:</span><i></i></div>
    <div class="claim-signature">
      <div class="claim-sign-line"></div>
      <div class="claim-sign-copy">Stamp & Signature of Head of School here</div>
    </div>
    <p class="claim-copy">Please fill out this form, scan it, and submit it to WhatsApp no ${safeHtml('+233 (0)544762763')} or email ${safeHtml(FINANCE_CONTACT_EMAIL)}.</p>
    <p class="claim-copy">As soon as ${safeHtml(FINANCE_BRAND_NAME)} receives this document, payment will be made.</p>
    <p class="claim-copy">Many thanks.</p>
    <div class="claim-signoff">
      <p>Yours faithfully,</p>
      <p><strong>For ${safeHtml(FINANCE_BRAND_NAME)}</strong></p>
      <p>Authorized Signatory</p>
    </div>
  </section>`;
}
function openFinanceClaimPrintWindow(title,pagesHTML){
  const w=window.open('','_blank');
  if(!w){ toast('Allow pop-ups to print / save PDF'); return; }
  w.document.write('<html><head><title>'+escapeHtml(title)+'</title><style>'
    +'@page{size:A4;margin:15mm}'
    +'*{box-sizing:border-box}'
    +'body{margin:0;background:#eef3f8;font-family:Georgia,"Times New Roman",serif;color:#102437}'
    +'.claim-shell{padding:24px}'
    +'.claim-page{width:100%;max-width:840px;margin:0 auto 22px;background:#fff;padding:24px 28px;border:1px solid #d6dde8;box-shadow:0 18px 40px rgba(15,23,42,.08)}'
    +'.claim-page:last-child{margin-bottom:0}'
    +'.claim-header{display:flex;gap:16px;align-items:flex-start;border-bottom:2px solid #10B981;padding-bottom:14px;margin-bottom:12px}'
    +'.claim-brand-icon{width:82px;flex:0 0 82px}'
    +'.claim-brand-icon svg{display:block;width:100%;height:auto}'
    +'.claim-brand-name{font-family:Arial,sans-serif;font-size:25px;font-weight:800;letter-spacing:.04em;color:#0f766e;margin-bottom:4px}'
    +'.claim-meta-row{font-family:Arial,sans-serif;font-size:12.5px;line-height:1.55;color:#18324a}'
    +'.claim-ref-grid{display:flex;justify-content:space-between;gap:16px;font-family:Arial,sans-serif;font-size:12.5px;margin:10px 0 18px}'
    +'.claim-salute,.claim-copy,.claim-signoff p{font-size:13.5px;line-height:1.7;margin:0 0 12px}'
    +'.claim-title{font-family:Arial,sans-serif;font-size:20px;font-weight:800;text-align:center;letter-spacing:.02em;margin:8px 0 14px;color:#1557B0}'
    +'.claim-school{font-family:Arial,sans-serif;font-size:14px;margin-bottom:10px}'
    +'.claim-stats{margin:14px 0 18px}'
    +'.claim-stats div{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #e6ecf3;padding:8px 0;font-size:13.5px}'
    +'.claim-stats dt{font-weight:700}'
    +'.claim-stats dd{margin:0;font-weight:700}'
    +'.claim-line{display:flex;align-items:flex-end;gap:10px;font-size:13.5px;margin:16px 0}'
    +'.claim-line span{white-space:nowrap}'
    +'.claim-line i{display:block;flex:1;border-bottom:1px dotted #2f4858;height:16px}'
    +'.claim-signature{margin:26px 0 18px;text-align:center}'
    +'.claim-sign-line{width:260px;max-width:100%;border-bottom:1px solid #2f4858;margin:0 auto 10px;height:18px}'
    +'.claim-sign-copy{font-size:12.5px}'
    +'.claim-signoff{margin-top:18px}'
    +'@media print{body{background:#fff}.claim-shell{padding:0}.claim-page{box-shadow:none;border:none;margin:0 auto;page-break-after:always;min-height:auto;padding:0}.claim-page:last-child{page-break-after:auto}}'
    +'</style></head><body><div class="claim-shell">'+pagesHTML+'</div></body></html>');
  w.document.close();
  setTimeout(function(){ w.print(); },300);
}
function filteredFinancePayments(){
  const q=String(financePayQuery||'').trim().toLowerCase();
  if(!q) return payments.slice();
  return payments.filter(function(p){
    const school=sById(p.schoolId);
    return [p.date,p.student,p.index,(school&&school.name)||'',(school&&school.code)||'',p.amount,p.method,p.status,p.txn].some(function(part){
      return String(part==null?'':part).toLowerCase().includes(q);
    });
  });
}
function renderFinancePayments(){
  const rows=filteredFinancePayments();
  const total=rows.length;
  const totalPages=Math.max(1,Math.ceil(total/FINANCE_PAY_PAGE_SIZE));
  if(financePayPage>totalPages) financePayPage=totalPages;
  if(financePayPage<1) financePayPage=1;
  const start=(financePayPage-1)*FINANCE_PAY_PAGE_SIZE;
  const pageRows=rows.slice(start,start+FINANCE_PAY_PAGE_SIZE);
  $('payRows').innerHTML=pageRows.length?pageRows.map(function(p){
    const s=sById(p.schoolId);
    return `<tr><td class="mono">${safeHtml(p.date)}</td><td>${safeHtml(p.student)}</td><td><span class="code">${safeHtml(s.code)}</span> ${safeHtml(s.name)}</td><td class="mono">${safeHtml(money(p.amount))}</td><td>${safeHtml(p.method)}</td><td><span class="pill ${p.status}">${safeHtml(p.status)}</span></td><td class="mono" style="font-size:12px">${safeHtml(p.txn)}</td></tr>`;
  }).join(''):emptyRow(7,total?'No transactions on this page.':'No transactions found.');
  const from=total?start+1:0;
  const to=Math.min(start+pageRows.length,total);
  const meta=$('financePayMeta');
  if(meta) meta.textContent='Showing '+from+'-'+to+' of '+total+' transactions';
  const status=$('financePayPageStatus');
  if(status) status.textContent='Page '+financePayPage+' of '+totalPages+' · 25 per page';
}
function applyFinancePaymentSearch(){
  financePayQuery=sval('financePaySearch').trim();
  financePayPage=1;
  renderFinancePayments();
}
function changeFinancePayPage(step){
  const totalPages=Math.max(1,Math.ceil(filteredFinancePayments().length/FINANCE_PAY_PAGE_SIZE));
  const next=Math.min(Math.max(financePayPage+step,1),totalPages);
  if(next===financePayPage) return;
  financePayPage=next;
  renderFinancePayments();
}
function financeCsvCell(value){
  return '"'+String(value==null?'':value).replace(/"/g,'""')+'"';
}
function downloadFinancePaymentsCSV(){
  const rows=filteredFinancePayments();
  if(!rows.length){toast('No transactions to export.');return;}
  const data=[['Date','Student','School','Index No','Amount (GHS)','Method','Status','Transaction ID']]
    .concat(rows.map(function(p){
      const school=sById(p.schoolId);
      return [p.date,p.student,(school&&school.name)||'',p.index,Number(p.amount||0).toFixed(2),p.method,p.status,p.txn];
    }));
  const blob=new Blob(['\ufeff'+data.map(function(row){return row.map(financeCsvCell).join(',');}).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download='platform-financial-transactions-'+new Date().toISOString().slice(0,10)+'.csv';
  link.click();
  setTimeout(function(){URL.revokeObjectURL(link.href);},1000);
}

/* ============ STATS ============ */
function totalStudents(){return schools.reduce((a,s)=>a+s.students,0);}
function totalRevenue(){return payments.filter(p=>p.status==='completed').reduce((a,p)=>a+p.amount,0);}
function saSummaryNumber(key,fallback){
  const value=Number(SA_DASH_SUMMARY&&SA_DASH_SUMMARY[key]);
  return Number.isFinite(value)?Math.max(value,0):fallback;
}
function saAdmissionIsOpen(value){
  return ['OPEN','OPENED','ACTIVE','TRUE','YES','1'].includes(String(value==null?'':value).trim().toUpperCase());
}
function renderStats(){
  const todayReg=saSummaryNumber('today_registrations',window._todayReg||0);
  const openCount=saSummaryNumber('open_admissions',schools.filter(s=>saAdmissionIsOpen(s.admission)).length);
  const activeSchools=saSummaryNumber('active_schools',schools.filter(s=>s.status!=='suspended').length);
  const totalSchoolCount=saSummaryNumber('total_schools',schools.length);
  const platformStudents=saSummaryNumber('total_students',totalStudents());
  const platformRevenue=saSummaryNumber('total_revenue_pesewas',Math.round(totalRevenue()*100))/100;
  const platformSms=saSummaryNumber('sms_balance',smsBalance);
  const cards=[
    {lbl:'Total Schools',val:activeSchools,ico:'school',delta:'active',flat:true},
    {lbl:'Total Students',val:fmt(platformStudents),ico:'users',delta:'all schools',flat:true},
    {lbl:"Today's Reg.",val:todayReg,ico:'bolt',delta:'live',live:true},
    {lbl:'Total Revenue',val:platformRevenue,cur:true,ico:'cash',delta:'collected',flat:true},
    {lbl:'Open Admissions',val:openCount,ico:'door',delta:openCount+' of '+totalSchoolCount,flat:true},
    {lbl:'SMS Credits',val:fmt(platformSms),ico:'sms',delta:'global pool',flat:true},
  ];
  const icons={school:'<path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/>',users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',bolt:'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',cash:'<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',door:'<path d="M13 3v18M3 21h18M6 21V5a2 2 0 0 1 2-2h7"/>',sms:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'};
  $('statGrid').innerHTML=cards.map(c=>`
    <div class="stat" ${c.live?'data-live="1"':''}>
      <div class="top"><span class="lbl">${c.lbl}</span><span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icons[c.ico]}</svg></span></div>
      <div class="val">${c.cur?'<span class="cur">GHS</span>':''}${c.cur?fmt(c.val):c.val}</div>
      <div class="delta ${c.flat?'flat':''}">${c.live?'<span class="live-dot"></span>':'<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="18 15 12 9 6 15"/></svg>'}${c.delta}</div>
    </div>`).join('');
}

/* ============ DASHBOARD TABLE + FEED ============ */
function schoolRow(s,mode){
  const acts = mode==='dash'
    ? `<button class="act" data-qa-onclick="openSchool(${s.id})">View</button>`
    : `<button class="act" data-qa-onclick="openSchool(${s.id})">View</button>
       <button class="act" data-qa-onclick="editSchool(${s.id})">Edit</button>
       <button class="act" data-qa-onclick="toggleAdmission(${s.id})">${s.admission==='OPENED'?'Close':'Open'}</button>
       <button class="act" style="color:#b42318;border-color:#f3c9c4" data-qa-onclick="deleteSchool(${s.id})">Delete</button>`;
  const adm=`<span class="pill ${s.admission==='OPENED'?'open':'closed'}">${s.admission}</span>`;
  if(mode==='dash'){
    return `<tr><td><div class="sch-cell">${crest(s)}<span class="sch-name">${safeHtml(s.name)}</span></div></td>
      <td><span class="code">${safeHtml(schoolSenderCode(s)||s.code)}</span></td><td>${safeHtml(s.admin)}</td>
      <td class="mono">${safeHtml(fmt(s.students))}</td><td>${adm}</td><td class="mono">${safeHtml(s.charge)}</td>
      <td><div class="row-actions">${acts}</div></td></tr>`;
  }
  return `<tr><td><div class="sch-cell">${crest(s)}<span class="sch-name">${safeHtml(s.name)}</span></div></td>
    <td><span class="code">${safeHtml(schoolSenderCode(s)||'—')}</span></td>
    <td class="mono" style="font-size:12px">${s.subdomain?`<a href="${escapeAttr(schoolPortalUrl(s))}" target="_blank" rel="noopener">${safeHtml(s.subdomain)}.quickadmissiongh.com</a>`:'&mdash;'}</td>
    <td class="mono" style="font-size:12px">${safeHtml(s.email,'&mdash;')}</td>
    <td class="mono">${safeHtml(s.phone,'&mdash;')}</td>
    <td><span class="pill ${s.status}">${s.status}</span></td>
    <td><div class="row-actions">${acts}</div></td></tr>`;
}
function renderDashTable(){$('dashSchoolRows').innerHTML=schools.slice(0,6).map(s=>schoolRow(s,'dash')).join('');}
function renderFeed(){
  const ic={reg:['fi-reg','<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>'],
    pay:['fi-pay','<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'],
    sms:['fi-sms','<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'],
    sys:['fi-sys','<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82M4.6 9a1.65 1.65 0 0 0 .33-1.82"/>']};
  $('activityFeed').innerHTML=activity.map(a=>{const s=sById(a.school);const[cl,p]=ic[a.type];
    return `<div class="feed-item"><div class="feed-ico ${cl}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${p}</svg></div>
    <div><div class="feed-txt">${safeHtml(a.text)} - <b>${safeHtml(s.name)}</b></div><div class="feed-time">${safeHtml(a.time)}</div></div></div>`;}).join('');
}

/* ============ CHARTS ============ */
let charts={};
function buildCharts(){
  Object.values(charts).forEach(c=>c&&c.destroy());
  Chart.defaults.font.family="'Inter',sans-serif";Chart.defaults.font.size=11;Chart.defaults.color='#8A9893';
  const days=[...Array(30)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-29+i);return d.getDate()+'/'+(d.getMonth()+1);});
  let base=40;const series=days.map(()=>{base+=Math.round((Math.random()-.35)*14);return Math.max(12,base);});
  charts.trend=new Chart($('trendChart'),{type:'line',data:{labels:days,datasets:[{data:series,borderColor:'#1557B0',backgroundColor:'rgba(17,94,74,.10)',fill:true,tension:.35,borderWidth:2,pointRadius:0,pointHoverRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:7}},y:{grid:{color:'#EEF1EF'},beginAtZero:true}}}});
  const top=[...schools].sort((a,b)=>b.students-a.students).slice(0,5);
  charts.top=new Chart($('topChart'),{type:'bar',data:{labels:top.map(s=>s.short),datasets:[{data:top.map(s=>s.students),backgroundColor:'#1557B0',borderRadius:6,barThickness:24}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{grid:{color:'#EEF1EF'},beginAtZero:true}}}});
  const rev=schools.map(s=>({n:s.short,v:s.students*s.charge}));
  charts.rev=new Chart($('revChart'),{type:'doughnut',data:{labels:rev.map(r=>r.n),datasets:[{data:rev.map(r=>r.v),backgroundColor:crestColors,borderWidth:2,borderColor:'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'right',labels:{boxWidth:10,padding:8,font:{size:10}}}}}});
}

/* ============ VIEW RENDERERS ============ */
function renderSchools(){
  const q=($('schoolSearch').value||'').toLowerCase();const f=$('schoolFilter').value;
  const rows=schools.filter(s=>(s.name.toLowerCase().includes(q)||String(s.code||'').toLowerCase().includes(q)||schoolSenderCode(s).toLowerCase().includes(q)||String(s.subdomain||'').includes(q))&&(f==='all'||s.status===f));
  $('schoolRows').innerHTML=rows.length?rows.map(s=>schoolRow(s,'manage')).join(''):emptyRow(7,'No schools match your filters.');
  $('badge-schools').textContent=schools.filter(s=>s.status!=='suspended').length;
}
function aInit(n){return ((n||'?').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('')||'?').toUpperCase();}
function genStr(n){
  const c='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes=new Uint8Array(Math.max(Number(n)||10,8));
  crypto.getRandomValues(bytes);
  return Array.from(bytes,function(byte){return c[byte%c.length];}).join('');
}
function renderAdmins(){
  if(!admins.length){$('adminRows').innerHTML=emptyRow(7,'No admin accounts yet. Use "Create admin".');return;}
  $('adminRows').innerHTML=admins.map(a=>`<tr>
    <td><div class="sch-cell"><span style="display:inline-flex;width:30px;height:30px;border-radius:8px;background:var(--primary);color:#fff;align-items:center;justify-content:center;font-size:11px;font-weight:700">${escapeHtml(aInit(a.name))}</span><span class="sch-name">${safeHtml(a.name)}${a.uid===SA_UID?' <span style="font-size:10px;color:var(--muted)">(you)</span>':''}</span></div></td>
    <td>${safeHtml(a.school)}</td>
    <td class="mono" style="font-size:12px">${safeHtml(a.email)}</td>
    <td>${a.role==='super_admin'?'Super admin':(a.coAdmin?'School co-admin':'School admin')}</td>
    <td class="mono">-</td>
    <td><span class="pill open">active</span></td>
    <td><div class="row-actions">
      <button class="act" data-qa-onclick="editAdmin('${a.uid}')">Edit</button>
      <button class="act" data-qa-onclick="resetAdminPwd('${a.uid}')">Reset</button>
      ${a.uid===SA_UID?'':`<button class="act" style="color:#b42318;border-color:#f3c9c4" data-qa-onclick="deleteAdmin('${a.uid}')">Delete</button>`}
    </div></td></tr>`).join('');
}
function editAdmin(uid){
  const a=admins.find(x=>x.uid===uid); if(!a)return;
  const m=$('modal');m.className='modal';
  m.innerHTML=`
  <div class="modal-head"><div><h2>Edit admin</h2><p>${safeHtml(a.email)} - ${safeHtml(a.school)}</p></div><button class="modal-x" data-qa-onclick="closeModal()">&times;</button></div>
  <div class="modal-body"><div class="form-grid"><fieldset><legend>Account</legend>
    <div class="field"><label>Full name</label><input id="ea_name" value="${escapeAttr(a.name)}"></div>
    <div class="field"><label>Email</label><input value="${escapeAttr(a.email)}" disabled></div>
    <div class="field"><label>New password <span class="hint">- leave blank to keep current</span></label><div style="display:flex;gap:8px"><input id="ea_pass" type="text" placeholder="At least 8 characters" style="flex:1"><button class="btn btn-ghost btn-sm" type="button" data-qa-onclick="qaSetGeneratedAdminEditPassword()">Generate</button></div></div>
  </fieldset></div></div>
  <div class="modal-foot"><button class="btn btn-ghost" data-qa-onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="ea_btn" data-qa-onclick="saveAdminEdit('${uid}')">Save changes</button></div>`;
  $('overlay').classList.add('show');
}
function randTime(){const h=Math.floor(Math.random()*24);const m=Math.floor(Math.random()*60);const d=Math.floor(Math.random()*5);return d===0?`Today ${pad(h)}:${pad(m)}`:`${d}d ago`;}
function pad(n){return (n<10?'0':'')+n;}
function renderStudents(){
  const q=($('studentSearch').value||'').toLowerCase();
  const sf=$('studentSchoolFilter').value;const st=$('studentStatusFilter').value;
  const rows=students.filter(s=>(s.name.toLowerCase().includes(q)||s.index.includes(q))&&(sf==='all'||s.schoolId==sf)&&(st==='all'||s.status===st)).slice(0,60);
  $('studentRows').innerHTML=rows.length?rows.map(s=>{const sc=sById(s.schoolId);return `<tr>
    <td><span class="sch-name">${safeHtml(s.name)}</span></td><td class="mono">${safeHtml(s.index)}</td>
    <td><div class="sch-cell" style="gap:8px"><span class="code">${safeHtml(sc.code)}</span> ${safeHtml(sc.name)}</div></td>
    <td>${safeHtml(s.programme)}</td><td><span class="pill ${s.status}">${safeHtml(s.status)}</span></td><td class="mono">${safeHtml(s.reg)}</td></tr>`;}).join(''):emptyRow(6,'No students match your filters.');
}
function printSettlementRequest(id){
  const s=sById(id);
  if(!s){ toast('School not found.'); return; }
  const snap=financeSettlementForSchool(s);
  if(!snap.dueStudents){ toast('No pending school claim is available right now.'); return; }
  const refNo=financeReferenceNumber(s.academicYear,s.financeClaimCount);
  const headTitle=String(s.headmasterTitle||'Head of School').trim().toUpperCase();
  const pagesHTML=
    financeClaimPageHTML({
      schoolName:s.name,
      sectionTitle:'REQUEST FOR PAYMENT DETAILS - IT AND ADMISSIONS TEAM',
      studentsCount:snap.dueStudents,
      rateText:moneyBare(FINANCE_IT_RATE),
      gross:snap.itGross,
      charge:snap.itCharge,
      net:snap.itNet,
      referenceNo:refNo
    })+
    financeClaimPageHTML({
      schoolName:s.name,
      sectionTitle:'REQUEST FOR PAYMENT DETAILS - '+headTitle,
      studentsCount:snap.dueStudents,
      rateText:moneyBare(FINANCE_HEAD_RATE),
      gross:snap.headGross,
      charge:snap.headCharge,
      net:snap.headNet,
      referenceNo:refNo
    });
  openFinanceClaimPrintWindow(s.name+' Claim Form',pagesHTML);
}
function financeResetPreviewHTML(summary,count){
  const claim=Math.max(parseInt(count,10)||0,0);
  const limited=Math.min(claim,summary.dueStudents);
  const itGross=round2(limited*FINANCE_IT_RATE);
  const itCharge=round2(itGross*FINANCE_CHARGE_RATE);
  const headGross=round2(limited*FINANCE_HEAD_RATE);
  const headCharge=round2(headGross*FINANCE_CHARGE_RATE);
  const totalGross=round2(limited*FINANCE_TOTAL_RATE);
  const itNet=round2(itGross*(1-FINANCE_CHARGE_RATE));
  const headNet=round2(headGross*(1-FINANCE_CHARGE_RATE));
  const totalNet=round2(itNet+headNet);
  return `
    <h4>Claim preview</h4>
    <div class="row"><span>Students in this claim</span><strong>${safeHtml(fmt(limited))}</strong></div>
    <div class="row"><span>IT / Contact Person</span><strong>GHC${safeHtml(moneyBare(itNet))}</strong></div>
    <div class="row"><span>Head</span><strong>GHC${safeHtml(moneyBare(headNet))}</strong></div>
    <div class="row"><span>Gross reset amount</span><strong>GHC${safeHtml(moneyBare(totalGross))}</strong></div>
    <div class="row"><span>Net after charges</span><strong>GHC${safeHtml(moneyBare(totalNet))}</strong></div>
  `;
}
function refreshFinanceResetPreview(id){
  const s=sById(id); if(!s)return;
  const summary=financeSettlementForSchool(s);
  const input=$('fr_claim_count'); const preview=$('fr_preview'); const hint=$('fr_after');
  if(!input||!preview||!hint)return;
  let next=Math.max(parseInt(input.value,10)||0,0);
  if(summary.dueStudents<=0){ next=0; }
  if(next>summary.dueStudents){ next=summary.dueStudents; input.value=String(next); }
  preview.innerHTML=financeResetPreviewHTML(summary,next);
  hint.textContent='After this payout, '+fmt(Math.max(summary.dueStudents-next,0))+' successful student payment(s) will remain unpaid for this school.';
}
function openFinanceReset(id){
  const s=sById(id); if(!s)return;
  const summary=financeSettlementForSchool(s);
  if(summary.dueStudents<=0){ toast('No unclaimed school revenue is pending for '+s.name); return; }
  const m=$('modal');
  m.innerHTML=`
    <div class="modal-head">
      <div><h2>Mark financial claim as paid</h2><p>${safeHtml(s.name)} - record the successful-payment claims covered by this payout.</p></div>
      <button class="modal-x" data-qa-onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-body">
      <p class="finance-aux-copy">This does not delete payment history. It moves part of the school's pending revenue into paid history so the due balance drops after a partial claim.</p>
      <div class="finance-reset-grid">
        <div class="finance-reset-card"><div class="k">Successful student payments</div><div class="v">${safeHtml(fmt(summary.completedStudents))}</div></div>
        <div class="finance-reset-card"><div class="k">Claims already paid</div><div class="v">${safeHtml(fmt(summary.paidStudents))}</div></div>
        <div class="finance-reset-card"><div class="k">Available now</div><div class="v">${safeHtml(fmt(summary.dueStudents))}</div></div>
      </div>
      <div class="field" style="margin-top:18px">
        <label>Successful payments covered by this payout</label>
        <input id="fr_claim_count" type="number" min="1" max="${escapeAttr(summary.dueStudents)}" value="${escapeAttr(summary.dueStudents)}" data-qa-oninput="refreshFinanceResetPreview(${id})">
        <div class="finance-reset-inline">Enter how many successful student payments this payout should mark as paid.</div>
      </div>
      <div class="finance-reset-preview" id="fr_preview"></div>
      <div class="finance-reset-inline" id="fr_after"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-qa-onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="fr_btn" data-qa-onclick="saveFinanceReset(${id})">Mark claim paid</button>
    </div>`;
  $('overlay').classList.add('show');
  refreshFinanceResetPreview(id);
}
async function saveFinanceReset(id){
  const s=sById(id); if(!s)return;
  const summary=financeSettlementForSchool(s);
  const claim=Math.max(parseInt(sval('fr_claim_count'),10)||0,0);
  if(!claim){ toast('Enter the number of successful payments covered by this payout.'); return; }
  if(claim>summary.dueStudents){ toast('The payout cannot cover more than the unpaid successful-payment count.'); return; }
  const btn=$('fr_btn'); if(btn) btn.textContent='Applying...';
  const {data,error}=await sb.rpc('apply_finance_claim',{p_school_id:s._id,p_claim_students:claim});
  if(error){
    if(btn) btn.textContent='Mark claim paid';
    const msg=/apply_finance_claim|function|schema cache/i.test(error.message||'')
      ? 'The financial hardening migration must be run in Supabase before claims can be saved.'
      : 'Could not mark claim paid: '+error.message;
    toast(msg);
    return;
  }
  if(!data||data.ok!==true){
    if(btn) btn.textContent='Mark claim paid';
    toast('The claim was not confirmed by Supabase.');
    return;
  }
  closeModal();
  await loadSA();
  go('finance');
  toast('Claim marked paid for '+s.name+' - '+claim+' successful student payment(s)');
}
function renderFinance(){
  if(financePaymentsLoadError){
    $('finStats').innerHTML='<div class="stat" style="grid-column:1/-1"><div class="top"><span class="lbl">Financial data unavailable</span></div><div class="delta flat">'+safeHtml(financePaymentsLoadError)+'</div></div>';
    $('finRows').innerHTML=emptyRow(8,'Financial data could not be loaded. Refresh the page or check Supabase access.');
    $('payRows').innerHTML=emptyRow(7,'Transactions could not be loaded.');
    $('financePayMeta').textContent='Financial data unavailable';
    return;
  }
  const summary=schools.map(financeSettlementForSchool);
  const totalSuccessful=summary.reduce((a,s)=>a+s.completedStudents,0);
  const totalDue=summary.reduce((a,s)=>a+s.dueStudents,0);
  const totalPaidStudents=summary.reduce((a,s)=>a+s.paidStudents,0);
  const totalPaidAmount=round2(summary.reduce((a,s)=>a+s.paidAmount,0));
  const stats=[
    {lbl:'Successful Student Payments',val:fmt(totalSuccessful),ico:'users',delta:'unique completed payments across all schools',flat:true},
    {lbl:'Due Successful Payments',val:fmt(totalDue),ico:'door',delta:'unclaimed paid-token records',flat:true},
    {lbl:'Successful Payments Paid',val:fmt(totalPaidStudents),ico:'school',delta:'already settled',flat:true},
    {lbl:'Amount Paid',val:totalPaidAmount,cur:true,ico:'cash',delta:'IT + Head successful-payment share paid so far',flat:true},
  ];
  $('finStats').innerHTML=stats.map(function(c){
    const icons={school:'<path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/>',users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',door:'<path d="M13 3v18M3 21h18M6 21V5a2 2 0 0 1 2-2h7"/>',cash:'<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'};
    return `<div class="stat"><div class="top"><span class="lbl">${c.lbl}</span><span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icons[c.ico]}</svg></span></div><div class="val">${c.cur?'<span class="cur">GHS</span>'+moneyBare(c.val):c.val}</div><div class="delta flat">${c.delta}</div></div>`;
  }).join('');
  $('finRows').innerHTML=schools.length?schools.map(function(s,idx){
    const f=financeSettlementForSchool(s);
    const successfulPaymentLabel=fmt(f.completedStudents)+' Out of '+fmt(f.total);
    const placementGapHtml=f.pendingPlacements>0
      ? `<div class="finance-summary-sub">${safeHtml(fmt(f.pendingPlacements))} placement student(s) not submitted yet</div>`
      : '';
    const submittedClaimsHtml=`<div class="finance-summary-sub">${safeHtml(fmt(f.registered))} admission form(s) submitted</div>`;
    const actionHtml=f.dueStudents>0
      ? `<div class="finance-action-note">${safeHtml(fmt(f.dueStudents))} remaining</div>
          <button class="btn btn-primary btn-sm finance-request-btn" data-qa-onclick="printSettlementRequest(${s.id})">Print Request Form</button>
          <button class="btn btn-ghost btn-sm finance-request-btn" data-qa-onclick="openFinanceReset(${s.id})">${f.paidStudents>0?'Mark Remaining Paid':'Mark Claim as Paid'}</button>`
      : `<div class="finance-summary-sub">${f.paidStudents>0?'Paid in full':'No successful payments to claim'}</div>`;
    return `<tr>
      <td><div class="finance-index mono">${idx+1}</div></td>
      <td>
        <div class="finance-school-cell">
          <div class="sch-cell">${crest(s)}<span class="finance-school-name">${safeHtml(s.name)}</span></div>
          <div class="finance-school-meta"><span class="code">${safeHtml(schoolSenderCode(s)||s.code||'-')}</span></div>
        </div>
      </td>
      <td>
        <div class="finance-registered-block">
          <div class="finance-registered-count">${safeHtml(successfulPaymentLabel)}</div>
          ${submittedClaimsHtml}
          ${placementGapHtml}
          <div>
            <div class="finance-history-label">Settlement History:</div>
            <div class="finance-history-paid">Already paid for ${safeHtml(fmt(f.paidStudents))} successful payment(s) - GHC${safeHtml(moneyBare(f.paidAmount))}</div>
            <div class="finance-summary-sub">Completed payment records: ${safeHtml(fmt(f.completedStudents))}</div>
          </div>
          <div>
            <div class="finance-due-label">Due Successful Payments:</div>
            <div class="finance-due-count">No of payments: ${safeHtml(fmt(f.dueStudents))}</div>
          </div>
        </div>
      </td>
      <td>
        <div class="finance-split">
          <div class="finance-split-group">
            <h4>IT Person</h4>
            <div class="finance-split-amount">${safeHtml(moneyBare(f.itGross))}</div>
            <div class="finance-split-line">Momo/Bank charges: ${safeHtml(moneyBare(f.itCharge))}</div>
            <div class="finance-split-line"><strong>To Pay: ${safeHtml(moneyBare(f.itNet))}</strong></div>
          </div>
          <div class="finance-split-group">
            <h4>Head</h4>
            <div class="finance-split-amount">${safeHtml(moneyBare(f.headGross))}</div>
            <div class="finance-split-line">Momo/Bank charges: ${safeHtml(moneyBare(f.headCharge))}</div>
            <div class="finance-split-line"><strong>To Pay: ${safeHtml(moneyBare(f.headNet))}</strong></div>
          </div>
        </div>
        <div class="finance-action-group">
          ${actionHtml}
        </div>
      </td>
      <td><div class="finance-total mono">${safeHtml(moneyBare(f.totalGross))}</div></td>
      <td><span class="finance-paid-flag ${financeClaimStatusClass(f.claimStatus)}">${safeHtml(f.claimStatus)}</span></td>
      <td>
        <div class="finance-paid-students mono">${safeHtml(fmt(f.paidStudents))}</div>
        <div class="finance-summary-sub">claim payments paid</div>
      </td>
      <td>
        <div class="finance-paid-amount mono">GHC${safeHtml(moneyBare(f.paidAmount))}</div>
      </td>
    </tr>`;
  }).join(''):emptyRow(8,'No schools available for financial reporting.');
  renderFinancePayments();
}
function renderSms(){
  $('smsRows').innerHTML=smsHistory.map(h=>{const s=sById(h.school)||{name:'Unknown school'};return `<tr><td class="mono">${safeHtml(h.date)}</td><td>${safeHtml(s.name)}</td><td>${safeHtml(h.group)}</td><td class="mono">${safeHtml(h.recip)}</td><td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${safeHtml(h.msg)}</td><td><span class="pill ${h.status==='sent'?'open':(h.status==='failed'?'closed':'pending')}">${safeHtml(h.status)}</span></td></tr>`;}).join('');
  $('smsBalance').textContent=fmt(smsBalance);
  updateSmsCount();
}
function emptyRow(cols,msg){return `<tr><td colspan="${cols}"><div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><div>${msg}</div></div></td></tr>`;}

/* ============ SMS LOGIC ============ */
function recipientCount(){
  return smsTargets().length;
}
function updateSmsCount(){
  const len=($('smsBody').value||'').length;
  $('smsChars').textContent=len;$('smsCredits').textContent=Math.max(1,Math.ceil(len/160));
  $('smsRecip').textContent=fmt(recipientCount());
}
function loadTemplate(v){
  const t={approved:'Your admission has been approved. Admission No: {ADM}. Report on 18 Oct 2025.',reminder:'Reminder: Reporting date is 18 Oct 2025. Bring all required documents.',payment:'Payment received. Your admission token is {TOKEN}. Use it with your index number to log in.'};
  if(t[v]){$('smsBody').value=t[v];updateSmsCount();}
}
function sendBulkSms(){
  toast('Preparing delivery...');
}

/* ============ SCHOOL ACTIONS ============ */
function toggleAdmission(id){const s=sById(id);s.admission=s.admission==='OPENED'?'CLOSED':'OPENED';
  activity.unshift({type:'sys',school:id,text:`Admission ${s.admission.toLowerCase()} by Super Admin`,time:'just now'});
  renderSchools();renderDashTable();renderFeed();renderStats();
  toast(`${s.name}: admission ${s.admission}`);}

function openSchool(id){
  const s=sById(id);
  const senderCode=schoolSenderCode(s)||'—';
  const schoolStudents=students.filter(st=>st.schoolId===id).slice(0,8);
  const schoolPays=payments.filter(p=>p.schoolId===id).slice(0,6);
  const m=$('modal');m.className='modal wide';
  m.innerHTML=`
  <div class="modal-head">
    <div style="display:flex;gap:13px;align-items:center">${crest(s)}<div><h2>${safeHtml(s.name)}</h2><p><span class="code">${safeHtml(senderCode)}</span> - ${safeHtml(s.plan)} plan - expires ${safeHtml(s.expiry)}</p></div></div>
    <button class="modal-x" data-qa-onclick="closeModal()">&times;</button>
  </div>
  <div class="tabs" id="schoolTabs">
    ${['Profile','Admin','Students','Payments','Subscription','Danger zone'].map((t,i)=>`<button class="tab ${i===0?'active':''}" data-qa-onclick="schoolTab(${i})">${t}</button>`).join('')}
  </div>
  <div class="tab-panel active" data-tab="0">
    <dl class="kv"><dt>Full name</dt><dd>${safeHtml(s.name)}</dd><dt>School code / Sender ID</dt><dd><span class="code">${safeHtml(senderCode)}</span></dd>
    <dt>School portal</dt><dd>${s.subdomain?`<a href="${escapeAttr(schoolPortalUrl(s))}" target="_blank" rel="noopener">${safeHtml(schoolPortalUrl(s))}</a>`:'Not configured'}</dd>
    <dt>Email</dt><dd>${safeHtml(s.email)}</dd><dt>Phone</dt><dd class="mono">${safeHtml(s.phone)}</dd>
    <dt>Admission</dt><dd><span class="pill ${s.admission==='OPENED'?'open':'closed'}">${safeHtml(s.admission)}</span></dd>
    <dt>Service charge</dt><dd class="mono">GHS ${safeHtml(s.charge.toFixed(2))}</dd><dt>Status</dt><dd><span class="pill ${s.status}">${safeHtml(s.status)}</span></dd></dl>
    <div style="margin-top:16px;display:flex;gap:9px"><button class="btn btn-ghost btn-sm" data-qa-onclick="editSchool(${id})">Edit profile</button><button class="btn btn-ghost btn-sm" data-qa-onclick="toggleAdmission(${id});closeModal()">${s.admission==='OPENED'?'Close':'Open'} admission</button></div>
  </div>
  <div class="tab-panel" data-tab="1">
    <dl class="kv"><dt>Primary admin</dt><dd>${safeHtml(s.admin)}</dd><dt>Username</dt><dd><span class="code">${safeHtml(schoolAdminCodeHandle(senderCode))}_admin</span></dd><dt>Email</dt><dd>${safeHtml(s.email)}</dd></dl>
    <p style="font-size:12px;color:var(--muted);margin:14px 0 10px">Admins manage their own school's config. You can reset their password or add a sub-admin.</p>
    <div style="display:flex;gap:9px"><button class="btn btn-ghost btn-sm" data-qa-onclick="toast('Reset link sent')">Reset password</button><button class="btn btn-ghost btn-sm" data-qa-onclick="toast('Add sub-admin (prototype)')">Add sub-admin</button></div>
  </div>
  <div class="tab-panel" data-tab="2"><div class="tbl-wrap"><table><thead><tr><th>Student</th><th>Index</th><th>Programme</th><th>Status</th></tr></thead><tbody>
    ${schoolStudents.map(st=>`<tr><td>${safeHtml(st.name)}</td><td class="mono">${safeHtml(st.index)}</td><td>${safeHtml(st.programme)}</td><td><span class="pill ${st.status}">${safeHtml(st.status)}</span></td></tr>`).join('')}
  </tbody></table></div><p style="font-size:12px;color:var(--muted);margin-top:10px">Showing 8 of ${fmt(s.students)} students.</p></div>
  <div class="tab-panel" data-tab="3"><div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Student</th><th>Amount</th><th>Status</th></tr></thead><tbody>
    ${schoolPays.map(p=>`<tr><td class="mono">${safeHtml(p.date)}</td><td>${safeHtml(p.student)}</td><td class="mono">${safeHtml(money(p.amount))}</td><td><span class="pill ${p.status}">${safeHtml(p.status)}</span></td></tr>`).join('')||emptyRow(4,'No payments yet.')}
  </tbody></table></div></div>
  <div class="tab-panel" data-tab="4">
    <dl class="kv"><dt>Current plan</dt><dd>${safeHtml(s.plan)}</dd><dt>Expires</dt><dd>${safeHtml(s.expiry)}</dd></dl>
    <div class="grid-2" style="margin-top:16px"><div class="field"><label>Change plan</label><select><option ${s.plan==='Basic'?'selected':''}>Basic</option><option ${s.plan==='Standard'?'selected':''}>Standard</option><option ${s.plan==='Premium'?'selected':''}>Premium</option></select></div><div class="field"><label>Extend expiry</label><input type="date" value="${escapeAttr(s.expiry)}"></div></div>
    <button class="btn btn-primary btn-sm" style="margin-top:14px" data-qa-onclick="toast('Subscription updated')">Update subscription</button>
  </div>
  <div class="tab-panel" data-tab="5">
    <div style="border:1px solid var(--danger-soft);background:var(--danger-soft);border-radius:10px;padding:16px">
      <h3 style="font-family:'Space Grotesk';font-size:14px;color:var(--danger);margin-bottom:6px">Danger zone</h3>
      <p style="font-size:12.5px;color:var(--ink-soft);margin-bottom:14px">Suspending blocks all logins for this school. Deletion removes the school and all its scoped data - this cannot be undone.</p>
      <div style="display:flex;gap:9px"><button class="btn btn-danger btn-sm" data-qa-onclick="suspendSchool(${id})">${s.status==='suspended'?'Reactivate':'Suspend'} school</button><button class="btn btn-danger btn-sm" data-qa-onclick="deleteSchool(${id})">Delete school</button></div>
    </div>
  </div>`;
  $('overlay').classList.add('show');
}
function schoolTab(i){
  document.querySelectorAll('#schoolTabs .tab').forEach((t,x)=>t.classList.toggle('active',x===i));
  document.querySelectorAll('#modal .tab-panel').forEach(p=>p.classList.toggle('active',p.dataset.tab==i));
}
function suspendSchool(id){const s=sById(id);s.status=s.status==='suspended'?'active':'suspended';closeModal();renderSchools();renderStats();renderDashTable();toast(`${s.name} ${s.status==='suspended'?'suspended':'reactivated'}`);}
function deleteSchool(id){const s=sById(id);if(!confirm(`Delete ${s.name}? This removes all its data.`))return;schools=schools.filter(x=>x.id!==id);students=students.filter(x=>x.schoolId!==id);closeModal();renderAll();toast(`${s.name} deleted`);}

/* ============ ADD SCHOOL / ADMIN ============ */
function editSchool(id){
  const s=sById(id); if(!s)return;
  const plan=(s.plan||'Standard'); const opt=(v)=>plan.toLowerCase()===v.toLowerCase()?'selected':'';
  const m=$('modal');m.className='modal';
  m.innerHTML=`
  <div class="modal-head"><div><h2>Edit school</h2><p>Update ${safeHtml(s.name)}'s information</p></div><button class="modal-x" data-qa-onclick="closeModal()">&times;</button></div>
  <div class="modal-body"><div class="form-grid">
    <fieldset><legend>School information</legend>
      <div class="grid-2"><div class="field"><label>School Code / SMS Sender ID</label><input id="e_school_code" value="${escapeAttr(schoolSenderCode(s)||'')}" maxlength="11" placeholder="e.g. ASEC"></div><div class="field"><label>Portal subdomain</label><input id="e_subdomain" value="${escapeAttr(s.subdomain||'')}" maxlength="63" placeholder="e.g. asec"><span class="hint">${escapeHtml((s.subdomain||'school')+'.quickadmissiongh.com')}</span></div></div>
      <div class="field"><label>Service charge (GHS)</label><input id="e_charge" type="number" step="0.5" value="${escapeAttr((s.charge!=null?s.charge:30))}"></div>
      <div class="field"><label>Online token payment</label><select id="e_online"><option value="yes" ${s.acceptOnlinePayment!==false?'selected':''}>Enabled</option><option value="no" ${s.acceptOnlinePayment===false?'selected':''}>Disabled</option></select></div>
      <div class="field"><label>Full school name</label><input id="e_name" value="${escapeAttr(s.name||'')}"></div>
      <div class="grid-2"><div class="field"><label>Phone</label><input id="e_phone" value="${escapeAttr(s.phone||'')}"></div><div class="field"><label>Email</label><input id="e_email" type="email" value="${escapeAttr(s.email||'')}"></div></div>
    </fieldset>
    <fieldset><legend>Subscription & status</legend>
      <div class="grid-2"><div class="field"><label>Plan</label><select id="e_plan"><option ${opt('Basic')}>Basic</option><option ${opt('Standard')}>Standard</option><option ${opt('Premium')}>Premium</option></select></div><div class="field"><label>Expiry</label><input id="e_expiry" type="date" value="${s.expiry||''}"></div></div>
      <div class="grid-2"><div class="field"><label>Admission</label><select id="e_admission"><option ${s.admission==='CLOSED'?'selected':''}>CLOSED</option><option ${s.admission==='OPENED'?'selected':''}>OPENED</option></select></div><div class="field"><label>Status</label><select id="e_status"><option ${s.status==='active'?'selected':''} value="active">active</option><option ${s.status==='suspended'?'selected':''} value="suspended">suspended</option></select></div></div>
    </fieldset>
  </div></div>
  <div class="modal-foot"><button class="btn btn-ghost" data-qa-onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="e_btn" data-qa-onclick="saveSchoolEdit(${id})">Save changes</button></div>`;
  $('overlay').classList.add('show');
  setTimeout(()=>{bindSchoolCodeInput('e_school_code');bindSchoolSubdomainInput('e_subdomain');},0);
}
function openAddSchool(){
  const m=$('modal');m.className='modal';
  m.innerHTML=`
  <div class="modal-head"><div><h2>Add new school</h2><p>Creates the tenant and its primary admin account</p></div><button class="modal-x" data-qa-onclick="closeModal()">&times;</button></div>
  <div class="modal-body"><div class="form-grid">
    <fieldset><legend>School information</legend>
      <div class="grid-2"><div class="field"><label>School Code / SMS Sender ID</label><input id="f_code" placeholder="e.g. ASEC" maxlength="11"></div><div class="field"><label>Portal subdomain</label><input id="f_subdomain" placeholder="e.g. asec" maxlength="63"><span class="hint">School's address: subdomain.quickadmissiongh.com</span></div></div>
      <div class="field"><label>Service charge (GHS)</label><input id="f_charge" type="number" value="30" step="0.5"></div>
      <div class="field"><label>Full school name</label><input id="f_name" placeholder="e.g. Asuom Senior High School"></div>
      <div class="grid-2"><div class="field"><label>Phone</label><input id="f_phone" placeholder="0244..."></div><div class="field"><label>Email</label><input id="f_email" type="email" placeholder="school@..."></div></div>
    </fieldset>
    <fieldset><legend>Primary admin account</legend>
      <div class="grid-2"><div class="field"><label>Admin full name</label><input id="f_admin" placeholder="e.g. Isaac Addo"></div><div class="field"><label>Admin email</label><input id="f_aemail" type="email" placeholder="admin@..."></div></div>
      <div class="field"><label>Temporary password <span class="hint">â€” at least 8 characters</span></label><input id="f_apass" type="password" minlength="8" placeholder="Create a temporary password"></div>
      <div class="field"><label>Username <span class="hint">- auto-derived from code</span></label><input id="f_uname" placeholder="auto" disabled></div>
    </fieldset>
    <fieldset><legend>Subscription & defaults</legend>
      <div class="grid-2"><div class="field"><label>Plan</label><select id="f_plan"><option>Basic</option><option selected>Standard</option><option>Premium</option></select></div><div class="field"><label>Expiry</label><input id="f_expiry" type="date" value="2026-12-31"></div></div>
      <div class="grid-2"><div class="field"><label>Admission status</label><select id="f_admission"><option>CLOSED</option><option>OPENED</option></select></div><div class="field"><label>Online token payment</label><select id="f_online"><option value="yes">Enabled</option><option value="no">Disabled</option></select></div></div>
    </fieldset>
  </div></div>
  <div class="modal-foot"><button class="btn btn-ghost" data-qa-onclick="closeModal()">Cancel</button><button class="btn btn-primary" data-qa-onclick="createSchool()">Create school</button></div>`;
  $('overlay').classList.add('show');
  setTimeout(()=>{bindSchoolCodeInput('f_code','f_uname');bindSchoolSubdomainInput('f_subdomain','f_code');},0);
}
function createSchool(){
  const code=$('f_code').value.trim().toUpperCase(),name=$('f_name').value.trim();
  if(!code||!name){toast('School code and name are required');return;}
  const words=name.replace(/[^A-Za-z ]/g,'').split(' ').filter(Boolean);
  const short=(words[0]?.[0]||'S')+(words[1]?.[0]||words[0]?.[1]||'C');
  schools.unshift({id:nextSchoolId++,code,name,short:short.toUpperCase(),admin:$('f_admin').value.trim()||'-',plan:$('f_plan').value,students:0,admission:$('f_admission').value,status:'active',charge:parseFloat($('f_charge').value)||30,expiry:$('f_expiry').value,email:$('f_email').value,phone:$('f_phone').value,color:Math.floor(Math.random()*crestColors.length)});
  activity.unshift({type:'sys',school:schools[0].id,text:'New school created',time:'just now'});
  closeModal();renderAll();go('schools');
  toast(`${name} created - admin password sent to ${$('f_aemail').value||'admin'}`);
}
function openCreateAdmin(){
  const m=$('modal');m.className='modal';
  m.innerHTML=`<div class="modal-head"><div><h2>Create school admin</h2><p>Creates a real login and links it to the school</p></div><button class="modal-x" data-qa-onclick="closeModal()">&times;</button></div>
  <div class="modal-body"><div class="form-grid"><fieldset><legend>Admin details</legend>
    <div class="field"><label>School</label><select id="a_school">${schools.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select></div>
    <div class="grid-2"><div class="field"><label>Full name</label><input id="a_name" placeholder="Full name"></div><div class="field"><label>Email</label><input id="a_email" type="email" placeholder="admin@..."></div></div>
    <div class="field"><label>Temporary password</label><div style="display:flex;gap:8px"><input id="a_pass" type="text" placeholder="At least 8 characters" style="flex:1"><button class="btn btn-ghost btn-sm" type="button" data-qa-onclick="genPass()">Generate</button></div><div style="font-size:11.5px;color:var(--muted);margin-top:5px">Share this with the admin; they can change it after signing in.</div></div>
  </fieldset></div></div>
  <div class="modal-foot"><button class="btn btn-ghost" data-qa-onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="a_btn" data-qa-onclick="createAdmin()">Create admin</button></div>`;
  $('overlay').classList.add('show');
}
function genPass(){const el=$('a_pass');if(el)el.value=genStr(12);}
function closeModal(){$('overlay').classList.remove('show');}
$('overlay').addEventListener('click',e=>{if(e.target===$('overlay'))closeModal();});

/* ============ NAV ============ */
const titles={dashboard:['Dashboard','System-wide overview across all schools'],schools:['School Management','Create, configure and oversee every tenant'],admins:['School Admins','Manage admin accounts and access'],students:['All Students','Cross-school student directory'],finance:['Financial Reports','Revenue and transactions across schools'],sms:['SMS Management','Broadcast messaging and credit pool'],settings:['System Settings','Global configuration and defaults']};
function toggleNavGroup(lbl){
  const g=lbl.closest('.nav-group'); if(!g)return;
  const willOpen=!g.classList.contains('open');
  document.querySelectorAll('#nav .nav-group').forEach(x=>x.classList.remove('open'));
  if(willOpen) g.classList.add('open');
}
function go(view){
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===view));
  document.querySelectorAll('#nav .nav-group').forEach(g=>g.classList.remove('open'));
  { const cur=[...document.querySelectorAll('#nav [data-view]')].find(n=>n.dataset.view===view); const grp=cur&&cur.closest('.nav-group'); if(grp)grp.classList.add('open'); }
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+view));
  $('pagetitle').firstChild.textContent=titles[view][0];$('pagesub').textContent=titles[view][1];
  if(view==='dashboard'){renderStats();renderDashTable();renderFeed();buildCharts();}
  if(view==='schools')renderSchools();
  if(view==='admins')renderAdmins();
  if(view==='students')renderStudents();
  if(view==='finance')renderFinance();
  if(view==='sms')renderSms();
  closeSidebar();resetAdminScroll();
}
$('nav').addEventListener('click',e=>{const b=e.target.closest('.nav-item');if(b)go(b.dataset.view);});
// Phone/contact fields: digits only, max 10
document.addEventListener('input',function(e){
  const el=e.target;
  if(el&&el.tagName==='INPUT'&&(/sms|phone|contact/i.test(el.id)||el.type==='tel'||el.getAttribute('inputmode')==='tel')){
    const v=(el.value||'').replace(/\D/g,'').slice(0,10);
    if(v!==el.value) el.value=v;
  }
});

/* ============ MOBILE SIDEBAR ============ */
function resetAdminScroll(){
  window.scrollTo(0,0);
  document.documentElement.scrollTop=0;
  document.body.scrollTop=0;
  const content=document.querySelector('.content'); if(content) content.scrollTop=0;
}
function closeSidebar(){
  $('sidebar').classList.remove('open');$('backdrop').classList.remove('show');
  document.body.classList.remove('sidebar-open');
  const hamburger=$('hamburger'); if(hamburger) hamburger.setAttribute('aria-expanded','false');
}
function isDesktopSidebar(){return window.matchMedia('(min-width: 1025px)').matches;}
function toggleSidebar(){
  const app=document.querySelector('.app');
  if(!app) return;
  if(isDesktopSidebar()){
    app.classList.toggle('sidebar-hidden');
    app.classList.remove('sidebar-collapsed');
    $('hamburger').setAttribute('aria-expanded',String(!app.classList.contains('sidebar-hidden')));
    return;
  }
  $('sidebar').classList.toggle('open');
  $('backdrop').classList.toggle('show',$('sidebar').classList.contains('open'));
  document.body.classList.toggle('sidebar-open',$('sidebar').classList.contains('open'));
  $('hamburger').setAttribute('aria-expanded',String($('sidebar').classList.contains('open')));
}
$('hamburger').addEventListener('click',toggleSidebar);
$('backdrop').addEventListener('click',closeSidebar);
window.addEventListener('resize',function(){
  if(isDesktopSidebar()){
    closeSidebar(false);
  }else{
    const app=document.querySelector('.app');
    if(app){app.classList.remove('sidebar-collapsed');app.classList.remove('sidebar-hidden');}
  }
});

/* ============ CLOCK + LIVE ============ */
function tick(){const d=new Date();$('clock').textContent=d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})+' - '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
tick();setInterval(tick,1000);

/* ============ INIT ============ */
function fillSchoolSelects(){
  $('studentSchoolFilter').innerHTML='<option value="all">All schools</option>'+schools.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  $('smsTarget').innerHTML='<option value="all">All schools (platform-wide)</option>'+schools.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
}
function renderAll(){renderStats();renderDashTable();renderFeed();renderSchools();fillSchoolSelects();}
