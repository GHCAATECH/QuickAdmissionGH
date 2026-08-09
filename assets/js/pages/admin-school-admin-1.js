/* ===== DATA ===== */
let admissionOpen=true;
let admissionStatusSaving=false;
let smsBalance=500;
const DEFAULT_SUBMISSION_SMS_TEMPLATE='Congratulations {student_name}. Your admission application has been successfully submitted to {school_name}.';
let SB_SMS_SETTINGS={submission_message:DEFAULT_SUBMISSION_SMS_TEMPLATE,sms_enabled:true};
let programmes=[
  {id:1,code:'SCI',name:'General Science',subjects:'English, Maths, Physics, Chemistry, Biology',cap:120,enr:95},
  {id:2,code:'ART',name:'General Arts',subjects:'English, Maths, Literature, History, CRS, Economics',cap:150,enr:112},
  {id:3,code:'BUS',name:'Business',subjects:'English, Maths, Accounting, Business Mgmt, Economics',cap:100,enr:78},
  {id:4,code:'VOC',name:'Visual Arts',subjects:'English, Maths, Graphic Design, Sculpture, Textiles',cap:80,enr:41},
];
let houses=[
  {id:1,name:'Lumumba',color:'#B23A3A',motto:'Unity and Strength',cap:100,occ:67},
  {id:2,name:'Nkrumah',color:'#D2941A',motto:'Freedom and Justice',cap:100,occ:72},
  {id:3,name:'Mandela',color:'#2E7D4F',motto:'Peace and Reconciliation',cap:100,occ:54},
  {id:4,name:'Tubman',color:'#3066A3',motto:'Courage and Perseverance',cap:100,occ:48},
];
let classes=[
  {id:1,name:'Form 1A',code:'1A',cap:50,occ:48},
  {id:2,name:'Form 1B',code:'1B',cap:50,occ:45},
  {id:3,name:'Form 1C',code:'1C',cap:50,occ:50},
  {id:4,name:'Form 1D',code:'1D',cap:50,occ:38},
];
let docLines=[
  'Printed copy of admission letter, personal record form and acceptance form.',
  'Fully filled placement forms.',
  'A copy of your BECE results slip.',
  'Photocopy of birth certificate / baptismal certificate.',
  'All documents must be submitted during reporting, filled, and put in a flat file.',
];
const fn=['Kofi','Ama','Yaw','Akua','Kwame','Esi','Kojo','Adwoa','Kwabena','Abena','Fiifi','Efua','Nana','Yaa'];
const ln=['Mensah','Owusu','Asante','Boateng','Addo','Sarpong','Agyei','Darko','Appiah','Ofori'];
const stArr=['pending','approved','enrolled','rejected'];
let students=[],placement=[];
let placementTotalCount=0;
const PLACEMENT_PAGE_SIZE=50;
let PLACEMENT_STATE={loaded:false,loading:false,page:1,pageSize:PLACEMENT_PAGE_SIZE,total:0,totalPages:1};
(function seed(){
  let idx=100000000026;
  for(let i=0;i<46;i++){
    const p=programmes[Math.floor(Math.random()*programmes.length)];
    const gender=Math.random()<.52?'M':'F';
    const name=fn[Math.floor(Math.random()*fn.length)]+' '+ln[Math.floor(Math.random()*ln.length)];
    const stt=stArr[Math.floor(Math.random()*4)];
    const index=(idx+=1+Math.floor(Math.random()*9))+'';
    students.push({id:i+1,index,name,gender,progId:p.id,
      classId:stt==='pending'?null:classes[Math.floor(Math.random()*4)].id,
      houseId:stt==='pending'?null:houses[Math.floor(Math.random()*4)].id,
      status:stt,adm:stt==='pending'?'—':p.code+'/2025/'+String(i+1).padStart(3,'0'),
      reg:randDate()});
    placement.push({index,name,prog:p.name,code:'ENR'+(10000+i),loggedIn:Math.random()<.6});
  }
})();
function randDate(){const d=new Date();d.setDate(d.getDate()-Math.floor(Math.random()*26));return d.toISOString().slice(0,10);}
let payments=[];
let financePaymentsLoadError='';
let FINANCE_PAYMENTS_STATE={loaded:false,loading:false,total:0};
(function(){const m=['Paystack','Hubtel','Flutterwave','Bank'];const s=['completed','completed','completed','pending','failed'];
  students.slice(0,30).forEach((st,i)=>payments.push({date:randDate(),name:st.name,index:st.index,amount:30,method:m[i%4],status:s[i%5],txn:'TXN'+(100000+i*37)}));})();
let smsHistory=[
  {date:'2026-06-08',group:'Approved',recip:18,msg:'Your admission is approved. Report on 18 Oct 2025.',status:'pending'},
  {date:'2026-06-06',group:'All',recip:46,msg:'Complete your application before 15 June.',status:'pending'},
];
let SMS_HISTORY_STATE={loaded:false,loading:false};
let smsDeliveredIndexes=new Set();
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
    <linearGradient id="abhTopFace" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#34d399"/>
      <stop offset="1" stop-color="#10B981"/>
    </linearGradient>
    <linearGradient id="abhRightFace" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0d9466"/>
      <stop offset="1" stop-color="#047857"/>
    </linearGradient>
    <linearGradient id="abhBottomFace" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#065f46"/>
      <stop offset="1" stop-color="#0F172A"/>
    </linearGradient>
  </defs>
  <ellipse cx="82" cy="148" rx="66" ry="11" fill="#0F172A" opacity="0.18"/>
  <polygon points="22,116 130,116 148,134 40,134" fill="url(#abhBottomFace)"/>
  <polygon points="130,18 130,116 148,134 148,36" fill="url(#abhRightFace)"/>
  <rect x="20" y="14" width="110" height="104" rx="26" fill="url(#abhTopFace)"/>
  <rect x="20" y="14" width="110" height="104" rx="26" fill="none" stroke="#ffffff" stroke-opacity="0.4" stroke-width="1.5"/>
  <g stroke="#ffffff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M75 38 L52 100"/>
    <path d="M75 38 L98 100"/>
  </g>
  <rect x="60" y="80" width="30" height="11" rx="5" fill="#ffffff"/>
  <circle cx="75" cy="38" r="7" fill="#ffffff"/>
</svg>`;
let activityLog=[
  {time:'Today 09:14',action:'Approved 6 students',by:'Isaac Addo'},
  {time:'Today 08:52',action:'Imported 46 placement records',by:'Isaac Addo'},
  {time:'Yesterday 16:30',action:'Updated service charge to GHS 30',by:'Isaac Addo'},
  {time:'Yesterday 14:05',action:'Sent reporting reminder to 12 students',by:'Isaac Addo'},
];
let ACTIVITY_LOG_STATE={loaded:false,loading:false};
let selected=new Set();
let financePayQuery='';
let financePayPage=1;
const FINANCE_PAY_PAGE_SIZE=25;

/* ===== HELPERS ===== */
const $=id=>document.getElementById(id);
const progById=id=>programmes.find(p=>p.id===id)||{code:'—',name:'—'};
const houseById=id=>houses.find(h=>h.id===id);
const classById=id=>classes.find(c=>c.id===id);
const fmt=n=>n.toLocaleString('en-US');
const money=n=>'GHS '+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const moneyBare=n=>Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const round2=n=>Math.round((Number(n)||0)*100)/100;
function toast(m){$('toastMsg').textContent=m;const t=$('toast');t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2600);}
function studentSummaryData(){
  return window.SB_STUDENT_SUMMARY&&typeof window.SB_STUDENT_SUMMARY==='object'
    ? window.SB_STUDENT_SUMMARY
    : {};
}
function summaryNumber(key,fallback){
  const n=Number(studentSummaryData()[key]);
  return Number.isFinite(n)?Math.max(n,0):fallback;
}
const pendingCount=()=>summaryNumber('pending',students.filter(s=>s.status==='pending').length);
const totalRevenue=()=>payments.filter(p=>p.status==='completed').reduce((a,p)=>a+p.amount,0);
function cleanSmsText(v){ return v==null?'':String(v).trim(); }
const HTML_ESCAPE_MAP={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'};
function escapeHtml(v){ return String(v==null?'':v).replace(/[&<>"'`]/g,function(ch){ return HTML_ESCAPE_MAP[ch]; }); }
function escapeAttr(v){ return escapeHtml(v).replace(/\r?\n/g,'&#10;'); }
function safeHtml(v,fallback){ const text=cleanSmsText(v); return text?escapeHtml(text):(fallback||'&mdash;'); }
function studentProgrammeName(s){
  const byId=cleanSmsText((progById(s&&s.progId)||{}).name);
  if(byId&&/[A-Za-z0-9]/.test(byId)&&byId!=='-') return byId;
  return cleanSmsText((s&&s.prog)||(s&&s.programme)||(s&&s.programme_name)||((s&&s.rec)||{}).programme)||'-';
}
function studentProgrammeIdByName(name){
  const needle=programmeMatchText(name);
  if(!needle) return null;
  const hit=programmes.find(function(p){
    return programmeMatchText(p.name)===needle || programmeMatchText(p.code)===needle;
  });
  return hit?hit.id:null;
}
function programmeMatchText(value){
  return cleanSmsText(value).toLowerCase().replace(/[^a-z0-9]+/g,'');
}
function effectiveStudentProgrammeId(student){
  return (student&&student.progId)||studentProgrammeIdByName(studentProgrammeName(student));
}
function sanitizeExcelExtension(value){
  const ext=String(value||'').trim().toLowerCase();
  return ext==='xls'?'xls':'xlsx';
}
function excelPreferenceKey(){
  const schoolId=(typeof SB_SCHOOL!=='undefined'&&SB_SCHOOL&&SB_SCHOOL.id)||'global';
  return 'qag_excel_ext::'+schoolId;
}
function preferredExcelExtension(){
  try{
    return sanitizeExcelExtension(window.localStorage.getItem(excelPreferenceKey())||'');
  }catch(e){
    return 'xlsx';
  }
}
function rememberExcelExtension(fileName){
  const match=String(fileName||'').toLowerCase().match(/\.([^.]+)$/);
  if(!match) return preferredExcelExtension();
  const ext=sanitizeExcelExtension(match[1]);
  try{ window.localStorage.setItem(excelPreferenceKey(),ext); }catch(e){}
  return ext;
}
function excelFileName(baseName){
  return String(baseName||'download').replace(/\.[^.]+$/,'')+'.'+preferredExcelExtension();
}
function sanitizeSheetName(name){
  const clean=String(name||'Sheet').replace(/[:\\/?*\[\]]/g,' ').trim();
  return (clean||'Sheet').slice(0,31);
}
function exportSchoolName(){ return (SB_SCHOOL&&SB_SCHOOL.name)||'School Name'; }
function exportAdmissionYear(){
  return (SB_CFG&&SB_CFG.admission_year)||((SB_CFG&&SB_CFG.academic_year)||'');
}
function exportHeadLabel(){
  var title=(SB_SCHOOL&&SB_SCHOOL.headmaster_title)||'Headmaster';
  var name=(SB_SCHOOL&&SB_SCHOOL.headmaster_name)||'';
  return title+': '+(name||'-');
}
function excelTextValue(value){
  return value==null?'':String(value);
}
function csvBlobFromRows(rows){
  var csv=rows.map(function(row){
    return row.map(function(cell){
      return '"'+excelTextValue(cell).replace(/"/g,'""')+'"';
    }).join(',');
  }).join('\r\n');
  return new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
}
function excelStyle(fillColor,fontColor,fontSize,bold,align){
  var style={};
  if(fillColor) style.fill={patternType:'solid',fgColor:{rgb:fillColor.replace('#','').toUpperCase()}};
  if(fontColor||fontSize||bold){
    style.font={};
    if(fontColor) style.font.color={rgb:fontColor.replace('#','').toUpperCase()};
    if(fontSize) style.font.sz=fontSize;
    if(bold) style.font.bold=true;
  }
  style.alignment={vertical:'center',horizontal:align||'left',wrapText:true};
  style.border={
    top:{style:'thin',color:{rgb:'1F2937'}},
    bottom:{style:'thin',color:{rgb:'1F2937'}},
    left:{style:'thin',color:{rgb:'1F2937'}},
    right:{style:'thin',color:{rgb:'1F2937'}}
  };
  return style;
}
function applyWorksheetStyle(ws,range,style){
  if(!range||!style||typeof XLSX==='undefined') return;
  for(var row=range.s.r; row<=range.e.r; row++){
    for(var col=range.s.c; col<=range.e.c; col++){
      var ref=XLSX.utils.encode_cell({r:row,c:col});
      if(!ws[ref]) ws[ref]={t:'s',v:''};
      ws[ref].s=style;
    }
  }
}
function buildStyledWorkbook(baseName,sheetName,headers,rows,contextTitle,totalStudents){
  if(typeof XLSX==='undefined') return null;
  var schoolName=exportSchoolName(), admissionYear=exportAdmissionYear(), footerHead=exportHeadLabel();
  var title=contextTitle||sheetName||baseName||'Export';
  var total=(typeof totalStudents==='number'&&!isNaN(totalStudents))?totalStudents:rows.length;
  var span=Math.max((headers&&headers.length)||1,1);
  var aoa=[
    [schoolName+' - '+title],
    [admissionYear?('Admission Year: '+admissionYear):'Admission Year: -'],
    headers.map(excelTextValue)
  ].concat(rows.map(function(row){ return row.map(excelTextValue); }),[
    [],
    [footerHead],
    ['Total Students: '+total]
  ]);
  var ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges']=[
    {s:{r:0,c:0},e:{r:0,c:span-1}},
    {s:{r:1,c:0},e:{r:1,c:span-1}},
    {s:{r:4+rows.length,c:0},e:{r:4+rows.length,c:span-1}},
    {s:{r:5+rows.length,c:0},e:{r:5+rows.length,c:span-1}}
  ];
  ws['!cols']=headers.map(function(h,idx){
    var width=excelTextValue(h).length+6;
    rows.forEach(function(row){ width=Math.max(width,excelTextValue(row[idx]).length+3); });
    return {wch:Math.min(Math.max(width,14),32)};
  });
  var green='16A34A', white='FFFFFF';
  applyWorksheetStyle(ws,{s:{r:0,c:0},e:{r:0,c:span-1}},excelStyle(green,white,16,true,'left'));
  applyWorksheetStyle(ws,{s:{r:1,c:0},e:{r:1,c:span-1}},excelStyle(green,white,12,true,'left'));
  applyWorksheetStyle(ws,{s:{r:2,c:0},e:{r:2,c:span-1}},excelStyle(green,white,11,true,'center'));
  applyWorksheetStyle(ws,{s:{r:3,c:0},e:{r:2+rows.length,c:span-1}},excelStyle(null,null,null,false,'left'));
  applyWorksheetStyle(ws,{s:{r:4+rows.length,c:0},e:{r:5+rows.length,c:span-1}},excelStyle(null,'374151',11,false,'left'));
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,sanitizeSheetName(sheetName||title));
  return wb;
}
function exportSheetRows(headers,rows,contextTitle,totalStudents){
  var schoolName=exportSchoolName();
  var admissionYear=exportAdmissionYear();
  var studentTotal=(typeof totalStudents==='number'&&!isNaN(totalStudents))?totalStudents:rows.length;
  var title=contextTitle||'Export';
  return [
    [schoolName],
    [admissionYear?('Admission Year: '+admissionYear):'Admission Year: -'],
    [title],
    []
  ].concat([headers],rows,[[],[exportHeadLabel()],[`Total Students: ${studentTotal}`]]);
}
function excelCellHtml(value,isHeader){
  var text=safeHtml(value==null?'':String(value),'');
  if(isHeader){
    return '<th bgcolor="#16a34a" style="border:1px solid #1f2937;padding:7px 9px;background-color:#16a34a;background:#16a34a;background-image:linear-gradient(135deg,#14532d 0%,#16a34a 100%);color:#ffffff;text-align:left;font-weight:700;mso-pattern:auto solid #16a34a">'+text+'</th>';
  }
  return '<td style="border:1px solid #1f2937;padding:7px 9px">'+text+'</td>';
}
function buildExcelTableHtml(headers,rows){
  return '<table border="1" style="border-collapse:collapse;width:100%"><thead><tr>'
    +headers.map(function(h){ return excelCellHtml(h,true); }).join('')
    +'</tr></thead><tbody>'
    +rows.map(function(r){ return '<tr>'+r.map(function(c){ return excelCellHtml(c,false); }).join('')+'</tr>'; }).join('')
    +'</tbody></table>';
}
function buildExcelDocumentHtml(title,headers,rows,totalStudents){
  var schoolName=exportSchoolName(), admissionYear=exportAdmissionYear(), footerHead=exportHeadLabel();
  var total=(typeof totalStudents==='number'&&!isNaN(totalStudents))?totalStudents:rows.length;
  var span=Math.max((headers&&headers.length)||1,1);
  var head='<table border="0" style="border-collapse:collapse;width:100%;margin-bottom:14px">'
    +'<tr><td colspan="'+span+'" bgcolor="#16a34a" style="border:1px solid #14532d;padding:12px 14px;background-color:#16a34a;background:#16a34a;background-image:linear-gradient(135deg,#14532d 0%,#16a34a 100%);color:#ffffff;font-size:18px;font-weight:700;text-align:center;mso-pattern:auto solid #16a34a">'+safeHtml(schoolName)+' - '+safeHtml(title)+'</td></tr>'
    +'<tr><td colspan="'+span+'" bgcolor="#16a34a" style="border:1px solid #14532d;border-top:none;padding:9px 14px;background-color:#16a34a;background:#16a34a;background-image:linear-gradient(135deg,#14532d 0%,#16a34a 100%);color:#ffffff;font-size:12px;font-weight:600;text-align:center;mso-pattern:auto solid #16a34a">'+safeHtml(admissionYear?('Admission Year: '+admissionYear):'Admission Year: -')+'</td></tr>'
    +'</table>';
  var foot='<div style="margin-top:14px;font-size:12px;color:#374151;display:flex;justify-content:space-between;gap:18px">'
    +'<div>'+safeHtml(footerHead)+'</div><div>Total Students: '+total+'</div></div>';
  return '\ufeff<html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;padding:24px">'
    +head+buildExcelTableHtml(headers,rows)+foot+'</body></html>';
}
function downloadExcelRows(baseName,sheetName,headers,rows,contextTitle,totalStudents){
  var wb=buildStyledWorkbook(baseName,sheetName,headers,rows,contextTitle,totalStudents);
  if(!wb) return false;
  XLSX.writeFile(wb,String(baseName||'download').replace(/\.[^.]+$/,'')+'.xlsx',{bookType:'xlsx',cellStyles:true});
  if(contextTitle) toast('Downloaded '+rows.length+' rows (Excel)');
  return true;
}
const PLACEMENT_HEADER_ALIASES={
  indexnumber:'index_number',
  becenumber:'index_number',
  beceindex:'index_number',
  indexno:'index_number',
  studentname:'student_name',
  fullname:'student_name',
  names:'student_name',
  othernames:'other_names',
  gender:'gender',
  residentialstatus:'residential_status',
  residential:'residential_status',
  boardingstatus:'residential_status',
  programme:'programme',
  program:'programme',
  aggregate:'aggregate',
  dob:'dob',
  dateofbirth:'dob',
  smscontact:'sms_contact',
  smsnumber:'sms_contact',
  phonenumber:'sms_contact',
  contactnumber:'sms_contact',
  phone:'sms_contact',
  contact:'sms_contact',
  jhsattended:'jhs_attended',
  jhstype:'jhs_type',
  enrolmentcode:'enrolment_code'
};
function canonicalPlacementHeader(value){
  const compact=String(value||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  return PLACEMENT_HEADER_ALIASES[compact]||normHdr(value);
}
function normalizePlacementFieldValue(key,value){
  const text=cleanSmsText(value);
  if(!text) return '';
  if(key==='gender'){
    const up=text.toUpperCase();
    if(up==='M'||up==='MALE') return 'Male';
    if(up==='F'||up==='FEMALE') return 'Female';
    return up;
  }
  if(key==='residential_status'){
    const up=text.toUpperCase();
    if(up==='D'||up==='DAY') return 'Day';
    if(up==='B'||up==='BOARDING') return 'Boarding';
    return up;
  }
  if(['student_name','other_names','programme','jhs_attended','jhs_type','enrolment_code'].includes(key)) return text.toUpperCase();
  return text;
}
function preferredStudentSms(rawStudent,placementRow){
  const rec=(rawStudent&&rawStudent.records)||{};
  return cleanSmsText(rec.sms_contact||rawStudent.parent_phone||rawStudent.sms_contact||(placementRow&&placementRow.sms_contact)||'');
}
function hasSubmittedPersonalRecord(s){
  return !!(s&&(
    s.submitted ||
    s.submitted_at ||
    (s.personalDone&&s.programmeDone&&s.undertakingDone) ||
    (s.personal_done&&s.programme_done&&s.undertaking_done) ||
    s.submittedAt
  ));
}
function submittedStudents(){
  const hasCompletionFlag=students.some(function(s){
    return ['submitted','personalDone','programmeDone','undertakingDone','submittedAt'].some(function(k){ return typeof s[k]!=='undefined'; });
  });
  return hasCompletionFlag ? students.filter(hasSubmittedPersonalRecord) : students.slice();
}
function settledStudentCount(raw,maxCount){
  const clean=Math.max(parseInt(raw,10)||0,0);
  return typeof maxCount==='number' ? Math.min(clean,Math.max(maxCount,0)) : clean;
}
function completedFinancePaymentCount(source){
  const seen=new Set();
  (source||[]).forEach(function(payment){
    const status=String(payment&&payment.status||'').trim().toLowerCase();
    if(!['completed','success','successful','paid'].includes(status)) return;
    const index=cleanSmsText(payment&&payment.index);
    const reference=cleanSmsText(payment&&payment.txn);
    const key=(payment&&payment.studentId)
      ? 'student:'+String(payment.studentId)
      : (index&&index!=='—'&&index!=='-')
        ? 'index:'+index
        : reference
          ? 'reference:'+reference
          : '';
    if(key) seen.add(key);
  });
  return seen.size;
}
function schoolFinanceSnapshot(){
  const registered=submittedStudentTotal();
  const completedStudents=completedFinancePaymentCount(payments);
  const total=Math.max(placementTotalCount||placement.length,registered,completedStudents);
  const paidStudents=settledStudentCount(SB_CFG&&SB_CFG.finance_settled_students,completedStudents);
  const dueStudents=Math.max(completedStudents-paidStudents,0);
  const itGross=round2(dueStudents*FINANCE_IT_RATE);
  const itCharge=round2(itGross*FINANCE_CHARGE_RATE);
  const headGross=round2(dueStudents*FINANCE_HEAD_RATE);
  const headCharge=round2(headGross*FINANCE_CHARGE_RATE);
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
    totalGross:round2(dueStudents*FINANCE_TOTAL_RATE),
    paidAmount:round2(paidStudents*FINANCE_TOTAL_RATE),
    hasHistory:paidStudents>0,
    claimStatus:paidStudents<=0?'NO':(dueStudents<=0?'YES':'PARTIAL')
  };
}
function financeAcademicYearValue(raw){
  const text=cleanSmsText(raw);
  if(!text) return String(new Date().getFullYear());
  const years=text.match(/20\d{2}/g);
  return years&&years.length ? years[years.length-1] : text;
}
function financeClaimAcademicYearValue(raw){
  const text=cleanSmsText(raw);
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
  const q=cleanSmsText(financePayQuery).toLowerCase();
  if(!q) return payments.slice();
  return payments.filter(function(p){
    return [p.date,p.name,p.index,p.amount,p.method,p.status,p.txn].some(function(part){
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
    return `<tr><td class="mono">${safeHtml(p.date)}</td><td class="nm">${safeHtml(p.name)}</td><td class="mono">${safeHtml(p.index)}</td><td class="mono">${safeHtml(money(p.amount))}</td><td>${safeHtml(p.method)}</td><td><span class="pill ${p.status}">${safeHtml(p.status)}</span></td><td class="mono" style="font-size:12px">${safeHtml(p.txn)}</td></tr>`;
  }).join(''):emptyRow(7,total?'No transactions on this page.':'No transactions found.');
  const from=total?start+1:0;
  const to=Math.min(start+pageRows.length,total);
  const meta=$('financePayMeta');
  if(meta) meta.textContent='Showing '+from+'-'+to+' of '+total+' transactions';
  const status=$('financePayPageStatus');
  if(status) status.textContent='Page '+financePayPage+' of '+totalPages+' · 25 per page';
}
function applyFinancePaymentSearch(){
  financePayQuery=val('financePaySearch').trim();
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
  const data=[['Date','Student','Index No','Amount (GHS)','Method','Status','Transaction ID']]
    .concat(rows.map(function(p){return [p.date,p.name,p.index,Number(p.amount||0).toFixed(2),p.method,p.status,p.txn];}));
  const blob=new Blob(['\ufeff'+data.map(function(row){return row.map(financeCsvCell).join(',');}).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download='school-financial-transactions-'+new Date().toISOString().slice(0,10)+'.csv';
  link.click();
  setTimeout(function(){URL.revokeObjectURL(link.href);},1000);
}
function printFinancePayments(){
  const rows=filteredFinancePayments();
  if(!rows.length){toast('No transactions to print.');return;}
  const schoolName=(SB_SCHOOL&&SB_SCHOOL.name)||'School';
  const body=rows.map(function(p){return '<tr><td>'+safeHtml(p.date)+'</td><td>'+safeHtml(p.name)+'</td><td>'+safeHtml(p.index)+'</td><td>GHS '+safeHtml(moneyBare(p.amount))+'</td><td>'+safeHtml(p.method)+'</td><td>'+safeHtml(p.status)+'</td><td>'+safeHtml(p.txn)+'</td></tr>';}).join('');
  const w=window.open('','_blank');
  if(!w){toast('Allow pop-ups to print / save PDF');return;}
  w.document.write('<!doctype html><html><head><title>Financial Transactions</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#17231d}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 16px;color:#52635a}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #111;padding:7px;text-align:left}th{background:#14532d;color:#fff}</style></head><body><h1>'+safeHtml(schoolName)+' Financial Transactions</h1><p>Generated '+safeHtml(new Date().toLocaleString())+'</p><table><thead><tr><th>Date</th><th>Student</th><th>Index No</th><th>Amount</th><th>Method</th><th>Status</th><th>Transaction ID</th></tr></thead><tbody>'+body+'</tbody></table></body></html>');
  w.document.close();
  setTimeout(function(){w.print();},250);
}
function studentSmsContact(s){
  if(!s) return '';
  const sms=cleanSmsText((s.rec&&s.rec.sms_contact)||s.smsRaw||s.sms||'');
  return sms==='-' ? '' : sms;
}
function studentDisplayNameByIndex(index,fallback){
  const s=students.find(function(row){ return String(row.index)===String(index); });
  return cleanSmsText((s&&s.name)||fallback||'Student');
}
function placementSmsContact(row){
  const s=students.find(function(item){ return String(item.index)===String(row.index); });
  return cleanSmsText((s&&studentSmsContact(s))||row.sms||'');
}

/* ===== ADMISSION TOGGLE ===== */
function toggleAdmission(){
  admissionOpen=!admissionOpen;
  renderAdmissionStatusControls();
  activityLog.unshift({time:'Just now',action:'Admission '+(admissionOpen?'opened':'closed'),by:(SB_ADMIN_NAME||'Admin')});
  toast('Admission '+(admissionOpen?'opened':'closed'));
}

function admissionStatusIsOpen(value){
  return ['OPEN','OPENED','ACTIVE','TRUE','YES','1'].includes(String(value==null?'':value).trim().toUpperCase());
}
function renderAdmissionStatusControls(){
  const badge=$('admBadge'),text=$('admText'),quick=$('qaToggle');
  if(badge){
    badge.className='adm-badge '+(admissionOpen?'open':'closed');
    badge.setAttribute('aria-busy',admissionStatusSaving?'true':'false');
    badge.style.pointerEvents=admissionStatusSaving?'none':'';
    badge.style.opacity=admissionStatusSaving?'.65':'';
  }
  if(text) text.textContent=admissionStatusSaving?'Saving admission status...':'Admission '+(admissionOpen?'OPEN':'CLOSED');
  if(quick){
    quick.disabled=admissionStatusSaving;
    quick.innerHTML=(admissionStatusSaving?'Saving...':(admissionOpen?'Close admission':'Open admission'))+'<small>'+(admissionOpen?'Currently accepting':'Not accepting')+'</small>';
  }
}

/* ===== DASHBOARD ===== */
function renderStats(){
  const host=$('admCards'); if(!host)return;
  const plc=(typeof placement!=='undefined'?placement:[])||[];
  const placementTotal=Math.max(summaryNumber('placed',Number(placementTotalCount)||0),Number(placementTotalCount)||0,plc.length);
  const norm=g=>{g=(g||'').toString().trim().toLowerCase();if(g==='m'||g==='male')return 'M';if(g==='f'||g==='female')return 'F';return '';};
  const resOf=r=>{r=(r||'').toString().trim().toLowerCase();if(r.indexOf('board')===0)return 'B';if(r==='day')return 'D';return '';};
  const tally=rows=>{const t={n:rows.length,day:0,boarding:0,male:0,female:0,md:0,fd:0,mb:0,fb:0};
    rows.forEach(x=>{const g=norm(x.gender),rr=resOf(x.res);
      if(rr==='D')t.day++;if(rr==='B')t.boarding++;if(g==='M')t.male++;if(g==='F')t.female++;
      if(g==='M'&&rr==='D')t.md++;if(g==='F'&&rr==='D')t.fd++;if(g==='M'&&rr==='B')t.mb++;if(g==='F'&&rr==='B')t.fb++;});
    return t;};
  const submitted=submittedStudents();
  const hasLocal=submitted.length>0;
  const submittedCount=summaryNumber('submitted',submitted.length);
  const subIdx=new Set(submitted.map(s=>String(s.index)));
  const completedRows=hasLocal?plc.filter(p=>subIdx.has(String(p.index))):[];
  const pendingRows=hasLocal?plc.filter(p=>!subIdx.has(String(p.index))):plc.slice(Math.min(submittedCount,plc.length));
  const placed=placementTotal, completed=Math.min(submittedCount,placed||submittedCount), pending=Math.max(placed-completed,0);
  const pc=placed?Math.round(completed/placed*1000)/10:0, pp=placed?Math.round(pending/placed*1000)/10:0;
  const seen={}; let dup=0; plc.forEach(p=>{const k=String(p.index);if(seen[k])dup++;else seen[k]=1;});
  const placementSummary={n:placed,day:summaryNumber('placement_day',0),boarding:summaryNumber('placement_boarding',0),male:summaryNumber('placement_male',0),female:summaryNumber('placement_female',0),md:summaryNumber('placement_male_day',0),fd:summaryNumber('placement_female_day',0),mb:summaryNumber('placement_male_boarding',0),fb:summaryNumber('placement_female_boarding',0)};
  const P=(plc.length||PLACEMENT_STATE.loaded)?tally(plc):placementSummary;
  const summaryTally={n:completed,day:summaryNumber('day',0),boarding:summaryNumber('boarding',0),male:summaryNumber('male',0),female:summaryNumber('female',0),md:summaryNumber('male_day',0),fd:summaryNumber('female_day',0),mb:summaryNumber('male_boarding',0),fb:summaryNumber('female_boarding',0)};
  const pendingSummary={n:pending,day:Math.max(P.day-summaryTally.day,0),boarding:Math.max(P.boarding-summaryTally.boarding,0),male:Math.max(P.male-summaryTally.male,0),female:Math.max(P.female-summaryTally.female,0),md:Math.max(P.md-summaryTally.md,0),fd:Math.max(P.fd-summaryTally.fd,0),mb:Math.max(P.mb-summaryTally.mb,0),fb:Math.max(P.fb-summaryTally.fb,0)};
  const C=hasLocal?tally(completedRows):summaryTally, N=hasLocal?tally(pendingRows):pendingSummary;
  const rowsBlk=t=>`<div class="rows"><div><b>DAY:</b> ${t.day} &nbsp;|&nbsp; <b>BOARDING:</b> ${t.boarding}</div><div><b>MALE:</b> ${t.male} &nbsp;|&nbsp; <b>FEMALE:</b> ${t.female}</div></div>`+
    `<div class="rows sub"><div><b>MALE DAY:</b> ${t.md} &nbsp;|&nbsp; <b>FEMALE DAY:</b> ${t.fd}</div><div><b>MALE BOARDING:</b> ${t.mb} &nbsp;|&nbsp; <b>FEMALE BOARDING:</b> ${t.fb}</div></div>`;
  host.innerHTML=
    `<div class="adm-card amber">
      <div class="ttl"><span>Placed by CSSPS</span><span class="big">${fmt(placed)}</span></div>
      ${rowsBlk(P)}
      <div class="dup">Duplicate Reg. Found: ${dup}</div>
      <div class="mi"><button data-qa-onclick="go('placement')">More info →</button></div>
    </div>
    <div class="adm-card green">
      <div class="ttl"><span>Completed Admissions</span><span class="big">${fmt(completed)}</span></div>
      <div class="pct">${pc}%</div>
      ${rowsBlk(C)}
      <div class="mi"><button data-qa-onclick="go('students')">More info →</button></div>
    </div>
    <div class="adm-card red">
      <div class="ttl"><span>Pending Admissions</span><span class="big">${fmt(pending)}</span></div>
      <div class="pct">${pp}%</div>
      ${rowsBlk(N)}
      <div class="mi"><button data-qa-onclick="go('placement')">View Placement →</button></div>
    </div>`;
  var bp=$('badge-pending'); if(bp) bp.textContent=completed;
}
function renderRecent(){
  const local=[...students].sort((a,b)=>b.reg.localeCompare(a.reg)).slice(0,8);
  const summary=studentSummaryData();
  const rows=local.length?local:(Array.isArray(summary.recent)?summary.recent:[]).map((r,i)=>({id:1000000+i,index:r.bece_index||'',name:r.full_name||'(no name)',reg:(r.submitted_at||r.created_at||'').slice(0,10),prog:''}));
  $('recentRows').innerHTML=rows.map(s=>`<tr><td class="mono">${safeHtml(s.reg)}</td><td class="mono">${safeHtml(s.index)}</td><td class="nm">${safeHtml(s.name)}</td><td>${safeHtml(studentProgrammeName(s),'-')}</td><td><div class="row-actions"><button class="act" data-qa-onclick="${s.id>=1000000?'go(\'students\')':'viewStudent('+s.id+')'}">${s.id>=1000000?'Open list':'View'}</button></div></td></tr>`).join('');
}

/* ===== PROGRAMMES / HOUSES / CLASSES ===== */
function renderProg(){
  $('progRows').innerHTML=programmes.map(p=>{const cap=Math.max(parseInt(p.cap,10)||0,0);const pct=cap?Math.round(p.enr/cap*100):0;return `<tr><td><span class="code">${safeHtml(p.code)}</span></td><td class="nm">${safeHtml(p.name)}</td><td class="mono">${safeHtml(p.cap)}</td><td><div class="cap-bar ${pct>=100?'full':''}"><i style="width:${Math.min(pct,100)}%"></i></div> <span class="mono" style="font-size:12px">${safeHtml(p.enr)}</span></td><td><div class="row-actions"><button class="act" data-qa-onclick="openProg(${p.id})">Edit</button><button class="act danger" data-qa-onclick="delItem('prog',${p.id})">Delete</button></div></td></tr>`;}).join('');
}
function housePriorityValue(h,fallback){
  const num=Number(h&&h.priority);
  return Number.isFinite(num)&&num>0?num:(fallback==null?Number.MAX_SAFE_INTEGER:fallback);
}
function sortLocalHouses(list){
  return [...(list||[])].sort((a,b)=>{
    const diff=housePriorityValue(a)-housePriorityValue(b);
    if(diff!==0)return diff;
    const nameDiff=String((a&&a.name)||'').localeCompare(String((b&&b.name)||''),undefined,{sensitivity:'base'});
    if(nameDiff!==0)return nameDiff;
    return String((a&&(a._id||a.id))||'').localeCompare(String((b&&(b._id||b.id))||''),undefined,{sensitivity:'base'});
  });
}
function nextHousePriority(){
  const nums=(houses||[]).map(h=>Number(h&&h.priority)).filter(n=>Number.isFinite(n)&&n>0);
  return nums.length?Math.max(...nums)+1:1;
}
function renderHouses(){
  $('houseRows').innerHTML=sortLocalHouses(houses).map(h=>{const pct=Math.round(h.occ/h.cap*100);const cat=[h.rtype,h.gender].filter(Boolean).join(' · ')||'Any';return `<tr><td class="mono">${safeHtml(h.priority,'-')}</td><td class="nm"><span class="dot-color" style="background:${h.color}"></span>${safeHtml(h.name)}</td><td><span class="pill ${h.rtype==='Boarding'?'open':(h.rtype==='Day'?'closed':'')}">${safeHtml(cat)}</span></td><td style="color:var(--ink-soft)">${safeHtml(h.motto,'&mdash;')}</td><td class="mono">${safeHtml(h.cap)}</td><td><div class="cap-bar ${pct>=100?'full':''}"><i style="width:${Math.min(pct,100)}%"></i></div> <span class="mono" style="font-size:12px">${safeHtml(h.occ)}</span></td><td><div class="row-actions"><button class="act" data-qa-onclick="openHouse(${h.id})">Edit</button><button class="act danger" data-qa-onclick="delItem('house',${h.id})">Delete</button></div></td></tr>`;}).join('');
}
function renderClasses(){
  $('classRows').innerHTML=classes.map(c=>{const pct=Math.round(c.occ/c.cap*100);const pr=c.progId?(programmes.find(p=>p.id===c.progId)||{}).name:'';return `<tr><td class="nm">${safeHtml(c.name)}</td><td>${pr?`<span class="pill open">${escapeHtml(pr)}</span>`:'<span style="color:var(--muted)">&mdash;</span>'}</td><td class="class-subject-cell">${classSubjectPreviewHTML(c,2)}</td><td><span class="code">${safeHtml(c.code,'&mdash;')}</span></td><td class="mono">${safeHtml(c.cap)}</td><td><div class="cap-bar ${pct>=100?'full':''}"><i style="width:${Math.min(pct,100)}%"></i></div> <span class="mono" style="font-size:12px">${safeHtml(c.occ)}</span></td><td><div class="row-actions"><button class="act" data-qa-onclick="openClass(${c.id})">Edit</button><button class="act danger" data-qa-onclick="delItem('class',${c.id})">Delete</button></div></td></tr>`;}).join('');
}
function subjectCombinationItems(raw){
  const text=String(raw||'').replace(/\r/g,'\n').trim();
  if(!text)return [];
  const markers=Array.from(text.matchAll(/(?:^|\s)(\d{1,2})\s*[.)-]?\s+(?=[A-Za-z])/g));
  if(markers.length>1){
    return markers.map(function(marker,index){
      const start=(marker.index||0)+marker[0].length;
      const end=index+1<markers.length?(markers[index+1].index||text.length):text.length;
      return text.slice(start,end).replace(/^[,;|\s]+|[,;|\s]+$/g,'').trim();
    }).filter(Boolean);
  }
  return text.split(/[,;\n|]+/).map(function(item){return item.replace(/^\s*\d{1,2}\s*[.)-]?\s*/,'').trim();}).filter(Boolean);
}
function classSubjectItems(c){
  if(!c)return [];
  const own=subjectCombinationItems(c.subjects);
  if(own.length)return own;
  const programme=c.progId?programmes.find(function(p){return String(p.id)===String(c.progId);}):null;
  return subjectCombinationItems(programme&&programme.subjects);
}
function classSubjectPreviewHTML(c,limit){
  const items=classSubjectItems(c);
  if(!items.length)return '<span style="color:var(--muted)">&mdash;</span>';
  const visible=items.slice(0,Math.max(1,limit||2));
  const preview=visible.map(function(subject,index){return '<span>'+(index+1)+'. '+safeHtml(subject)+'</span>';}).join('');
  const more=items.length>visible.length?'<button type="button" class="class-subject-more" data-qa-onclick="event.stopPropagation();openClassSubjects('+Number(c.id)+')">View more (+'+(items.length-visible.length)+')</button>':'';
  return '<div class="class-subject-preview">'+preview+more+'</div>';
}
function openClassSubjects(id){
  const c=classes.find(function(item){return Number(item.id)===Number(id);});
  if(!c){toast('Class not found');return;}
  const items=classSubjectItems(c);
  const m=$('modal');
  m.innerHTML='<div class="modal-head"><div><h2>'+safeHtml(c.name,'Class')+' subject combination</h2><p>'+safeHtml(items.length)+' subject'+(items.length===1?'':'s')+'</p></div><button class="modal-x" data-qa-onclick="closeModal()">×</button></div><div class="modal-body">'+(items.length?'<ol class="class-subject-modal-list">'+items.map(function(subject){return '<li>'+safeHtml(subject)+'</li>';}).join('')+'</ol>':'<div class="empty">No subjects have been added to this class.</div>')+'</div><div class="modal-foot"><button class="btn btn-primary" data-qa-onclick="closeModal()">Close</button></div>';
  const overlay=$('overlay');
  overlay.classList.remove('manage-student-editor','verified-student-details');
  if(window.matchMedia('(min-width:1025px)').matches){
    const app=document.querySelector('.app');
    if(app)app.classList.remove('sidebar-hidden','sidebar-collapsed');
  }
  overlay.classList.add('show','class-subject-details');
  requestAnimationFrame(positionManageStudentEditor);
}
function delItem(type,id){
  const map={prog:[programmes,'programme'],house:[houses,'house'],class:[classes,'class']};
  const [arr,label]=map[type];const item=arr.find(x=>x.id===id);
  if(!confirm('Delete '+(item.name||item.code)+'?'))return;
  const i=arr.indexOf(item);arr.splice(i,1);
  if(type==='prog')renderProg();if(type==='house')renderHouses();if(type==='class')renderClasses();
  fillSelects();toast(label.charAt(0).toUpperCase()+label.slice(1)+' deleted');
}

/* generic CRUD modal */
function crudModal(title,fields,onSave){
  const m=$('modal');
  m.innerHTML=`<div class="modal-head"><h2>${title}</h2><button class="modal-x" data-qa-onclick="closeModal()">×</button></div>
  <div class="modal-body">${fields}</div>
  <div class="modal-foot"><button class="btn btn-ghost" data-qa-onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="crudSave">Save</button></div>`;
  $('overlay').classList.remove('manage-student-editor');$('overlay').classList.add('show');$('crudSave').onclick=onSave;
}
function openProg(id){
  const p=id?programmes.find(x=>x.id===id):{code:'',name:'',subjects:'',cap:100};
  crudModal(id?'Edit programme':'Add programme',
    `<div class="grid-2"><div class="field"><label>Code</label><input id="c_code" value="${escapeAttr(p.code)}" placeholder="e.g. SCI"></div><div class="field"><label>Capacity</label><input id="c_cap" type="number" value="${escapeAttr(p.cap)}"></div></div>
     <div class="field"><label>Programme name</label><input id="c_name" value="${escapeAttr(p.name)}" placeholder="e.g. General Science"></div>
     <div class="field"><label>Subjects <span class="hint">— comma separated</span></label><textarea id="c_sub">${escapeHtml(p.subjects)}</textarea></div>`,
    ()=>{const code=$('c_code').value.trim().toUpperCase(),name=$('c_name').value.trim();if(!code||!name){toast('Code and name required');return;}
      if(id){p.code=code;p.name=name;p.subjects=$('c_sub').value;p.cap=+$('c_cap').value||100;}
      else programmes.push({id:Date.now(),code,name,subjects:$('c_sub').value,cap:+$('c_cap').value||100,enr:0});
      closeModal();renderProg();fillSelects();toast('Programme saved');});
}
function openHouse(id){
  const h=id?houses.find(x=>x.id===id):{name:'',color:'#1557B0',motto:'',cap:100};
  crudModal(id?'Edit house':'Add house',
    `<div class="grid-2"><div class="field"><label>House name</label><input id="c_name" value="${escapeAttr(h.name)}"></div><div class="field"><label>Colour</label><input id="c_color" type="color" value="${escapeAttr(h.color)}"></div></div>
     <div class="field"><label>Motto</label><input id="c_motto" value="${escapeAttr(h.motto)}"></div>
     <div class="field" style="max-width:160px"><label>Capacity</label><input id="c_cap" type="number" value="${escapeAttr(h.cap)}"></div>`,
    ()=>{const name=$('c_name').value.trim();if(!name){toast('House name required');return;}
      if(id){h.name=name;h.color=$('c_color').value;h.motto=$('c_motto').value;h.cap=+$('c_cap').value||100;}
      else houses.push({id:Date.now(),name,color:$('c_color').value,motto:$('c_motto').value,cap:+$('c_cap').value||100,occ:0});
      closeModal();renderHouses();fillSelects();toast('House saved');});
}
function openClass(id){
  const c=id?classes.find(x=>x.id===id):{name:'',code:'',cap:50};
  crudModal(id?'Edit class':'Add class',
    `<div class="grid-2"><div class="field"><label>Class name</label><input id="c_name" value="${escapeAttr(c.name)}" placeholder="Form 1A"></div><div class="field"><label>Code</label><input id="c_code" value="${escapeAttr(c.code)}" placeholder="1A"></div></div>
     <div class="field" style="max-width:160px"><label>Capacity</label><input id="c_cap" type="number" value="${escapeAttr(c.cap)}"></div>`,
    ()=>{const name=$('c_name').value.trim();if(!name){toast('Class name required');return;}
      if(id){c.name=name;c.code=$('c_code').value;c.cap=+$('c_cap').value||50;}
      else classes.push({id:Date.now(),name,code:$('c_code').value,cap:+$('c_cap').value||50,occ:0});
      closeModal();renderClasses();fillSelects();toast('Class saved');});
}

/* ===== PLACEMENT ===== */
async function loadPlacementRecords(){
  if(!SB_SCHOOL||!SB_SCHOOL.id||PLACEMENT_STATE.loaded||PLACEMENT_STATE.loading)return;
  PLACEMENT_STATE.loading=true;
  const {data,error}=await invokeFnDetailed('admin-placement-list',{school_id:SB_SCHOOL.id,page:1,page_size:5000});
  PLACEMENT_STATE.loading=false;
  if(error){toast('Could not load placement list: '+error.message);return;}
  if(!data||data.ok===false){toast('Could not load placement list: '+((data&&data.message)||'unknown error'));return;}
  placement=(data.rows||[]).map(p=>({index:p.index_number,name:p.student_name,gender:p.gender||'',res:p.residential_status||'',prog:p.programme,agg:p.aggregate,jhs:p.jhs_attended||'',dob:p.dob||'',sms:p.sms_contact||'',code:p.enrolment_code,loggedIn:p.logged_in}));
  placementTotalCount=Number(data.total)||placement.length;
  Object.assign(PLACEMENT_STATE,{loaded:true,page:1,total:placement.length,totalPages:Math.max(Math.ceil(placement.length/PLACEMENT_PAGE_SIZE),1)});
  if(placementTotalCount>placement.length) toast('Showing the latest '+placement.length+' placement records.');
}
async function loadFinancePayments(){
  if(!SB_SCHOOL||!SB_SCHOOL.id||FINANCE_PAYMENTS_STATE.loaded||FINANCE_PAYMENTS_STATE.loading)return;
  FINANCE_PAYMENTS_STATE.loading=true;
  const {data,error}=await invokeFnDetailed('admin-payments-list',{school_id:SB_SCHOOL.id,page:1,page_size:500});
  FINANCE_PAYMENTS_STATE.loading=false;
  if(error){financePaymentsLoadError=error.message||'Could not load payments.';renderFinancePayments();return;}
  if(error||!data||data.ok===false){financePaymentsLoadError=(data&&data.message)||(error&&error.message)||'Could not load payments.';renderFinancePayments();return;}
  payments=(data.rows||[]).map(function(p){return {studentId:p.student_id,date:(p.paid_at||p.created_at||'').slice(0,10),name:(p.students&&p.students.full_name)||p.payer_name||'—',index:(p.students&&p.students.bece_index)||'—',amount:(p.amount_pesewas||0)/100,method:p.channel,status:p.status,txn:p.reference};});
  FINANCE_PAYMENTS_STATE.total=Number(data&&data.total)||payments.length; FINANCE_PAYMENTS_STATE.loaded=true;
  if(FINANCE_PAYMENTS_STATE.total>payments.length) toast('Showing the latest '+payments.length+' transactions. Exporting the complete history will be added to the paginated finance API.');
  renderFinancePayments();
}
function renderPlacement(){
  const qEl=$('placeSearch'); const q=(qEl&&qEl.value||'').trim().toLowerCase();
  const list=q?placement.filter(p=>((p.name||'').toLowerCase().includes(q)||String(p.index||'').toLowerCase().includes(q))):placement;
  const total=list.length;
  const totalPages=Math.max(Math.ceil(total/PLACEMENT_PAGE_SIZE),1);
  PLACEMENT_STATE.page=Math.min(Math.max(Number(PLACEMENT_STATE.page)||1,1),totalPages);
  PLACEMENT_STATE.total=total;PLACEMENT_STATE.totalPages=totalPages;PLACEMENT_STATE.pageSize=PLACEMENT_PAGE_SIZE;
  const start=(PLACEMENT_STATE.page-1)*PLACEMENT_PAGE_SIZE;
  const pageRows=list.slice(start,start+PLACEMENT_PAGE_SIZE);
  $('placeCount').textContent=q?(total+' of '+placement.length):placement.length;
  $('placeRows').innerHTML=pageRows.length?pageRows.map(p=>`<tr><td class="mono">${safeHtml(p.index)}</td><td class="nm">${safeHtml(p.name)}</td><td>${safeHtml(p.gender,'&mdash;')}</td><td>${safeHtml(p.res,'&mdash;')}</td><td>${safeHtml(p.prog,'&mdash;')}</td><td class="mono">${safeHtml(p.agg,'&mdash;')}</td><td class="mono">${safeHtml(p.sms,'&mdash;')}</td><td>${p.loggedIn?'<span class="pill open">Yes</span>':'<span class="pill closed">No</span>'}</td><td><div class="row-actions"><button class="act" data-qa-onclick="editPlacement('${encodeURIComponent(p.index)}')">Edit</button><button class="act" data-qa-onclick="deletePlacement('${encodeURIComponent(p.index)}')">Delete</button></div></td></tr>`).join(''):emptyRow(9,q?'No records match your search.':'No placement records yet.');
  const from=total?start+1:0, to=Math.min(start+pageRows.length,total);
  const pageMeta=$('placePageMeta'),pagerMeta=$('placePagerMeta'),prev=$('placePrevBtn'),next=$('placeNextBtn');
  if(pageMeta)pageMeta.textContent='Showing '+from+'–'+to+' of '+total+' students';
  if(pagerMeta)pagerMeta.textContent='Page '+PLACEMENT_STATE.page+' of '+totalPages+' · 50 per page';
  if(prev)prev.disabled=PLACEMENT_STATE.page<=1;
  if(next)next.disabled=PLACEMENT_STATE.page>=totalPages;
}
function resetPlacementPage(){PLACEMENT_STATE.page=1;renderPlacement();}
function changePlacementPage(delta){const next=(PLACEMENT_STATE.page||1)+delta;if(next<1||next>(PLACEMENT_STATE.totalPages||1))return;PLACEMENT_STATE.page=next;renderPlacement();}
function editPlacement(encIdx){
  const idx=decodeURIComponent(encIdx);
  const p=placement.find(x=>x.index===idx);if(!p)return;
  const m=$('modal');m.className='modal';
  const progOpts='<option value="">— Select —</option>'+programmes.map(pr=>`<option value="${escapeAttr(pr.name)}" ${p.prog===pr.name?'selected':''}>${escapeHtml(pr.name)}</option>`).join('');
  m.innerHTML=`<div class="modal-head"><div><h2>Edit placement record</h2><p><span class="code">${safeHtml(p.index)}</span></p></div><button class="modal-x" data-qa-onclick="closeModal()">×</button></div>
  <div class="modal-body"><div class="grid-2">
    <div class="field"><label>Full name</label><input id="ep_name" value="${escapeAttr(p.name)}"></div>
    <div class="field"><label>Gender</label><select id="ep_gender"><option value="">Select…</option><option ${p.gender==='Male'?'selected':''}>Male</option><option ${p.gender==='Female'?'selected':''}>Female</option></select></div>
    <div class="field"><label>Residential status</label><select id="ep_res"><option value="">Select…</option><option ${p.res==='Boarding'?'selected':''}>Boarding</option><option ${p.res==='Day'?'selected':''}>Day</option></select></div>
    <div class="field"><label>Programme</label><select id="ep_prog">${progOpts}</select></div>
    <div class="field"><label>Aggregate</label><input id="ep_agg" type="number" min="6" max="54" value="${escapeAttr(p.agg||'')}"></div>
    <div class="field"><label>JHS attended</label><input id="ep_jhs" value="${escapeAttr(p.jhs)}"></div>
    <div class="field"><label>Date of birth</label><input id="ep_dob" type="date" value="${escapeAttr(p.dob||'')}"></div>
    <div class="field"><label>SMS contact</label><input id="ep_sms" value="${escapeAttr(p.sms)}"></div>
    <div class="field"><label>Enrolment code</label><input id="ep_code" value="${escapeAttr(p.code)}"></div>
  </div></div>
  <div class="modal-foot"><button class="btn btn-ghost" data-qa-onclick="closeModal()">Cancel</button><button class="btn btn-primary" data-qa-onclick="savePlacement('${encodeURIComponent(idx)}')">Save changes</button></div>`;
  $('overlay').classList.add('show');
}
async function savePlacement(encIdx){
  if(roGuard())return;
  const idx=decodeURIComponent(encIdx);
  const p=placement.find(x=>x.index===idx);if(!p)return;
  const name=val('ep_name').trim();if(!name){toast('Name is required');return;}
  const upd={
    student_name:name,
    gender:val('ep_gender')||null,
    residential_status:val('ep_res')||null,
    programme:val('ep_prog')||null,
    aggregate:val('ep_agg')?parseInt(val('ep_agg')):null,
    jhs_attended:val('ep_jhs')||null,
    dob:val('ep_dob')||null,
    sms_contact:val('ep_sms')||null,
    enrolment_code:val('ep_code')||null
  };
  const {data,error}=await invokeFnDetailed('admin-placement-list',{action:'update',school_id:SB_SCHOOL.id,index_number:idx,patch:upd});
  if(error||!data||data.ok===false){toast('Save failed: '+((data&&data.message)||(error&&error.message)||'Could not update placement record.'));return;}
  p.name=name;p.gender=upd.gender||'';p.res=upd.residential_status||'';
  p.prog=upd.programme||'';p.agg=upd.aggregate;p.jhs=upd.jhs_attended||'';p.dob=upd.dob||'';
  p.sms=upd.sms_contact||'';p.code=upd.enrolment_code||null;
  notifyStudentPortalRefresh('placement-update',{index:idx});
  closeModal();renderPlacement();toast('Placement record saved');
}
async function deletePlacement(encIdx){
  if(roGuard())return;
  const idx=decodeURIComponent(encIdx);
  const p=placement.find(x=>x.index===idx);if(!p)return;
  if(!confirm('Delete placement record for '+(p.name||idx)+' ('+idx+')?\n\nThis cannot be undone.'))return;
  const {data,error}=await invokeFnDetailed('admin-placement-list',{action:'delete',school_id:SB_SCHOOL.id,index_number:idx});
  if(error||!data||data.ok===false){toast('Delete failed: '+((data&&data.message)||(error&&error.message)||'Could not delete placement record.'));return;}
  placement=placement.filter(x=>x.index!==idx);
  notifyStudentPortalRefresh('placement-delete',{index:idx});
  renderPlacement();toast('Placement record deleted');
}
async function deletePlacementBatch(scope){
  if(roGuard())return;
  if(!SB_SCHOOL){toast('School not loaded');return;}
  if(!placement.length){toast('Placement list is already empty');return;}
  const msg = scope==='all'
    ? 'Delete the ENTIRE placement list ('+placement.length+' records)?\n\nStudents who have already submitted their forms are kept. This cannot be undone.'
    : 'Delete the most recent import batch?\n\nOnly the last imported/added records are removed (submitted students are kept). This cannot be undone.';
  if(!confirm(msg))return;
  if(scope==='all' && !confirm('Final confirmation — permanently delete all placement records?'))return;
  toast('Deleting…');
  const {data,error}=await sb.rpc('delete_placement',{p_school:SB_SCHOOL.id,p_scope:scope});
  if(error){toast('Delete failed: '+error.message);return;}
  if(!data||!data.ok){toast('Delete failed: '+((data&&data.error)||'unknown'));return;}
  const {data:plcData}=await sb.from('placement_list').select('index_number,student_name,gender,residential_status,programme,aggregate,jhs_attended,dob,sms_contact,enrolment_code,logged_in').eq('school_id',SB_SCHOOL.id).order('index_number').range(0,4999);
  placement=(plcData||[]).map(p=>({index:p.index_number,name:p.student_name,gender:p.gender||'',res:p.residential_status||'',prog:p.programme,agg:p.aggregate,jhs:p.jhs_attended||'',dob:p.dob||'',sms:p.sms_contact||'',code:p.enrolment_code,loggedIn:p.logged_in})); placementTotalCount=placement.length; PLACEMENT_STATE.loaded=true;
  notifyStudentPortalRefresh('placement-batch-delete');
  renderPlacement();
  toast('Deleted '+data.deleted+' record(s)'+(data.skipped_submitted?' · '+data.skipped_submitted+' kept (submitted)':''));
}
async function deleteAllStudentRecords(){
  if(roGuard())return;
  if(!SB_SCHOOL){toast('School not loaded');return;}
  if(!confirm('Delete ALL school records for '+(SB_SCHOOL.name||'this school')+'?\n\nThis permanently removes the ENTIRE placement list, admission list, payments, tokens, uploaded forms, SMS history and activity log. This CANNOT be undone.'))return;
  const typed=prompt('This is irreversible. Type DELETE to confirm:');
  if((typed||'').trim().toUpperCase()!=='DELETE'){toast('Cancelled — not deleted');return;}
  toast('Deleting all student records…');
  const {data,error}=await invokeFnDetailed('delete-school-records',{school_id:SB_SCHOOL.id});
  if(error){toast('Delete failed: '+error.message);return;}
  if(!data||!data.ok){
    const e=data&&data.error;
    toast('Delete failed: '+(e==='owner_only'?'only the school owner can do this':(e||'unknown')));return;
  }
  if((Array.isArray(data.form_paths) && data.form_paths.length) || (Array.isArray(data.form_urls) && data.form_urls.length)){
    try{
      const pathSet=new Set((data.form_paths||[]).map(function(path){return String(path||'').trim();}).filter(Boolean));
      (data.form_urls||[]).forEach(function(url){
        const m=String(url||'').match(/enrolment-forms\/(.+)$/);
        if(m) pathSet.add(decodeURIComponent(m[1]));
      });
      const paths=Array.from(pathSet);
      if(paths.length) await sb.storage.from('enrolment-forms').remove(paths);
    }catch(e){}
  }
  placement=[]; students=[]; payments=[]; smsHistory=[]; smsDeliveredIndexes=new Set(); activityLog=[]; selected&&selected.clear&&selected.clear();
  if(SB_CFG) Object.assign(SB_CFG,{finance_settled_students:0,finance_settled_at:null,finance_claim_count:0});
  if(typeof renderPlacement==='function')renderPlacement();
  if(typeof renderStudents==='function')renderStudents();
  if(typeof renderFinance==='function')renderFinance();
  if(typeof renderStats==='function')renderStats();
  if(typeof renderSms==='function')renderSms();
  if(typeof renderLog==='function')renderLog();
  notifyStudentPortalRefresh('student-records-delete-all');
  const smsDeleted=Number(data.sms_logs||0)+Number(data.legacy_sms_logs||0);
  toast('Done — deleted '+(data.students||0)+' student(s), '+(data.placements||0)+' placement(s), '+(data.payments||0)+' payment(s), '+smsDeleted+' SMS log(s), '+(data.activity_logs||0)+' activity log(s) and '+(data.finance_claims||0)+' finance claim(s)');
}
function importPlacement(){
  document.getElementById('csvFileInput').click();
}
function openPop(id){
  if(roGuard())return;
  const o=document.getElementById(id); if(!o)return;
  o.classList.add('show');
  if(id==='manualPop'){ const i=document.getElementById('pl_index'); if(i){ try{i.focus();}catch(e){} } }
}
function closePop(id){ const o=document.getElementById(id); if(o) o.classList.remove('show'); }
function downloadPlacementTemplate(){
  // Columns match the manual "Add record" form (all required). Download as Excel.
  const headers=['index_number','student_name','gender','residential_status','programme','aggregate','dob','sms_contact'];
  const example=['100000000026','AMA MENSAH','Female','Boarding','General Science','12','2010-11-26 00:00:00','0244000000'];
  if(typeof XLSX!=='undefined'){
    const ws=XLSX.utils.aoa_to_sheet([headers,example]);
    ws['!cols']=headers.map(()=>({wch:18}));
    // Force index_number (col A) and sms_contact (col H) to TEXT so Excel keeps leading zeros
    ['A','G','H'].forEach(col=>{ for(let row=2;row<=200;row++){ const ref=col+row; const c=ws[ref]||(ws[ref]={t:'s',v:''}); c.t='s'; c.z='@'; } });
    if(!ws['!ref']||XLSX.utils.decode_range(ws['!ref']).e.r<199){ ws['!ref']='A1:H200'; }
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Placement');
    try{
      XLSX.writeFile(wb,excelFileName('placement_template'),{bookType:preferredExcelExtension()==='xls'?'xls':'xlsx'});
    }catch(e){
      console.warn('Placement template fallback',e);
      const csv=headers.join(',')+'\n'+example.join(',')+'\n';
      const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='placement_template.csv';a.click();
    }
  } else {
    // fallback if the spreadsheet library hasn't loaded
    const csv=headers.join(',')+'\n'+example.join(',')+'\n';
    const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='placement_template.csv';a.click();
  }
}
function normHdr(h){ return String(h).trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''); }
// Convert dates like "Nov 26, 2010", "26/11/2010" or an Excel date to YYYY-MM-DD.
function toISODate(v){
  if(v==null) return '';
  v=String(v).trim(); if(!v) return '';
  // Already starts with a date like 2010-11-26 (optionally followed by a time) — take the date part.
  const iso=v.match(/^(\d{4})-(\d{2})-(\d{2})/); if(iso) return iso[1]+'-'+iso[2]+'-'+iso[3];
  const d=new Date(v);
  if(isNaN(d.getTime())) return '';
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
async function handlePlacementFile(inp){
  const file=inp.files[0];inp.value='';
  if(!file)return;
  if(!SB_SCHOOL){toast('School not loaded yet');return;}
  let rows=[];
  const isExcel=/\.(xlsx|xls)$/i.test(file.name);
  if(isExcel) rememberExcelExtension(file.name);
  if(isExcel){
    if(typeof XLSX==='undefined'){toast('Spreadsheet reader still loading — try again in a moment');return;}
    try{
      const buf=await file.arrayBuffer();
      const wb=XLSX.read(buf,{type:'array',cellDates:true});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const aoa=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''});
      const nonEmpty=aoa.filter(r=>r.some(c=>String(c).trim()!==''));
      if(nonEmpty.length<2){toast('Spreadsheet has no data rows');return;}
      const hdrs=nonEmpty[0].map(canonicalPlacementHeader);
      rows=nonEmpty.slice(1).map(r=>{const o={};hdrs.forEach((h,i)=>{const v=(r[i]!==undefined&&r[i]!==null)?normalizePlacementFieldValue(h,r[i]):'';if(v!=='')o[h]=v;});return o;}).filter(r=>r.index_number);
    }catch(e){toast('Could not read spreadsheet: '+e.message);return;}
  } else {
    const text=await file.text();
    // handle Windows (\r\n), Unix (\n) and old-Mac (\r) line endings
    const lines=text.split(/\r\n|\r|\n/).filter(l=>l.trim());
    if(lines.length<2){toast('CSV file appears empty');return;}
    const hdrs=lines[0].split(',').map(canonicalPlacementHeader);
    rows=lines.slice(1).map(line=>{
      const cols=line.split(',').map(c=>c.trim().replace(/^"|"$/g,''));
      const obj={};
      hdrs.forEach((h,i)=>{if(cols[i]!==undefined&&cols[i]!=='')obj[h]=normalizePlacementFieldValue(h,cols[i]);});
      return obj;
    }).filter(r=>r.index_number);
  }
  if(!rows.length){toast('No valid rows found — check the column headers match the template');return;}
  // Restore leading zeros Excel may have stripped (index = 12 digits, SMS = 10 digits)
  // and normalise the date of birth (e.g. "Nov 26, 2010") to YYYY-MM-DD for storage.
  rows.forEach(r=>{
    if(r.index_number&&/^\d+$/.test(r.index_number)&&r.index_number.length<12) r.index_number=r.index_number.padStart(12,'0');
    if(r.sms_contact&&/^\d+$/.test(r.sms_contact)&&r.sms_contact.length<10) r.sms_contact=r.sms_contact.padStart(10,'0');
    if(r.dob){ const iso=toISODate(r.dob); if(iso) r.dob=iso; else delete r.dob; }
  });
  toast('Importing '+rows.length+' rows…');
  const {data,error}=await sb.rpc('import_placement',{p_school:SB_SCHOOL.id,p_rows:rows});
  if(error){toast('Import failed: '+error.message);return;}
  const res=data||{};
  toast('Done — added: '+(res.inserted||0)+(res.updated?' · '+res.updated+' updated':'')+((res.invalid||0)?' · '+res.invalid+' invalid':''));
  closePop('importPop');
  const {data:plcData}=await sb.from('placement_list').select('index_number,student_name,gender,residential_status,programme,aggregate,jhs_attended,dob,sms_contact,enrolment_code,logged_in').eq('school_id',SB_SCHOOL.id).order('index_number').range(0,4999);
  placement=(plcData||[]).map(p=>({index:p.index_number,name:p.student_name,gender:p.gender||'',res:p.residential_status||'',prog:p.programme,agg:p.aggregate,jhs:p.jhs_attended||'',dob:p.dob||'',sms:p.sms_contact||'',code:p.enrolment_code,loggedIn:p.logged_in})); placementTotalCount=placement.length; PLACEMENT_STATE.loaded=true;
  notifyStudentPortalRefresh('placement-import');
  renderPlacement();
}
// addPlacement is defined later (single canonical version that requires all fields)

/* ===== STUDENTS + BULK ===== */
function filteredStudents(){
  const q=($('stuSearch').value||'').toLowerCase();const pr=$('stuProg').value;
  const source=MANAGE_STATE.rows.length?MANAGE_STATE.rows:submittedStudents();
  return source.filter(s=>(s.name.toLowerCase().includes(q)||s.index.includes(q))&&(pr==='all'||s.progId==pr));
}
function submittedStudentTotal(){ return summaryNumber('submitted',submittedStudents().length); }
function displayedAdmissionNumber(s){ return (s&&(s.permAdm||s.adm))||'-'; }
function displayedClassName(s){ const c=s&&s.classId?classById(s.classId):null; return (c&&c.name)||(s&&s.className)||''; }
function displayedHouseName(s){ const h=s&&s.houseId?houseById(s.houseId):null; return (h&&h.name)||(s&&s.houseName)||(s&&s.house)||''; }
function renderStudentsRows(){
  const rows=filteredStudents();
  const showHouse=canViewStudentHouse();
  $('stuRows').innerHTML=rows.length?rows.map(s=>{
    const h=houseById(s.houseId),className=displayedClassName(s),houseName=displayedHouseName(s);
    return `<tr><td><span class="checkbox ${selected.has(s.id)?'on':''}" data-qa-onclick="toggleSel(${s.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span></td>
    <td class="mono" style="font-size:12px">${safeHtml(displayedAdmissionNumber(s))}</td><td class="mono">${safeHtml(s.index)}</td><td class="nm">${safeHtml(s.name)}</td>
    <td>${safeHtml(studentProgrammeName(s),'-')}</td><td>${className?safeHtml(className):'<span style="color:var(--muted)">&mdash;</span>'}</td>
    ${showHouse?`<td>${houseName?`${h?`<span class="dot-color" style="background:${h.color}"></span>`:''}${safeHtml(houseName)}`:'<span style="color:var(--muted)">&mdash;</span>'}</td>`:''}
    <td><div class="row-actions"><button class="act" data-qa-onclick="viewStudent(${s.id})">Edit</button></div></td></tr>`;
  }).join(''):emptyRow(showHouse?8:7,'No students match your filters.');
  updateBulk();updateSelAll();
  const count=document.getElementById('manageCount'); if(count)count.textContent=(MANAGE_STATE.total||rows.length)+' student'+((MANAGE_STATE.total||rows.length)===1?'':'s');
  const pager=document.getElementById('managePagerMeta'); if(pager)pager.textContent='Page '+(MANAGE_STATE.page||1)+' of '+(MANAGE_STATE.totalPages||1);
}
function renderStudents(){
  if(SB_SCHOOL&&SB_SCHOOL.id){ loadManageStudentsPage(false); return; }
  renderStudentsRows();
}
function toggleSel(id){selected.has(id)?selected.delete(id):selected.add(id);renderStudentsRows();}
function toggleAll(){const rows=filteredStudents();const allSel=rows.every(s=>selected.has(s.id));rows.forEach(s=>allSel?selected.delete(s.id):selected.add(s.id));renderStudentsRows();}
function updateSelAll(){const rows=filteredStudents();const el=$('selAll');el.classList.toggle('on',rows.length>0&&rows.every(s=>selected.has(s.id)));}
function updateBulk(){
  if(selected.size===0){$('bulkHost').innerHTML='';return;}
  $('bulkHost').innerHTML=`<div class="bulkbar">
    <span class="cnt">${selected.size} selected</span>
    <select id="bulkClass"><option value="">Assign class…</option>${classes.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
    <select id="bulkHouse"><option value="">Assign house…</option>${houses.map(h=>`<option value="${h.id}">${escapeHtml(h.name)}</option>`).join('')}</select>
    <button class="btn btn-sm" data-qa-onclick="applyBulk()">Apply</button>
    <button class="btn btn-sm" data-qa-onclick="bulkSms()">Send SMS</button>
    <button class="btn btn-sm" data-qa-onclick="clearSel()" style="margin-left:auto">Clear</button>
  </div>`;
}
async function applyBulk(){
  if(roGuard())return;
  const cl=$('bulkClass').value,ho=$('bulkHouse').value;
  if(!cl&&!ho){toast('Pick a class or house to assign');return;}
  const chosen=[...selected].map(managedStudentById).filter(Boolean);
  if(!chosen.length){toast('Select students to update');return;}
  const house=ho?houseById(+ho):null;
  if(house){
    const issue=houseAllocationIssue(house);if(issue){toast(issue);return;}
    if(chosen.some(s=>!houseEligibleForStudent(house,s))){toast('Every selected student must match the house gender and residential type.');return;}
    const capacity=Math.max(Number(house.cap)||0,0), current=Math.max(Number(house.occ)||0,students.filter(s=>s.houseId===house.id).length), moving=chosen.filter(s=>s.houseId!==house.id).length;
    if(current+moving>capacity){toast('The selected students exceed the remaining capacity in '+house.name+'.');return;}
  }
  const patch={};if(cl)patch.class_id=cMap[+cl]||null;if(ho)patch.house_id=hMap[+ho]||null;
  const result=await updateStudentAssignments(chosen.map(s=>s._id),patch);
  if(!result.ok){toast('Bulk allocation failed: '+result.message);return;}
  const uuids=new Set(chosen.map(s=>String(s._id)));
  [...students,...(MANAGE_STATE.rows||[]),...(REG_STATE.rows||[])].forEach(s=>{if(uuids.has(String(s._id))){if(cl)s.classId=+cl;if(ho)s.houseId=+ho;}});
  if(ho)notifyStudentPortalRefresh('house-bulk-assign',{indexes:chosen.map(s=>s.index)});
  activityLog.unshift({time:'Just now',action:`Bulk allocation on ${chosen.length} students`,by:(SB_ADMIN_NAME||'Admin')});
  clearSel();renderStats();toast(`Updated ${chosen.length} students`);
}
function bulkSms(){
  var chosen=[...selected].map(managedStudentById).filter(Boolean);
  var programmeNames=[...new Set(chosen.map(function(s){
    return cleanSmsText(studentProgrammeName(s)).replace(/^-$/,'');
  }).filter(Boolean))];
  smsPrefillProgramme=(programmeNames.length===1?programmeNames[0]:'all');
  go('sms');
  if(programmeNames.length===1) toast('SMS composer filtered to '+programmeNames[0]);
  else toast('SMS composer is grouped by programme. Pick a programme to continue.');
}
function clearSel(){selected.clear();renderStudentsRows();}
function studentClassOptionsForProgramme(progId,selectedClassId){
  const pid=progId?String(progId):'';
  const filtered=pid?classes.filter(function(c){ return c.progId&&String(c.progId)===pid; }):[];
  return '<option value="">- Not allocated -</option>'+filtered.map(c=>`<option value="${c.id}" ${String(selectedClassId||'')===String(c.id)?'selected':''}>${escapeHtml(c.name)}</option>`).join('');
}
function refreshEditClassOptions(){
  const sel=$('es_class'); if(!sel)return;
  sel.innerHTML=studentClassOptionsForProgramme(val('es_prog'),sel.value);
}
function managedStudentById(id){
  return (MANAGE_STATE.rows||[]).find(x=>x.id===id)||students.find(x=>x.id===id);
}
function editHouseOptions(gender,residential,selectedHouseId){
  const candidate={gender:gender,res:residential};
  const eligible=sortLocalHouses(houses).filter(h=>houseAllocationIssue(h)===''&&houseEligibleForStudent(h,candidate));
  return '<option value="">— Not allocated —</option>'+eligible.map(h=>`<option value="${h.id}" ${String(selectedHouseId||'')===String(h.id)?'selected':''}>${escapeHtml(h.name)} · ${escapeHtml(h.gender)} · ${escapeHtml(h.rtype)}</option>`).join('');
}
function refreshEditHouseOptions(){
  const sel=$('es_house'); if(!sel)return;
  const previous=sel.value||sel.dataset.current||'';
  sel.innerHTML=editHouseOptions(val('es_gender'),val('es_residential'),previous);
  sel.dataset.current=sel.value;
  const hint=$('es_house_hint');
  if(hint) hint.textContent=sel.options.length>1?'Only houses matching gender and residential status are shown.':'No configured house matches this gender and residential status.';
}
function positionManageStudentEditor(){
  const overlay=$('overlay'); if(!overlay||(!overlay.classList.contains('manage-student-editor')&&!overlay.classList.contains('student-verification-dialog')&&!overlay.classList.contains('verified-student-details')&&!overlay.classList.contains('class-subject-details')&&!overlay.classList.contains('user-account-editor')))return;
  const topbar=document.querySelector('.topbar'), sidebar=$('sidebar'), footer=document.querySelector('body > footer.system-footer');
  const desktop=window.matchMedia('(min-width:1025px)').matches;
  const top=topbar?Math.max(0,topbar.getBoundingClientRect().bottom):0;
  const left=desktop&&sidebar?Math.max(0,sidebar.getBoundingClientRect().right):0;
  const bottom=footer?Math.max(0,window.innerHeight-footer.getBoundingClientRect().top):0;
  overlay.style.setProperty('--manage-editor-top',top+'px');
  overlay.style.setProperty('--manage-editor-left',left+'px');
  overlay.style.setProperty('--manage-editor-bottom',bottom+'px');
}
window.addEventListener('resize',positionManageStudentEditor);
window.addEventListener('scroll',positionManageStudentEditor,{passive:true});
function viewStudent(id){
  const s=managedStudentById(id); if(!s)return toast('Student record is still loading. Please try again.');
  const m=$('modal');
  const selectedProgId=s.progId||studentProgrammeIdByName(s.prog);
  const progOpts='<option value="">Select programme</option>'+programmes.map(p=>`<option value="${p.id}" ${selectedProgId==p.id?'selected':''}>${escapeHtml(p.name)}</option>`).join('');
  const classOpts=studentClassOptionsForProgramme(selectedProgId,s.classId);
  const gender=normalizeStudentGender(s.gender);
  const residential=normalizeResidentialStatus(s.res);
  const houseOpts=editHouseOptions(gender,residential,s.houseId);
  const hasPermanentAdmission=!!String(s.permAdm||'').trim();
  m.innerHTML=`<div class="modal-head"><div><h2>${safeHtml(s.name)}</h2><p><span class="code">${safeHtml(s.index)}</span></p></div><button class="modal-x" data-qa-onclick="closeModal()">×</button></div>
  <div class="modal-body"><div class="grid-2">
    <div class="field"><label>Full name</label><input id="es_name" value="${escapeAttr(s.name)}"></div>
    <div class="field"><label>Gender</label><select id="es_gender" data-qa-onchange="refreshEditHouseOptions()"><option value="M" ${gender==='M'?'selected':''}>Male</option><option value="F" ${gender==='F'?'selected':''}>Female</option></select></div>
    <div class="field"><label>Residential status</label><select id="es_residential" data-qa-onchange="refreshEditHouseOptions()" required><option value="">Select status</option><option value="Boarding" ${residential==='Boarding'?'selected':''}>Boarding</option><option value="Day" ${residential==='Day'?'selected':''}>Day</option></select></div>
    <div class="field"><label>${hasPermanentAdmission?'Permanent Admission No':'Admission No'}</label><input id="es_adm" value="${escapeAttr(displayedAdmissionNumber(s))}" ${hasPermanentAdmission?'disabled':''}></div>
    <div class="field"><label>SMS Contact</label><input id="es_sms" value="${escapeAttr(s.sms)}"></div>
    <div class="field"><label>Programme</label><select id="es_prog" data-qa-onchange="refreshEditClassOptions()">${progOpts}</select></div>
    <div class="field"><label>Class</label><select id="es_class">${classOpts}</select></div>
    <div class="field"><label>House</label><select id="es_house" data-current="${escapeAttr(s.houseId||'')}">${houseOpts}</select><div class="hint" id="es_house_hint">Only houses matching gender and residential status are shown.</div></div>
    <div class="field"><label>Registered</label><input value="${escapeAttr(s.reg)}" disabled style="opacity:.6"></div>
  </div></div>
  <div class="modal-foot"><button class="btn btn-danger" data-qa-onclick="deleteStudent(${id})" style="margin-right:auto">Delete student</button><button class="btn btn-ghost" data-qa-onclick="closeModal()">Cancel</button><button class="btn btn-primary" data-qa-onclick="saveStudent(${id})">Save changes</button></div>`;
  if(window.matchMedia('(min-width:1025px)').matches){const app=document.querySelector('.app');if(app)app.classList.remove('sidebar-hidden','sidebar-collapsed');}
  $('overlay').classList.add('show','manage-student-editor');
  requestAnimationFrame(positionManageStudentEditor);
}
async function deleteStudent(id){
  if(roGuard())return;
  const s=managedStudentById(id);if(!s)return;
  const note=s.submitted?'\n\nNote: this student has ALREADY SUBMITTED their admission — deleting removes their submitted records too.':'';
  if(!confirm('Delete student '+s.name+' ('+s.index+')?\n\nThis removes the student record, their placement entry, payments and tokens.'+note+'\n\nThis cannot be undone.'))return;
  if(!confirm('Final confirmation — permanently delete '+s.name+'?'))return;
  const {data,error}=await invokeFnDetailed('delete-student',{school_id:SB_SCHOOL.id,student_id:s._id});
  if(error){toast('Delete failed: '+error.message);return;}
  if(!data||!data.ok){toast('Delete failed: '+((data&&data.error)||'unknown'));return;}
  // best-effort: remove the uploaded enrolment-form file from storage
  if(data.form_url || (Array.isArray(data.form_paths)&&data.form_paths.length)){ try{ const pathSet=new Set((data.form_paths||[]).map(function(path){return String(path||'').trim();}).filter(Boolean)); const m=String(data.form_url||'').match(/enrolment-forms\/(.+)$/); if(m) pathSet.add(decodeURIComponent(m[1])); const paths=Array.from(pathSet); if(paths.length) await sb.storage.from('enrolment-forms').remove(paths); }catch(e){} }
  students=students.filter(x=>String(x._id)!==String(s._id));
  MANAGE_STATE.rows=(MANAGE_STATE.rows||[]).filter(x=>String(x._id)!==String(s._id));
  REG_STATE.rows=(REG_STATE.rows||[]).filter(x=>String(x._id)!==String(s._id));
  placement=placement.filter(x=>x.index!==s.index);
  payments=payments.filter(function(p){ return String(p.index||'')!==String(s.index); });
  if(data.finance_settled_adjusted&&SB_CFG){
    SB_CFG.finance_settled_students=Math.max((parseInt(SB_CFG.finance_settled_students,10)||0)-1,0);
  }
  selected.delete(id);
  notifyStudentPortalRefresh('student-delete',{index:s.index});
  closeModal(); renderStudents(); renderStats&&renderStats(); renderFinance&&renderFinance();
  toast('Student deleted'+(data.payments?(' - removed '+data.payments+' payment record(s)'):''));
}
async function saveStudent(id){
  if(roGuard())return;
  const s=managedStudentById(id);if(!s)return;
  const newName=val('es_name').trim();
  const newGender=normalizeStudentGender(val('es_gender'));
  const newResidential=normalizeResidentialStatus(val('es_residential'));
  const newAdm=val('es_adm').trim();
  const newSms=val('es_sms').trim();
  const newProgId=+val('es_prog');
  const newClassId=val('es_class')?+val('es_class'):null;
  const newHouseId=val('es_house')?+val('es_house'):null;
  if(!newName){toast('Name is required');return;}
  if(!newGender){toast('Gender is required');return;}
  if(!newResidential){toast('Residential status is required');return;}
  if(!newProgId||!pMap[newProgId]){toast('Programme is required');return;}
  if(newClassId){
    const selectedClass=classById(newClassId);
    if(!selectedClass||!selectedClass.progId||String(selectedClass.progId)!==String(newProgId)){toast('Select a class linked to the chosen programme.');return;}
  }
  if(newHouseId){
    const selectedHouse=houseById(newHouseId);
    const issue=houseAllocationIssue(selectedHouse);
    if(issue){toast(issue);return;}
    if(!houseEligibleForStudent(selectedHouse,{gender:newGender,res:newResidential})){toast('The selected house does not match the student gender and residential status.');return;}
  }
  const oldGender=normalizeStudentGender(s.gender);
  const oldResidential=normalizeResidentialStatus(s.res);
  const nextRecords=Object.assign({},s.rec||{},{residential_status:newResidential,residential:newResidential});
  const hasPermanentAdmission=!!String(s.permAdm||'').trim();
  const update={full_name:newName,gender:newGender,parent_phone:newSms||null,
    programme_id:pMap[newProgId]||null,
    class_id:newClassId?cMap[newClassId]:null,
    house_id:newHouseId?hMap[newHouseId]:null,
    records:nextRecords};
  if(!hasPermanentAdmission) update.admission_no=newAdm;
  const placementUpdate=await invokeFnDetailed('admin-placement-list',{action:'update',school_id:SB_SCHOOL.id,index_number:s.index,patch:{gender:genderLabel(newGender),residential_status:newResidential}});
  if(placementUpdate.error||!placementUpdate.data||placementUpdate.data.ok===false){toast('Save failed: '+((placementUpdate.data&&placementUpdate.data.message)||(placementUpdate.error&&placementUpdate.error.message)||'Could not update placement record.'));return;}
  const studentUpdate=await invokeFnDetailed('admin-students-list',{action:'update',school_id:SB_SCHOOL.id,student_id:s._id,patch:update});
  if(studentUpdate.error||!studentUpdate.data||studentUpdate.data.ok===false){
    await invokeFnDetailed('admin-placement-list',{action:'update',school_id:SB_SCHOOL.id,index_number:s.index,patch:{gender:genderLabel(oldGender),residential_status:oldResidential||null}});
    toast('Save failed: '+((studentUpdate.data&&studentUpdate.data.message)||(studentUpdate.error&&studentUpdate.error.message)||'Could not update the student record.'));return;
  }
  const savedClass=newClassId?classById(newClassId):null;
  const savedHouse=newHouseId?houseById(newHouseId):null;
  const copies=[...(students||[]),...(MANAGE_STATE.rows||[]),...(REG_STATE.rows||[])].filter(x=>String(x._id)===String(s._id));
  copies.forEach(function(item){item.name=newName;item.gender=newGender;item.res=newResidential;if(!hasPermanentAdmission)item.adm=newAdm||'—';item.sms=newSms||'—';item.smsRaw=newSms||'';item.progId=newProgId;item.prog=cleanSmsText((progById(newProgId)||{}).name)||item.prog||'';item.classId=newClassId;item.className=(savedClass&&savedClass.name)||'';item.houseId=newHouseId;item.houseUuid=newHouseId?hMap[newHouseId]:'';item.houseName=(savedHouse&&savedHouse.name)||'';item.house=item.houseName;item.rec=nextRecords;});
  notifyStudentPortalRefresh('student-update',{index:s.index});
  closeModal();renderStudents();toast('Student record saved');
}

/* ===== HOUSE & CLASS ALLOCATION ===== */
let haSel=new Set(), caSel=new Set();
function normalizeStudentGender(value){
  const gender=String(value||'').trim().toLowerCase();
  if(gender==='m'||gender==='male'||gender==='boy')return 'M';
  if(gender==='f'||gender==='female'||gender==='girl')return 'F';
  return '';
}
function normalizeResidentialStatus(value){
  const residential=String(value||'').trim().toLowerCase();
  if(residential==='boarding'||residential==='boarder'||residential==='resident'||residential==='b')return 'Boarding';
  if(residential==='day'||residential==='day student'||residential==='d')return 'Day';
  return '';
}
function genderLabel(g){const normalized=normalizeStudentGender(g);return normalized==='M'?'Male':normalized==='F'?'Female':(g||'—');}
function houseAllocationIssue(h){
  if(!h)return 'Pick a house';
  if(!normalizeStudentGender(h.gender))return 'Set the house gender before assigning students.';
  if(!normalizeResidentialStatus(h.rtype))return 'Set the house residential type before assigning students.';
  if(!Number.isFinite(Number(h.priority))||Number(h.priority)<1)return 'Set a valid priority order for the house.';
  if(!Number.isFinite(Number(h.cap))||Number(h.cap)<1)return 'Set a valid capacity for the house.';
  return '';
}
function houseMatchesGender(h,s){return !!h&&normalizeStudentGender(h.gender)!==''&&normalizeStudentGender(h.gender)===normalizeStudentGender(s&&s.gender);}
function houseMatchesResidential(h,s){return !!h&&normalizeResidentialStatus(h.rtype)!==''&&normalizeResidentialStatus(h.rtype)===normalizeResidentialStatus(s&&s.res);}
function houseEligibleForStudent(h,s){return houseMatchesGender(h,s)&&houseMatchesResidential(h,s);}
function allocationStudentOrder(a,b){
  const aTime=Date.parse((a&&a.submittedAt)||''), bTime=Date.parse((b&&b.submittedAt)||'');
  if(Number.isFinite(aTime)&&Number.isFinite(bTime)&&aTime!==bTime)return aTime-bTime;
  if(Number.isFinite(aTime)!==Number.isFinite(bTime))return Number.isFinite(aTime)?-1:1;
  const indexDiff=String((a&&a.index)||'').localeCompare(String((b&&b.index)||''),undefined,{numeric:true,sensitivity:'base'});
  return indexDiff||String((a&&a.name)||'').localeCompare(String((b&&b.name)||''),undefined,{sensitivity:'base'});
}
async function updateStudentAssignments(studentIds,patch){
  const result=await invokeFnDetailed('admin-students-list',{action:'batch_update',school_id:SB_SCHOOL&&SB_SCHOOL.id,student_ids:studentIds,patch:patch});
  if(result.error||!result.data||result.data.ok===false){
    return {ok:false,message:(result.data&&result.data.message)||(result.error&&result.error.message)||'Could not update student allocations'};
  }
  return {ok:true,data:result.data};
}
function fillSelKeep(sel,html){ if(!sel)return; const cur=sel.value; sel.innerHTML=html; if(cur&&[...sel.options].some(o=>o.value===cur)) sel.value=cur; }

function renderHouseAlloc(){
  const sel=$('haHouse'); if(!sel)return;
  fillSelKeep(sel, houses.length?sortLocalHouses(houses).map(h=>`<option value="${h.id}">Priority ${safeHtml(housePriorityValue(h,'-'))} · ${escapeHtml(h.name)} · ${escapeHtml(h.gender||'Gender not set')} · ${escapeHtml(h.rtype||'Residential type not set')}</option>`).join(''):'<option value="">No houses</option>');
  const hid=+sel.value||0, h=houseById(hid), gf=val('haGender');
  const members=students.filter(s=>s.houseId===hid).sort(allocationStudentOrder);
  const pool=students.filter(s=>!s.houseId && (!gf||normalizeStudentGender(s.gender)===normalizeStudentGender(gf)) && houseEligibleForStudent(h,s)).sort(allocationStudentOrder);
  const allowedIds=new Set(pool.map(s=>s.id));
  [...haSel].forEach(id=>{if(!allowedIds.has(id))haSel.delete(id);});
  $('haCount').textContent=members.length;
  $('haCap').textContent=h?('capacity '+(h.cap||'—')+(houseAllocationIssue(h)?' · configuration required':'')):'—';
  $('haUnCount').textContent=pool.length;
  $('haMembers').innerHTML=members.length?members.map(s=>`<tr><td class="mono">${safeHtml(s.index)}</td><td class="nm">${safeHtml(s.name)}</td><td>${safeHtml(genderLabel(s.gender),'&mdash;')}</td><td>${safeHtml(normalizeResidentialStatus(s.res)||s.res,'&mdash;')}${houseEligibleForStudent(h,s)?'':' <span class="pill closed">Mismatch</span>'}</td><td><div class="row-actions"><button class="act" data-qa-onclick="haRemove(${s.id})">Remove</button></div></td></tr>`).join(''):emptyRow(5,'No students in this house yet.');
  $('haPool').innerHTML=pool.length?pool.map(s=>`<tr><td><span class="checkbox ${haSel.has(s.id)?'on':''}" data-qa-onclick="haToggle(${s.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span></td><td class="mono">${safeHtml(s.index)}</td><td class="nm">${safeHtml(s.name)}</td><td>${safeHtml(genderLabel(s.gender),'&mdash;')}</td><td>${safeHtml(normalizeResidentialStatus(s.res)||s.res,'&mdash;')}</td></tr>`).join(''):emptyRow(5,houseAllocationIssue(h)||'No matching unassigned students.');
}
function haToggle(id){haSel.has(id)?haSel.delete(id):haSel.add(id);renderHouseAlloc();}
async function haAssignSelected(){
  if(roGuard())return;
  const hid=+val('haHouse')||0, h=houseById(hid); if(!h){toast('Pick a house');return;}
  const issue=houseAllocationIssue(h); if(issue){toast(issue);return;}
  if(!haSel.size){toast('Select students to assign');return;}
  const selectedStudents=[...haSel].map(i=>students.find(s=>s.id===i)).filter(Boolean);
  if(selectedStudents.some(s=>!houseEligibleForStudent(h,s))){toast('One or more selected students do not match the house gender and residential type.');renderHouseAlloc();return;}
  const capacity=Math.max(Number(h.cap)||0,0), current=students.filter(s=>s.houseId===hid).length, room=Math.max(capacity-current,0);
  if(selectedStudents.length>room){toast('Only '+room+' place'+(room===1?' is':'s are')+' available in '+h.name+'.');return;}
  const ids=selectedStudents.map(s=>s.id), uuids=selectedStudents.map(s=>s._id);
  const result=await updateStudentAssignments(uuids,{house_id:hMap[hid]});
  if(!result.ok){toast('Assign failed: '+result.message);return;}
  students.forEach(s=>{if(haSel.has(s.id))s.houseId=hid;});
  notifyStudentPortalRefresh('house-assign',{indexes:studentIndexListFromIds(ids)});
  activityLog.unshift({time:'Just now',action:'Allocated '+ids.length+' students to '+h.name,by:(SB_ADMIN_NAME||'Admin')});
  haSel.clear(); renderHouseAlloc(); renderStats&&renderStats(); toast('Assigned '+ids.length+' to '+h.name);
}
async function haRemove(id){
  if(roGuard())return;
  const s=students.find(x=>x.id===id); if(!s)return;
  const result=await updateStudentAssignments([s._id],{house_id:null});
  if(!result.ok){toast('Failed: '+result.message);return;}
  notifyStudentPortalRefresh('house-remove',{index:s.index});
  s.houseId=null; renderHouseAlloc(); toast('Removed from house');
}
async function haAutoFill(){
  if(roGuard())return;
  if(STUDENT_CACHE_STATE.loading){toast('Student records are still loading. Please wait a moment.');return;}
  if(!STUDENT_CACHE_STATE.loaded)await ensureStudentCache();
  if(!STUDENT_CACHE_STATE.loaded)return;
  const hid=+val('haHouse')||0, h=houseById(hid); if(!h){toast('Pick a house');return;}
  const issue=houseAllocationIssue(h); if(issue){toast(issue);return;}
  const cap=Math.max(Number(h.cap)||0,0), cur=students.filter(s=>s.houseId===hid).length, room=cap-cur;
  if(room<=0){toast('House is full');return;}
  const pool=students.filter(s=>!s.houseId && houseEligibleForStudent(h,s)).sort(allocationStudentOrder).slice(0,room);
  if(!pool.length){toast('No matching unassigned students');return;}
  const uuids=pool.map(s=>s._id);
  const result=await updateStudentAssignments(uuids,{house_id:hMap[hid]});
  if(!result.ok){toast('Auto-fill failed: '+result.message);return;}
  pool.forEach(s=>s.houseId=hid);
  notifyStudentPortalRefresh('house-autofill',{indexes:pool.map(function(s){ return s.index; })});
  activityLog.unshift({time:'Just now',action:'Auto-filled '+pool.length+' students into '+h.name,by:(SB_ADMIN_NAME||'Admin')});
  renderHouseAlloc(); renderStats&&renderStats(); toast('Auto-filled '+pool.length+' students');
}
async function haAutoAssignAll(){
  if(roGuard())return;
  if(STUDENT_CACHE_STATE.loading){toast('Student records are still loading. Please wait a moment.');return;}
  if(!STUDENT_CACHE_STATE.loaded)await ensureStudentCache();
  if(!STUDENT_CACHE_STATE.loaded)return;
  const orderedHouses=sortLocalHouses(houses).filter(h=>houseAllocationIssue(h)==='');
  const skipped=houses.length-orderedHouses.length;
  if(!orderedHouses.length){toast('Set a gender, residential type, priority and capacity for each house first.');return;}
  const plannedOccupancy=new Map(orderedHouses.map(h=>[h.id,students.filter(s=>s.houseId===h.id).length]));
  const assignments=new Map(orderedHouses.map(h=>[h.id,[]]));
  students.filter(s=>!s.houseId).sort(allocationStudentOrder).forEach(function(student){
    const eligible=orderedHouses.filter(function(h){
      return houseEligibleForStudent(h,student)&&(plannedOccupancy.get(h.id)||0)<Math.max(Number(h.cap)||0,0);
    }).sort(function(a,b){
      const occupancyDiff=(plannedOccupancy.get(a.id)||0)-(plannedOccupancy.get(b.id)||0);
      return occupancyDiff||housePriorityValue(a)-housePriorityValue(b)||String(a.name||'').localeCompare(String(b.name||''),undefined,{sensitivity:'base'});
    });
    const selected=eligible[0];
    if(!selected)return;
    assignments.get(selected.id).push(student);
    plannedOccupancy.set(selected.id,(plannedOccupancy.get(selected.id)||0)+1);
  });
  let assigned=0; const assignedIndexes=[];
  for(const h of orderedHouses){
    const candidates=assignments.get(h.id)||[];
    if(!candidates.length)continue;
    const result=await updateStudentAssignments(candidates.map(s=>s._id),{house_id:hMap[h.id]});
    if(!result.ok){renderHouseAlloc();toast('Auto-assignment stopped at '+h.name+': '+result.message);return;}
    candidates.forEach(s=>{s.houseId=h.id;assignedIndexes.push(s.index);});
    assigned+=candidates.length;
  }
  if(assignedIndexes.length)notifyStudentPortalRefresh('house-autoassign-all',{indexes:assignedIndexes});
  activityLog.unshift({time:'Just now',action:'Auto-assigned '+assigned+' students by house priority, gender and residential status',by:(SB_ADMIN_NAME||'Admin')});
  haSel.clear();renderHouseAlloc();renderStats&&renderStats();
  toast(assigned?('Assigned '+assigned+' student'+(assigned===1?'':'s')+' in house priority order'+(skipped?' · '+skipped+' unconfigured house'+(skipped===1?' was':'s were')+' skipped':'')):('No eligible unassigned students were found'+(skipped?' · '+skipped+' unconfigured house'+(skipped===1?' was':'s were')+' skipped':'')));
}

function renderClassAlloc(){
  const sel=$('caClass'); if(!sel)return;
  fillSelKeep(sel, classes.length?classes.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}${c.progId?' · '+escapeHtml(((progById(c.progId)||{}).name||'')):''}</option>`).join(''):'<option value="">No classes</option>');
  const cid=+sel.value||0, c=classById(cid);
  const members=students.filter(s=>s.classId===cid);
  const pool=students.filter(s=>!s.classId && c&&c.progId&&String(effectiveStudentProgrammeId(s)||'')===String(c.progId));
  $('caCount').textContent=members.length;
  $('caCap').textContent=c?('capacity '+(c.cap||'—')):'—';
  $('caUnCount').textContent=pool.length;
  $('caMembers').innerHTML=members.length?members.map(s=>`<tr><td class="mono">${safeHtml(s.index)}</td><td class="nm">${safeHtml(s.name)}</td><td>${safeHtml(studentProgrammeName(s),'-')}</td><td><div class="row-actions"><button class="act" data-qa-onclick="caRemove(${s.id})">Remove</button></div></td></tr>`).join(''):emptyRow(4,'No students in this class yet.');
  $('caPool').innerHTML=pool.length?pool.map(s=>`<tr><td><span class="checkbox ${caSel.has(s.id)?'on':''}" data-qa-onclick="caToggle(${s.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span></td><td class="mono">${safeHtml(s.index)}</td><td class="nm">${safeHtml(s.name)}</td><td>${safeHtml(studentProgrammeName(s),'-')}</td></tr>`).join(''):emptyRow(4,'No matching unassigned students.');
}
function caToggle(id){caSel.has(id)?caSel.delete(id):caSel.add(id);renderClassAlloc();}
async function caAssignSelected(){
  if(roGuard())return;
  const cid=+val('caClass')||0, c=classById(cid); if(!c){toast('Pick a class');return;}
  if(!c.progId){toast('Link this class to a programme before assigning students.');return;}
  if(!caSel.size){toast('Select students to assign');return;}
  const ids=[...caSel], chosen=ids.map(i=>students.find(s=>s.id===i)).filter(Boolean);
  if(chosen.some(function(s){return String(effectiveStudentProgrammeId(s)||'')!==String(c.progId);})){toast('One or more selected students do not belong to this class programme.');return;}
  const uuids=chosen.map(s=>s._id);
  const result=await updateStudentAssignments(uuids,{class_id:cMap[cid]});
  if(!result.ok){toast('Assign failed: '+result.message);return;}
  students.forEach(s=>{if(caSel.has(s.id))s.classId=cid;});
  notifyStudentPortalRefresh('class-assign',{indexes:studentIndexListFromIds(ids)});
  activityLog.unshift({time:'Just now',action:'Allocated '+ids.length+' students to '+c.name,by:(SB_ADMIN_NAME||'Admin')});
  caSel.clear(); renderClassAlloc(); renderStats&&renderStats(); toast('Assigned '+ids.length+' to '+c.name);
}
async function caRemove(id){
  if(roGuard())return;
  const s=students.find(x=>x.id===id); if(!s)return;
  const result=await updateStudentAssignments([s._id],{class_id:null});
  if(!result.ok){toast('Failed: '+result.message);return;}
  notifyStudentPortalRefresh('class-remove',{index:s.index});
  s.classId=null; renderClassAlloc(); toast('Removed from class');
}
async function caAutoFill(){
  if(roGuard())return;
  const cid=+val('caClass')||0, c=classById(cid); if(!c){toast('Pick a class');return;}
  const cap=c.cap||1000000, cur=students.filter(s=>s.classId===cid).length, room=cap-cur;
  if(room<=0){toast('Class is full');return;}
  if(!c.progId){toast('Link this class to a programme before auto-filling.');return;}
  const pool=students.filter(s=>!s.classId && String(effectiveStudentProgrammeId(s)||'')===String(c.progId)).slice(0,room);
  if(!pool.length){toast('No matching unassigned students');return;}
  const uuids=pool.map(s=>s._id);
  const result=await updateStudentAssignments(uuids,{class_id:cMap[cid]});
  if(!result.ok){toast('Auto-fill failed: '+result.message);return;}
  pool.forEach(s=>s.classId=cid);
  notifyStudentPortalRefresh('class-autofill',{indexes:pool.map(function(s){ return s.index; })});
  activityLog.unshift({time:'Just now',action:'Auto-filled '+pool.length+' students into '+c.name,by:(SB_ADMIN_NAME||'Admin')});
  renderClassAlloc(); renderStats&&renderStats(); toast('Auto-filled '+pool.length+' students');
}

/* ===== FINANCE ===== */
function printSchoolFinanceRequest(){
  if(!SB_SCHOOL){ toast('School profile is still loading.'); return; }
  const snap=schoolFinanceSnapshot();
  if(!snap.dueStudents){ toast('No pending school claim is available right now.'); return; }
  const refNo=financeReferenceNumber(SB_CFG&&SB_CFG.academic_year,SB_CFG&&SB_CFG.finance_claim_count);
  const headTitle=cleanSmsText((SB_SCHOOL&&SB_SCHOOL.headmaster_title)||'Head of School').toUpperCase();
  const pagesHTML=
    financeClaimPageHTML({
      schoolName:(SB_SCHOOL&&SB_SCHOOL.name)||'School Name',
      sectionTitle:'REQUEST FOR PAYMENT DETAILS - IT AND ADMISSIONS TEAM',
      studentsCount:snap.dueStudents,
      rateText:moneyBare(FINANCE_IT_RATE),
      gross:snap.itGross,
      charge:snap.itCharge,
      net:snap.itNet,
      referenceNo:refNo
    })+
    financeClaimPageHTML({
      schoolName:(SB_SCHOOL&&SB_SCHOOL.name)||'School Name',
      sectionTitle:'REQUEST FOR PAYMENT DETAILS - '+headTitle,
      studentsCount:snap.dueStudents,
      rateText:moneyBare(FINANCE_HEAD_RATE),
      gross:snap.headGross,
      charge:snap.headCharge,
      net:snap.headNet,
      referenceNo:refNo
    });
  openFinanceClaimPrintWindow(((SB_SCHOOL&&SB_SCHOOL.name)||'School')+' Claim Form',pagesHTML);
}
function renderFinance(){
  if(financePaymentsLoadError){
    $('finStats').innerHTML='<div class="stat" style="grid-column:1/-1"><div class="top"><span class="lbl">Financial data unavailable</span></div><div class="delta">'+safeHtml(financePaymentsLoadError)+'</div></div>';
    $('financeSettlementRows').innerHTML=emptyRow(8,'Financial data could not be loaded. Refresh the page or contact support.');
    $('payRows').innerHTML=emptyRow(7,'Transactions could not be loaded.');
    $('financePayMeta').textContent='Financial data unavailable';
    return;
  }
  const snap=schoolFinanceSnapshot();
  const stats=[
    {l:'Successful Student Payments',v:fmt(snap.completedStudents),ico:'users',d:'unique completed token payments'},
    {l:'Due Successful Payments',v:fmt(snap.dueStudents),ico:'door',d:'unclaimed paid-token records'},
    {l:'Successful Payments Paid',v:fmt(snap.paidStudents),ico:'school',d:'already settled'},
    {l:'Amount Paid',v:snap.paidAmount,cur:1,ico:'cash',d:'IT + Head successful-payment share paid so far'},
  ];
  const icons={school:'<path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/>',users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',door:'<path d="M13 3v18M3 21h18M6 21V5a2 2 0 0 1 2-2h7"/>',cash:'<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'};
  $('finStats').innerHTML=stats.map(function(c){ return `<div class="stat"><div class="top"><span class="lbl">${c.l}</span><span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icons[c.ico]}</svg></span></div><div class="val">${c.cur?'<span class="cur">GHS</span>'+moneyBare(c.v):c.v}</div><div class="delta">${c.d}</div></div>`; }).join('');
  $('financeSettlementRows').innerHTML=`<tr>
    <td><div class="finance-index mono">1</div></td>
    <td>
      <div class="finance-school-cell">
        <div class="sch-cell"><span class="finance-school-name">${safeHtml((SB_SCHOOL&&SB_SCHOOL.name)||'School Name')}</span></div>
        <div class="finance-school-meta"><span class="code">${safeHtml((SB_SCHOOL&&((SB_SCHOOL.school_code)||(SB_SCHOOL.code)))||'-')}</span></div>
      </div>
    </td>
    <td>
        <div class="finance-registered-block">
        <div class="finance-registered-count">${safeHtml(fmt(snap.completedStudents))} Out of ${safeHtml(fmt(snap.total))}</div>
        <div class="finance-summary-sub">Submitted admission forms: ${safeHtml(fmt(snap.registered))}</div>
        <div>
          <div class="finance-history-label">Settlement History:</div>
          <div class="finance-history-paid">Already claimed for ${safeHtml(fmt(snap.paidStudents))} students - GHC${safeHtml(moneyBare(snap.paidAmount))}</div>
          <div class="finance-summary-sub">Completed payment records: ${safeHtml(fmt(snap.completedStudents))}</div>
        </div>
        <div>
          <div class="finance-due-label">Due Successful Payments:</div>
          <div class="finance-due-count">No of payments: ${safeHtml(fmt(snap.dueStudents))}</div>
        </div>
      </div>
    </td>
    <td>
      <div class="finance-split">
        <div class="finance-split-group">
          <h4>IT / Contact Person</h4>
          <div class="finance-split-amount">${safeHtml(moneyBare(snap.itGross))}</div>
          <div class="finance-split-line">Momo/Bank charges: ${safeHtml(moneyBare(snap.itCharge))}</div>
          <div class="finance-split-line"><strong>To Pay: ${safeHtml(moneyBare(snap.itNet))}</strong></div>
        </div>
        <div class="finance-split-group">
          <h4>${safeHtml((SB_SCHOOL&&SB_SCHOOL.headmaster_title)||'Head')}</h4>
          <div class="finance-split-amount">${safeHtml(moneyBare(snap.headGross))}</div>
          <div class="finance-split-line">Momo/Bank charges: ${safeHtml(moneyBare(snap.headCharge))}</div>
          <div class="finance-split-line"><strong>To Pay: ${safeHtml(moneyBare(snap.headNet))}</strong></div>
        </div>
      </div>
      <button class="btn btn-primary btn-sm finance-request-btn" data-qa-onclick="printSchoolFinanceRequest()">Print Request Form</button>
      <div class="finance-aux-copy">Reset history is controlled from the Super Admin portal after each school claim.</div>
    </td>
    <td><div class="finance-total mono">${safeHtml(moneyBare(snap.totalGross))}</div></td>
    <td><span class="finance-paid-flag ${snap.claimStatus.toLowerCase()}">${snap.claimStatus}</span></td>
    <td><div class="finance-paid-students mono">${safeHtml(fmt(snap.paidStudents))}</div><div class="finance-summary-sub">successful payments paid</div></td>
    <td><div class="finance-paid-amount mono">GHC${safeHtml(moneyBare(snap.paidAmount))}</div></td>
  </tr>`;
  renderFinancePayments();
}

/* ===== SMS ===== */
var smsPrefillProgramme='all';
function canonicalSmsIndex(value){return String(value||'').trim().toUpperCase();}
function buildSmsProgrammes(){
  var sel=$('smsProgramme'); if(!sel)return;
  var cur=sel.value||smsPrefillProgramme||'all';
  var programmeNames={};
  placement.forEach(function(row){
    var key=cleanSmsText(row.prog)||'Unassigned';
    programmeNames[key]=true;
  });
  var esc=function(v){ return String(v||'').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"'); };
  var opts=['<option value="all">- Select -</option>'];
  Object.keys(programmeNames).sort(function(a,b){ return a.localeCompare(b); }).forEach(function(name){
    opts.push('<option value="'+esc(name)+'">'+esc(name)+' ('+smsTargets(name).length+')</option>');
  });
  sel.innerHTML=opts.join('');
  if(cur && Array.from(sel.options).some(function(o){ return o.value===cur; })) sel.value=cur;
  else sel.value='all';
  smsPrefillProgramme='all';
}
function validPhone(p){ return /\d{9,}/.test(((p||'')+'').replace(/\D/g,'')); }
function smsGroupLabel(){
  var prog=($('smsProgramme')&&$('smsProgramme').value)||'all';
  return prog==='all' ? 'All placed students' : 'Programme: '+prog;
}
function smsTargetName(row){
  return studentDisplayNameByIndex(row.index,row.name||'Student');
}
function smsTargets(programmeOverride){
  var prog=arguments.length?programmeOverride:(($('smsProgramme')&&$('smsProgramme').value)||'all');
  var list=placement.slice();
  if(prog!=='all') list=list.filter(function(row){ return cleanSmsText(row.prog)===prog; });
  var merged={}, dup=0;
  list.forEach(function(row){
    var idx=String(row.index||'').trim();
    if(!idx) return;
    var phone=placementSmsContact(row);
    if(!merged[idx]){ merged[idx]={row:row, phone:phone}; return; }
    dup++;
    if(!validPhone(merged[idx].phone) && validPhone(phone)) merged[idx]={row:row, phone:phone};
  });
  var targets=[], missing=0, sent=0;
  Object.keys(merged).forEach(function(idx){
    var item=merged[idx], phone=cleanSmsText(item.phone);
    if(smsDeliveredIndexes.has(canonicalSmsIndex(idx))){ sent++; return; }
    var student=students.find(function(row){ return String(row.index)===String(idx); })||null;
    if(!validPhone(phone)){ missing++; return; }
    targets.push({index:idx,studentId:(student&&student._id)||null,name:smsTargetName(item.row),prog:cleanSmsText(item.row.prog),sms:phone});
  });
  targets.sort(function(a,b){ return a.name.localeCompare(b.name)||a.index.localeCompare(b.index); });
  targets.total=list.length;
  targets.missing=missing;
  targets.duplicates=dup;
  targets.sent=sent;
  return targets;
}
function smsParts(t){return Math.max(1,Math.ceil((t||'').length/160));}
function smsReportingText(){
  var bits=[SB_CFG&&SB_CFG.reopening_date,SB_CFG&&SB_CFG.reopening_time].filter(Boolean);
  return bits.length?bits.join(' '):((typeof REPORTING_DATE!=='undefined'&&REPORTING_DATE)||'the reporting date');
}
function smsHelpdeskText(){
  return (SB_SCHOOL&&SB_SCHOOL.helpdesk)||(SB_SCHOOL&&SB_SCHOOL.phone)||(SB_CFG&&SB_CFG.helpdesk)||'';
}
function personalize(tpl,s){
  return (tpl||'')
    .replace(/\{STUDNAME\}/g, s.name||'')
    .replace(/\{NAME\}/g, s.name||'')
    .replace(/\{INDEX\}/g, s.index||'')
    .replace(/\{SCHOOL\}/g, (SB_SCHOOL&&SB_SCHOOL.name)|| (typeof SCHOOL_NAME!=='undefined'?SCHOOL_NAME:'') || 'the school')
    .replace(/\{PROGRAMME\}/g, studentProgrammeName(s).replace(/^-$/,''))
    .replace(/\{REPORTING\}/g, smsReportingText())
    .replace(/\{HELPDESK\}/g, smsHelpdeskText());
}
function insVar(v){var t=$('smsBody');var st=t.selectionStart||t.value.length;t.value=t.value.slice(0,st)+v+t.value.slice(t.selectionEnd||st);updateSms();t.focus();}
function loadTpl(v){
  const t={
    reminder:'Hello {STUDNAME}, congratulations on your placement to {SCHOOL}. Complete your admission online before {REPORTING}. For help, call {HELPDESK}.',
    payment:'Hi {STUDNAME}, your {SCHOOL} admission login uses index {INDEX}. Keep your token safe and complete your admission online as soon as possible.',
    docs:'Dear {STUDNAME}, please complete your Personal Records Form and download your admission documents on the {SCHOOL} portal before {REPORTING}.',
    welcome:'Congratulations {STUDNAME}! You have been placed at {SCHOOL}. Complete your admission online at https://www.quickadmissiongh.com/ using your BECE Index Number. For assistance, call {HELPDESK}.'
  };
  if(t[v]){$('smsBody').value=t[v];updateSms();}
}
function updateSms(){
  var body=($('smsBody').value||''); if(body.length>300){ body=body.slice(0,300); $('smsBody').value=body; } var parts=smsParts(body);
  var targets=smsTargets(); var n=targets.length; var cost=parts*n;
  if($('smsRemain'))$('smsRemain').textContent=Math.max(0,300-body.length);
  $('smsCred').textContent=parts;
  if($('smsCost'))$('smsCost').textContent=cost;
  $('smsRecip').textContent=n;
  if($('smsRecipMeta'))$('smsRecipMeta').innerHTML='<b>'+n+'</b> ready';
  if($('smsSkipMeta'))$('smsSkipMeta').innerHTML='<b>'+(targets.missing||0)+'</b> without SMS contact';
  if($('smsDupMeta'))$('smsDupMeta').innerHTML='<b>'+(targets.duplicates||0)+'</b> duplicate records removed';
  $('smsBalance').textContent=fmt(smsBalance);
  var pv=$('smsPreview');
  if(pv){
    if(n){
      pv.textContent=n+' recipient'+(n===1?'':'s')+' ready from '+smsGroupLabel()+'. '+(targets.sent||0)+' already sent by index, '+(targets.missing||0)+' without SMS contact'+((targets.duplicates||0)?' - '+targets.duplicates+' duplicate record(s) removed':'')+'.';
    }else{
      pv.textContent=(targets.sent||0)
        ? '0 recipients ready from '+smsGroupLabel()+'. All '+targets.sent+' student'+(targets.sent===1?' has':'s have')+' already received the SMS.'
        : 'No recipients with a valid SMS contact in the selected programme.';
    }
    pv.className='sms-preview'+(n?'':' empty'); }
}
function buyCredits(){ toast('Provider billing and SMS credit management are handled by the platform configuration.'); }
sendSms=async function(){
  if(roGuard())return;
  const tpl=(val('smsBody')||'').trim(); if(!tpl){toast('Type a message first');return;}
  const targets=smsTargets(); const n=targets.length;
  if(!n){toast('No recipients with a valid SMS contact in the selected programme');return;}
  if(!confirm('Send this SMS to '+n+' recipient(s) in '+smsGroupLabel()+'?'))return;
  const group=smsGroupLabel();
  if(SB_SMS_SETTINGS&&SB_SMS_SETTINGS.sms_enabled===false){toast('SMS is currently disabled for this school. Enable it under SMS Settings first.');return;}
  const btn=event&&event.target?event.target.closest('button'):null; if(btn){ btn.disabled=true; btn.textContent='Sending...'; }
  try{
    const messages=targets.map(function(target){
      return {to:target.sms,body:personalize(tpl,target),student_id:target.studentId||null,student_index:target.index||null};
    }).filter(function(msg){ return !!msg.to&&!!msg.body; });
    const {data,error}=await invokeFnDetailed('send-sms',{
      mode:'bulk',
      school_id:SB_SCHOOL.id,
      group:group,
      template:tpl,
      template_name:(document.getElementById('smsTpl')&&document.getElementById('smsTpl').value)||null,
      messages:messages
    });
    if(error||(data&&data.error)){toast('SMS send failed: '+((data&&data.message)||(error&&error.message)||'error'));return;}
    if(data&&data.balance!=null&&!Number.isNaN(Number(data.balance))){ smsBalance=Number(data.balance); if(SB_CFG)SB_CFG.sms_balance=smsBalance; }
    [].concat((data&&data.sent_indices)||[],(data&&data.skipped_indices)||[]).forEach(function(index){
      var key=canonicalSmsIndex(index); if(key)smsDeliveredIndexes.add(key);
    });
    const sentCount=Number((data&&data.sent)||0);
    const failedCount=Number((data&&data.failed)||0);
    const skippedCount=Number((data&&data.skipped)||0);
    if(sentCount||failedCount){
      smsHistory.unshift({date:new Date().toISOString().slice(0,10),group,recip:sentCount+failedCount,msg:tpl,status:(data&&data.status)||'sent'});
      document.getElementById('smsBody').value=''; if($('smsTpl')) $('smsTpl').value=''; renderSms(); renderStats();
    }
    if(skippedCount && !sentCount && !failedCount){ renderSms(); toast((data&&data.message)||('All matching students already received this SMS.')); }
    else if(failedCount && sentCount){ toast('SMS finished: '+sentCount+' sent, '+failedCount+' failed'+(skippedCount?(', '+skippedCount+' skipped (already sent)'):'')+'.'); }
    else if(failedCount){ toast('SMS finished: '+failedCount+' failed'+(skippedCount?(', '+skippedCount+' skipped (already sent)'):'')+'.'); }
    else if(skippedCount){ toast((data&&data.message)||('SMS finished: '+sentCount+' sent, '+skippedCount+' skipped (already sent).')); }
    else { toast((data&&data.message)||('Sent to '+(data&&data.sent!=null?data.sent:n)+' recipient(s).')); }
  }finally{
    if(btn){ btn.disabled=false; btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Send SMS to Selected Candidates (<span id="smsRecip">'+n+'</span>)'; }
  }
};
function renderSms(){
  buildSmsProgrammes();
  if($('smsSender')) $('smsSender').value=schoolSenderId()||'';
  $('smsRows').innerHTML=smsHistory.length?smsHistory.map(h=>`<tr><td class="mono">${safeHtml(h.date)}</td><td>${safeHtml(h.group)}</td><td class="mono">${safeHtml(h.recip)}</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${safeHtml(h.msg)}</td><td><span class="pill ${h.status==='sent'?'open':(h.status==='failed'?'closed':'pending')}">${safeHtml(h.status)}</span></td></tr>`).join(''):emptyRow(5,'No messages logged yet.');
  if($('smsBody') && !$('smsBody').value) loadTpl('welcome');
  fillSmsSettingsForm();
  updateSms();
}
async function loadSmsHistory(){
  if(!SB_SCHOOL||!SB_SCHOOL.id||SMS_HISTORY_STATE.loaded||SMS_HISTORY_STATE.loading)return;
  SMS_HISTORY_STATE.loading=true;
  const res=await fetchSchoolSmsHistory(SB_SCHOOL.id);
  SMS_HISTORY_STATE.loading=false;
  if(res&&res.error){toast('Could not load SMS history: '+res.error.message);return;}
  if(!res||!res.data||res.data.ok===false){toast('Could not load SMS history: '+((res&&res.data&&res.data.message)||'unknown error'));return;}
  smsHistory=(res.data.rows||[]).map(function(s){return {date:(s.sent_at||'').slice(0,10),group:s.recipient_group,recip:s.recipients,msg:s.message,status:s.status};});
  smsDeliveredIndexes=new Set((res.data.delivered_indices||[]).map(canonicalSmsIndex).filter(Boolean));
  SMS_HISTORY_STATE.loaded=true;
  renderSms();
}


/* ===== REPORTS ===== */
let charts={};
function buildCharts(){
  Object.values(charts).forEach(c=>c&&c.destroy());
  Chart.defaults.font.family="'Inter',sans-serif";Chart.defaults.font.size=11;Chart.defaults.color='#8A9893';
  const hasLocal=students.length>0;
  const m=hasLocal?students.filter(s=>s.gender==='M').length:summaryNumber('male',0),f=hasLocal?students.length-m:summaryNumber('female',0);
  const summary=studentSummaryData();
  const programmeCounts=summary.programmes||{},houseCounts=summary.houses||{};
  charts.g=new Chart($('genderChart'),{type:'doughnut',data:{labels:['Male','Female'],datasets:[{data:[m,f],backgroundColor:['#1557B0','#D2941A'],borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:12}}}}});
  charts.p=new Chart($('progChart'),{type:'bar',data:{labels:programmes.map(p=>p.code),datasets:[{data:programmes.map(p=>hasLocal?students.filter(s=>s.progId===p.id).length:Number(programmeCounts[p._id]||0)),backgroundColor:'#1557B0',borderRadius:6,barThickness:30}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{grid:{color:'#EEF1EF'},beginAtZero:true}}}});
  charts.h=new Chart($('houseChart'),{type:'bar',data:{labels:houses.map(h=>h.name),datasets:[{data:houses.map(h=>hasLocal?students.filter(s=>s.houseId===h.id).length:Number(houseCounts[h._id]||0)),backgroundColor:houses.map(h=>h.color),borderRadius:6,barThickness:30}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'#EEF1EF'},beginAtZero:true},y:{grid:{display:false}}}}});
}

/* ===== DOC LINES + LOG ===== */
function renderDocLines(){$('docLines').innerHTML=docLines.map((l,i)=>`<div class="doc-line"><span class="num">${i+1}</span><textarea data-qa-oninput="qaSetDocLineValue(${i},this.value)" rows="2">${escapeHtml(l)}</textarea></div>`).join('');}
async function savePortalSetup(){
  if(roGuard())return;
  if(!SB_SCHOOL){toast('School not loaded');return;}
  const lines=docLines.slice(0,5).map(x=>(x||'').trim());
  while(lines.length<5)lines.push('');
  const patch={
    req_doc_line1:lines[0],req_doc_line2:lines[1],req_doc_line3:lines[2],req_doc_line4:lines[3],req_doc_line5:lines[4],
    show_personal_records:!!($('portal_show_records')&&$('portal_show_records').checked),
    personal_records_caption:(val('portal_records_caption')||'PERSONAL RECORDS FORM').trim(),
    show_undertaking:!!($('portal_show_undertaking')&&$('portal_show_undertaking').checked),
    undertaking_caption:(val('portal_undertaking_caption')||'UNDERTAKING / MEDICAL FORM').trim(),
    show_programme_selection:!!($('portal_show_programme')&&$('portal_show_programme').checked),
    programme_selection_caption:(val('portal_programme_caption')||'PROGRAMME / SUBJECT COMBINATION').trim()
  };
  const {data,error}=await invokeFnDetailed('manage-school-settings',{action:'portal_setup',school_id:SB_SCHOOL.id,patch});
  if(error||(data&&data.ok===false)){toast('Could not save portal setup: '+((data&&data.message)||(error&&error.message)||'error'));return;}
  docLines=lines;
  if(SB_CFG&&data&&data.config) Object.assign(SB_CFG,data.config);
  notifyStudentPortalRefresh('portal-setup');
  toast('Student portal configuration saved');
}
async function saveAnnouncement(){
  if(roGuard())return;
  if(!SB_SCHOOL){toast('School not loaded');return;}
  const patch={announcement:(val('s_announcement')||'').trim()||null};
  const {data,error}=await invokeFnDetailed('manage-school-settings',{action:'announcement',school_id:SB_SCHOOL.id,patch});
  if(error||(data&&data.ok===false)){toast('Could not publish announcement: '+((data&&data.message)||(error&&error.message)||'error'));return;}
  if(SB_CFG&&data&&data.config)Object.assign(SB_CFG,data.config);
  cachePublicSchoolProfile({announcement:patch.announcement||''});
  notifyStudentPortalRefresh('announcement');
  toast(patch.announcement?'Announcement published':'Announcement cleared');
}
async function saveSchoolProfile(){
  if(roGuard()) return;
  if(!SB_SCHOOL){toast('School not loaded');return;}
  const name=val('sp_name').trim();
  if(!name){toast('School name is required');return;}
  const patch={
    name:name,
    address:val('sp_address').trim(),
    phone:val('sp_phone').trim(),
    email:val('sp_email').trim(),
    headmaster_name:val('sp_headmaster').trim(),
    headmaster_title:val('sp_headmaster_title').trim()||'Head of School',
    helpdesk:val('sp_helpdesk').trim(),
    theme_color:SB_SCHOOL.theme_color||'#002B4C'
  };
  const {data,error}=await invokeFnDetailed('manage-school-settings',{action:'profile',school_id:SB_SCHOOL.id,patch});
  if(error||(data&&data.ok===false)){toast('Could not save school profile: '+((data&&data.message)||(error&&error.message)||'error'));return;}
  Object.assign(SB_SCHOOL,(data&&data.school)||patch);
  const nm=$('brandName'); if(nm) nm.textContent=SB_SCHOOL.name||'School Name';
  cachePublicSchoolProfile();
  notifyStudentPortalRefresh('school-profile');
  fillSmsSettingsForm();
  toast('School profile saved');
}
async function saveSmsSettings(){
  if(roGuard()) return;
  if(!SB_SCHOOL){toast('School not loaded');return;}
  const template=(val('smsset_template')||'').trim()||DEFAULT_SUBMISSION_SMS_TEMPLATE;
  const smsEnabled=(val('smsset_enabled')||'yes')!=='no';
  const patch={submission_message:template,sms_enabled:smsEnabled};
  const {data,error}=await invokeFnDetailed('manage-school-settings',{action:'sms_settings',school_id:SB_SCHOOL.id,patch});
  if(error||(data&&data.ok===false)){toast('Could not save SMS settings: '+((data&&data.message)||(error&&error.message)||'error'));return;}
  SB_SMS_SETTINGS=Object.assign({},SB_SMS_SETTINGS||{},(data&&data.settings)||patch,{school_id:SB_SCHOOL.id});
  fillSmsSettingsForm();
  toast('SMS settings saved');
}
async function sendTestSms(){
  if(roGuard()) return;
  if(!SB_SCHOOL){toast('School not loaded');return;}
  const phone=(val('smsset_test_phone')||'').trim();
  if(!phone){toast('Enter a phone number first');return;}
  const btn=event&&event.target?event.target.closest('button'):null;
  if(btn){ btn.disabled=true; btn.textContent='Sending...'; }
  try{
    const {data,error}=await invokeFnDetailed('send-sms',{mode:'test',school_id:SB_SCHOOL.id,phone:phone});
    if(error||(data&&data.error)){toast('Test SMS failed: '+((data&&data.message)||(error&&error.message)||'error'));return;}
    if(data&&data.balance!=null&&!Number.isNaN(Number(data.balance))) smsBalance=Number(data.balance);
    await loadSchoolData({full_name:SB_ADMIN_NAME,role:(SB_PERMS==null?'super_admin':'school_admin'),permissions:SB_PERMS,school_id:(SB_SCHOOL&&SB_SCHOOL.id)||null});
    go('sms-settings');
    toast((data&&data.message)||'Test SMS sent successfully');
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='Send Test SMS'; }
  }
}
function renderLog(){$('logRows').innerHTML=activityLog.length?activityLog.map(l=>`<tr><td class="mono" style="font-size:12px">${safeHtml(l.time)}</td><td>${safeHtml(l.action)}</td><td>${safeHtml(l.by)}</td></tr>`).join(''):emptyRow(3,'No activity logged yet.');renderArchives();}
async function loadActivityLog(){
  if(!SB_SCHOOL||!SB_SCHOOL.id||ACTIVITY_LOG_STATE.loaded||ACTIVITY_LOG_STATE.loading)return;
  ACTIVITY_LOG_STATE.loading=true;
  const {data,error}=await invokeFnDetailed('admin-activity-list',{school_id:SB_SCHOOL.id});
  ACTIVITY_LOG_STATE.loading=false;
  if(error){toast('Could not load activity log: '+error.message);return;}
  if(!data||data.ok===false){toast('Could not load activity log: '+((data&&data.message)||'unknown error'));return;}
  activityLog=(data.rows||[]).map(function(row){return {time:fmtT(row.created_at),action:row.action,by:row.actor||'—'};});
  ACTIVITY_LOG_STATE.loaded=true;
  renderLog();
}
const DOC_COL={prospectus:'prospectus_url',undertaking:'undertaking_url',subjects:'subjects_url'};
function showSchoolDocLink(kind,url){
  const a=document.getElementById('doc_'+kind+'_link'); if(!a)return;
  if(url){ a.href=url; a.style.display='inline'; } else { a.style.display='none'; }
}
async function uploadSchoolDoc(kind,inp){
  if(roGuard()){inp.value='';return;}
  const f=inp.files&&inp.files[0]; inp.value='';
  if(!f)return;
  if(!SB_SCHOOL){toast('School not loaded');return;}
  if(f.size>10*1024*1024){toast('File too large — max 10 MB');return;}
  toast('Uploading…');
  const ext=(f.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'');
  const path=SB_SCHOOL.id+'/'+kind+'_'+Date.now()+'.'+ext;
  const {error}=await sb.storage.from('school-docs').upload(path,f,{contentType:f.type||'application/octet-stream',upsert:true});
  if(error){toast('Upload failed: '+error.message);return;}
  const {data:pub}=sb.storage.from('school-docs').getPublicUrl(path);
  const col=DOC_COL[kind];
  const docRes=await invokeFnDetailed('manage-school-settings',{action:'doc_url',school_id:SB_SCHOOL.id,patch:{kind,url:pub.publicUrl}});
  if(docRes.error||(docRes.data&&docRes.data.ok===false)){toast('Saved file but could not record: '+((docRes.data&&docRes.data.message)||(docRes.error&&docRes.error.message)||'error'));return;}
  if(SB_CFG) SB_CFG[col]=pub.publicUrl;
  showSchoolDocLink(kind,pub.publicUrl);
  notifyStudentPortalRefresh('school-doc');
  toast(({prospectus:'Prospectus',undertaking:'Acceptance / Undertaking',subjects:'Subject Combination'}[kind])+' uploaded');
}
async function renderArchives(){
  const tb=$('archiveRows'); if(!tb)return;
  if(!SB_SCHOOL){tb.innerHTML=emptyRow(6,'No school loaded.');return;}
  tb.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:16px">Loading…</td></tr>';
  const {data,error}=await sb.rpc('list_archived_years',{p_school:SB_SCHOOL.id});
  if(error){tb.innerHTML=emptyRow(6,'Could not load archives.');return;}
  const rows=Array.isArray(data)?data:[];
  if(!rows.length){tb.innerHTML=emptyRow(6,'No other saved years yet.');return;}
  tb.innerHTML=rows.map(r=>`<tr>
    <td class="nm">${(r.academic_year||'—')}</td>
    <td class="mono">${r.students||0}</td>
    <td class="mono">${r.placements||0}</td>
    <td class="mono">${r.payments||0}</td>
    <td class="mono" style="font-size:12px">${(r.archived_at||'').slice(0,10)}</td>
    <td><div class="row-actions"><button class="act" data-qa-onclick="restoreArchive('${encodeURIComponent(r.academic_year||'')}')">Switch to this year</button></div></td>
  </tr>`).join('');
}
async function restoreArchive(encYear){
  if(roGuard())return;
  if(!SB_SCHOOL)return;
  const year=decodeURIComponent(encYear);
  const cur=(SB_CFG&&SB_CFG.academic_year)||'';
  const msg='Switch to "'+year+'"?\n\n'
    +(cur&&cur!==year?('Your current year "'+cur+'" will be saved and set aside, then '):'Then ')
    +'"'+year+'" becomes the active year with all its students, placements and payments editable again.\n\nNothing is deleted — you can switch back any time.\n\nContinue?';
  if(!confirm(msg))return;
  toast('Switching to '+year+'…');
  const {data,error}=await sb.rpc('switch_academic_year',{p_school:SB_SCHOOL.id,p_new_year:year});
  if(error){toast('Switch failed: '+error.message);return;}
  if(!data||!data.ok){toast('Switch failed: '+((data&&data.error)||'unknown'));return;}
  notifyStudentPortalRefresh('academic-year-switch');
  alert('Year "'+year+'" is now active and editable.\n\n• '+data.students+' students\n• '+data.placements+' placements\n• '+data.payments+' payments'
    +'\n\nYour previous year ("'+(data.old_year||cur)+'") was saved and can be switched back to.');
  await loadSchoolData({full_name:SB_ADMIN_NAME,role:(SB_PERMS==null?'super_admin':'school_admin'),permissions:SB_PERMS,school_id:(SB_SCHOOL&&SB_SCHOOL.id)||null});
  go('dashboard');
}
function emptyRow(c,m){return `<tr><td colspan="${c}"><div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><div>${m}</div></div></td></tr>`;}

/* ===== TABS ===== */
function setupTab(i){document.querySelectorAll('#setupTabs .tab').forEach((t,x)=>t.classList.toggle('active',x===i));document.querySelectorAll('#view-setup .tab-panel').forEach(p=>p.classList.toggle('active',p.dataset.tab==i));}

/* ===== SELECTS ===== */
function fillSelects(){
  const opts='<option value="all">All programmes</option>'+programmes.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  $('stuProg').innerHTML=opts;
  $('pl_prog').innerHTML=programmes.map(p=>`<option>${escapeHtml(p.name)}</option>`).join('');
}

/* ===== NAV ===== */
/* ===== REGISTERED STUDENTS (View Students) ===== */
var regSort={key:'reg',dir:'desc'};
var regExpanded=new Set();
var regCols=['index','adm','name','reg','time','sms','enrol','form'];
var regColLabels={index:'JHS Index No',adm:'Admission #',name:'Student Name',reg:'Date Registered',time:'Time',sms:'SMS Contact',enrol:'Enrolment Code',form:'Enrolment Form'};
var regHidden=new Set();
var REG_STATE={page:1,pageSize:50,total:0,totalPages:1,rows:[],loading:false};
var regSearchTimer=0;
var MANAGE_STATE={page:1,pageSize:50,total:0,totalPages:1,rows:[],loading:false};
var manageSearchTimer=0;
var STUDENT_CACHE_STATE={loaded:false,loading:false};
function buildColvis(){
  var m=document.getElementById('colvisMenu'); if(!m)return;
  m.onclick=function(e){e.stopPropagation();};
  m.innerHTML=regCols.map(k=>`<label><input type="checkbox" ${regHidden.has(k)?'':'checked'} data-qa-onchange="toggleColumn('${k}')"> ${regColLabels[k]}</label>`).join('');
}
function toggleColvis(e){e.stopPropagation();document.getElementById('colvisMenu').classList.toggle('show');}
document.addEventListener('click',function(){var m=document.getElementById('colvisMenu');if(m)m.classList.remove('show');});
function toggleColumn(k){ regHidden.has(k)?regHidden.delete(k):regHidden.add(k);
  var th=document.querySelector('#regTable thead th[data-k="'+k+'"]'); if(th)th.style.display=regHidden.has(k)?'none':'';
  renderRegistered();
}
function sortReg(key){ if(regSort.key===key)regSort.dir=regSort.dir==='asc'?'desc':'asc'; else {regSort.key=key;regSort.dir='asc';} renderRegistered(); }
function mapAdminStudentRow(row,index){
  var created=row.submitted_at||row.created_at||'';
  var dt=created?new Date(created):null;
  var progId=pRev[row.programme_id]||null, classId=cRev[row.class_id]||null, houseId=hRev[row.house_id]||null;
  var local=students.find(function(item){ return String(item._id)===String(row.id); });
  var records=row.records&&typeof row.records==='object'?row.records:{};
  return {id:local?local.id:1000000+index,_id:row.id,index:row.bece_index||'',name:row.full_name||'(no name)',gender:row.gender||'',
    progId:progId,classId:classId,houseId:houseId,className:row.class_name||'',houseName:row.house_name||'',house:row.house_name||'',houseUuid:row.house_id||'',status:row.status||'pending',adm:row.permanent_admission_number||row.admission_no||'-',legacyAdm:row.admission_no||'',permAdm:row.permanent_admission_number||'',
    verificationStatus:row.verification_status||'pending',verifiedAt:row.verified_at||'',verifiedBy:row.verified_by||'',
    passportPhoto:records.passport_photo_path||records.passport_photo_url||records.photo_url||'',reg:created.slice(0,10),submittedAt:row.submitted_at||'',personalDone:!!row.personal_done,programmeDone:!!row.programme_done,undertakingDone:!!row.undertaking_done,
    time:dt&&!isNaN(dt.getTime())?dt.toTimeString().slice(0,8):'-',sms:records.sms_contact||row.parent_phone||'-',smsRaw:records.sms_contact||row.parent_phone||'',prog:row.programme_name||row.placement_programme||'',enrol:records.enrolment_code||'-',form:records.enrolment_form_path||row.enrolment_form_url||records.enrolment_form_url||null,
    dob:records.dob||'',parent:row.parent_name||records.guardian||'-',res:row.residential_status||(records.residential_status||records.residential)||'-',rec:records,pay:row.payment_status||'unpaid',submitted:!!row.submitted_at,loggedIn:false};
}
async function loadRegisteredPage(reset){
  if(!SB_SCHOOL||!SB_SCHOOL.id) return;
  if(reset) REG_STATE.page=1;
  if(REG_STATE.loading) return;
  REG_STATE.loading=true;
  var {data,error}=await invokeFnDetailed('admin-students-list',{school_id:SB_SCHOOL.id,page:REG_STATE.page,page_size:REG_STATE.pageSize,submitted_only:true,search:(document.getElementById('regSearch')||{}).value||''});
  REG_STATE.loading=false;
  if(error||!data||data.ok===false){ toast((data&&data.message)||(error&&error.message)||'Could not load the admission list'); return; }
  REG_STATE.total=Number(data.total)||0; REG_STATE.totalPages=Math.max(Number(data.total_pages)||1,1); REG_STATE.page=Number(data.page)||1;
  REG_STATE.rows=(Array.isArray(data.rows)?data.rows:[]).map(mapAdminStudentRow);
  renderRegisteredRows();
}
function queueRegisteredSearch(){ clearTimeout(regSearchTimer); regSearchTimer=setTimeout(function(){ loadRegisteredPage(true); },250); }
function changeRegisteredPage(delta){ var next=Math.min(Math.max((REG_STATE.page||1)+delta,1),REG_STATE.totalPages||1); if(next===REG_STATE.page)return; REG_STATE.page=next; loadRegisteredPage(false); }
async function loadManageStudentsPage(reset){
  if(!SB_SCHOOL||!SB_SCHOOL.id) return;
  if(reset) MANAGE_STATE.page=1;
  if(MANAGE_STATE.loading) return;
  MANAGE_STATE.loading=true;
  var selectedProgramme=(document.getElementById('stuProg')||{}).value||'all';
  var {data,error}=await invokeFnDetailed('admin-students-list',{school_id:SB_SCHOOL.id,page:MANAGE_STATE.page,page_size:MANAGE_STATE.pageSize,submitted_only:true,search:(document.getElementById('stuSearch')||{}).value||'',programme_id:selectedProgramme==='all'?'':(pMap[selectedProgramme]||'')});
  MANAGE_STATE.loading=false;
  if(error||!data||data.ok===false){ toast((data&&data.message)||(error&&error.message)||'Could not load students'); return; }
  MANAGE_STATE.total=Number(data.total)||0; MANAGE_STATE.totalPages=Math.max(Number(data.total_pages)||1,1); MANAGE_STATE.page=Number(data.page)||1;
  MANAGE_STATE.rows=(Array.isArray(data.rows)?data.rows:[]).map(mapAdminStudentRow);
  renderStudentsRows();
}
async function ensureStudentCache(){
  if(!SB_SCHOOL||!SB_SCHOOL.id||STUDENT_CACHE_STATE.loaded||STUDENT_CACHE_STATE.loading) return;
  STUDENT_CACHE_STATE.loading=true;
  try{
    var first=await invokeFnDetailed('admin-students-list',{school_id:SB_SCHOOL.id,page:1,page_size:100,submitted_only:true});
    if(first.error||!first.data||first.data.ok===false) throw new Error((first.data&&first.data.message)||(first.error&&first.error.message)||'Could not load student records');
    var rows=Array.isArray(first.data.rows)?first.data.rows:[], total=Math.min(Number(first.data.total)||rows.length,10000);
    var pages=Math.ceil(total/100);
    for(var page=2;page<=pages;page++){
      var next=await invokeFnDetailed('admin-students-list',{school_id:SB_SCHOOL.id,page:page,page_size:100,submitted_only:true});
      if(next.error||!next.data||next.data.ok===false) throw new Error((next.data&&next.data.message)||(next.error&&next.error.message)||'Could not load student records');
      rows=rows.concat(Array.isArray(next.data.rows)?next.data.rows:[]);
    }
    students=rows.map(mapAdminStudentRow);
    STUDENT_CACHE_STATE.loaded=true;
    if(Number(first.data.total)>10000) toast('Showing the first 10,000 students in this workspace view. Use search and pagination for larger schools.');
  }catch(err){ toast(err&&err.message||'Could not load student records'); }
  STUDENT_CACHE_STATE.loading=false;
}
function queueManageSearch(){ clearTimeout(manageSearchTimer); manageSearchTimer=setTimeout(function(){ loadManageStudentsPage(true); },250); }
function changeManagePage(delta){ var next=Math.min(Math.max((MANAGE_STATE.page||1)+delta,1),MANAGE_STATE.totalPages||1); if(next===MANAGE_STATE.page)return; MANAGE_STATE.page=next; loadManageStudentsPage(false); }
function regFiltered(){
  var q=(document.getElementById('regSearch').value||'').toLowerCase();
  var source=REG_STATE.rows.length?REG_STATE.rows:submittedStudents();
  var rows=source.filter(s=>!q||[s.index,s.name,s.adm,s.sms,s.enrol].some(v=>(v||'').toString().toLowerCase().includes(q)));
  var k=regSort.key,dir=regSort.dir==='asc'?1:-1;
  rows=rows.slice().sort((a,b)=>((a[k]||'').toString()).localeCompare((b[k]||'').toString(),undefined,{numeric:true})*dir);
  return rows;
}
function formCell(s){ return s.form?`<button class="act" type="button" data-qa-onclick="openStudentUploadedFile('${escapeAttr(s._id)}','enrolment')">Open</button>`:`<span class="enrol-none">?</span>`; }
function regCell(k,s){ if(k==='form')return formCell(s); if(k==='name')return `<span class="nm">${safeHtml(s.name)}</span>`; if(['index','adm','enrol','time'].indexOf(k)>-1)return `<span class="mono">${safeHtml(s[k])}</span>`; return safeHtml(s[k],'&mdash;'); }
function renderRegisteredRows(){
  var rows=regFiltered();
  var showHouse=canViewStudentHouse();
  var cnt=document.getElementById('regCount'); if(cnt)cnt.textContent=rows.length+' student'+(rows.length===1?'':'s');
  document.querySelectorAll('#regTable thead th[data-k]').forEach(th=>{th.classList.remove('sorted-asc','sorted-desc'); if(th.dataset.k===regSort.key)th.classList.add(regSort.dir==='asc'?'sorted-asc':'sorted-desc');});
  var visible=1+regCols.filter(k=>!regHidden.has(k)).length;
  var html='';
  rows.forEach(s=>{
    var open=regExpanded.has(s.id);
    html+=`<tr><td><button class="exp-btn ${open?'open':''}" data-qa-onclick="toggleRegExpand(${s.id})">${open?'−':'+'}</button></td>`;
    regCols.forEach(k=>{ if(!regHidden.has(k)) html+=`<td>${regCell(k,s)}</td>`; });
    html+='</tr>';
    if(open){
      var className=displayedClassName(s),houseName=displayedHouseName(s);
      html+=`<tr class="reg-detail"><td colspan="${visible}"><div class="reg-detail-in">
        <div class="kv"><b>Programme</b>${safeHtml(studentProgrammeName(s),'-')}</div>
        <div class="kv"><b>Class</b>${className?safeHtml(className):'Not allocated'}</div>
        ${showHouse?`<div class="kv"><b>House</b>${houseName?safeHtml(houseName):'Not allocated'}</div>`:''}
        <div class="kv"><b>Gender</b>${s.gender==='M'?'Male':(s.gender==='F'?'Female':'&mdash;')}</div>
        <div class="kv"><b>Residential</b>${safeHtml(s.res,'&mdash;')}</div>
        <div class="kv"><b>Parent / Guardian</b>${safeHtml(s.parent,'&mdash;')}</div>
        <div class="kv"><b>Date of birth</b>${safeHtml(s.dob,'&mdash;')}</div>
      </div></td></tr>`;
    }
  });
  document.getElementById('regRows').innerHTML=rows.length?html:emptyRow(visible,'No students found.');
  var pager=document.getElementById('regPagerMeta'); if(pager)pager.textContent='Page '+(REG_STATE.page||1)+' of '+(REG_STATE.totalPages||1);
}
function renderRegistered(){
  if(SB_SCHOOL&&SB_SCHOOL.id){ loadRegisteredPage(false); return; }
  renderRegisteredRows();
}
function toggleRegExpand(id){ showRegisteredStudentDetails(id); }
async function openStudentUploadedFile(studentId,fileType){
  if(!studentId||!SB_SCHOOL||!SB_SCHOOL.id){toast('The student file is not available.');return;}
  var viewer=null;
  try{
    viewer=window.open('about:blank','_blank');
    if(viewer&&viewer.document) viewer.document.body.innerHTML='<p style="font:16px Arial;padding:24px;color:#002b4c">Opening secure student file...</p>';
  }catch(e){}
  var result=await invokeFnDetailed('admin-students-list',{action:'signed_file_url',school_id:SB_SCHOOL.id,student_id:studentId,file_type:fileType});
  var data=result.data,error=result.error;
  if(error||!data||data.ok===false||!data.url){
    if(viewer&&!viewer.closed)viewer.close();
    toast((data&&data.message)||(error&&error.message)||'Could not open the uploaded file.');
    return;
  }
  if(viewer&&!viewer.closed) viewer.location.replace(data.url);
  else window.open(data.url,'_blank','noopener');
}
function showRegisteredStudentDetails(id){
  const s=REG_STATE.rows.find(x=>x.id===id)||students.find(x=>x.id===id); if(!s)return;
  const className=displayedClassName(s),houseName=displayedHouseName(s),r=s.rec||{};
  const rows=[
    ['JHS Index No',s.index],['Admission No',displayedAdmissionNumber(s)],['Student Name',s.name],['Gender',s.gender==='M'?'Male':(s.gender==='F'?'Female':s.gender)],
    ['Programme',studentProgrammeName(s)],['Class',className||'Not allocated'],['House',houseName||'Not allocated'],['Residential',s.res],
    ['SMS Contact',s.sms],['Enrolment Code',s.enrol],['Date Registered',s.reg],['Time',s.time],
    ['Date of Birth',r.dob||s.dob],['Region',r.region],['District',r.district],['Religion',r.religion],['Denomination',r.denomination],
    ['Father',r.father_name],['Mother',r.mother_name],['Guardian',r.guardian]
  ];
  const form=s.form?`<div class="field"><label>Enrolment Form</label><button class="btn btn-ghost btn-sm" type="button" data-qa-onclick="openStudentUploadedFile('${escapeAttr(s._id)}','enrolment')">Open uploaded form</button></div>`:'';
  const photo=s.passportPhoto?`<div class="field"><label>Passport Photo</label><button class="btn btn-ghost btn-sm" type="button" data-qa-onclick="openStudentUploadedFile('${escapeAttr(s._id)}','passport')">Open passport photo</button></div>`:'';
  const m=$('modal');
  m.innerHTML=`<div class="modal-head"><div><h2>${safeHtml(s.name)}</h2><p><span class="code">${safeHtml(s.index)}</span></p></div><button class="modal-x" data-qa-onclick="closeModal()">×</button></div>
  <div class="modal-body"><div class="grid-2 student-info-grid">${rows.map(function(row){return `<div class="kv"><b>${safeHtml(row[0])}:</b>${safeHtml(row[1],'-')}</div>`;}).join('')}${photo}${form}</div></div>
  <div class="modal-foot"><button class="btn btn-ghost" data-qa-onclick="closeModal()">Close</button></div>`;
  $('overlay').classList.add('show');
}
async function exportLargeAdmissionCsv(){
  if(!SB_SCHOOL||!SB_SCHOOL.id){toast('School is still loading.');return;}
  toast('Preparing server-side CSV export…');
  const tok=await freshToken();
  if(!tok){toast('Your session expired — please sign in again.');return;}
  try{
    const res=await fetch(SB_URL+'/functions/v1/admin-students-export',{
      method:'POST',headers:{'Content-Type':'application/json',apikey:SB_KEY,Authorization:'Bearer '+tok},
      body:JSON.stringify({school_id:SB_SCHOOL.id,search:(document.getElementById('regSearch')||{}).value||''})
    });
    if(!res.ok){let body=null;try{body=await res.json();}catch(e){};toast((body&&body.message)||'Could not create the CSV export.');return;}
    const blob=await res.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='admission-list-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
    setTimeout(function(){URL.revokeObjectURL(url);},1000);toast('Server-side CSV export downloaded.');
  }catch(err){toast((err&&err.message)||'Could not create the CSV export.');}
}
async function exportCSV(kind){
  if(SB_SCHOOL&&SB_SCHOOL.id&&!STUDENT_CACHE_STATE.loaded){ toast('Preparing all submitted student records…'); await ensureStudentCache(); }
  var cols=regCols.filter(k=>!regHidden.has(k));
  var rows=STUDENT_CACHE_STATE.loaded?students.slice():regFiltered();
  if(kind==='pdf'){
    exportRegisteredPdf(rows);
    return;
  }
  if(kind==='excel'){
    var headers=cols.map(k=>regColLabels[k]);
    var excelRows=rows.map(s=>cols.map(k=>k==='form'?(s.form?'yes':'no'):(s[k]||'')));
    downloadExcelRows('registered-students','Registered Students',headers,excelRows,'Registered Students');
    return;
  }
  var csvRows=[cols.map(k=>regColLabels[k])].concat(rows.map(function(s){
    return cols.map(function(k){ return k==='form'?(s.form?'yes':'no'):(s[k]||''); });
  }));
  var blob=csvBlobFromRows(csvRows),a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='registered-students.csv'; a.click();
  toast('Exported '+rows.length+' rows');
}
function exportRegisteredPdf(rowsOverride){
  var rows=Array.isArray(rowsOverride)?rowsOverride:regFiltered();
  if(!rows.length){ toast('No registered students to export'); return; }
  var showHouse=canViewStudentHouse();
  var headers=['JHS Index No','Admission #','Student Name','Programme','Class'];
  if(showHouse) headers.push('House');
  headers=headers.concat(['Date Registered','Time','SMS Contact','Enrolment Code','Enrolment Form']);
  var dataRows=rows.map(function(s){
    var row=[s.index||'',displayedAdmissionNumber(s),s.name||'',studentProgrammeName(s)||'',displayedClassName(s)||'Not allocated'];
    if(showHouse) row.push(displayedHouseName(s)||'Not allocated');
    row.push(s.reg||'',s.time||'',s.sms||'',s.enrol||'',s.form?'Uploaded':'Missing');
    return row;
  });
  var crest=(SB_SCHOOL&&SB_SCHOOL.crest_url)||'';
  var schoolName=exportSchoolName();
  var admissionYear=exportAdmissionYear();
  var footerHead=exportHeadLabel();
  var generated=new Date().toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  var w=window.open('','_blank');
  if(!w){ toast('Allow pop-ups to print / save PDF'); return; }
  w.document.write('<html><head><title>Registered Students</title><style>'
    +'@page{size:A4 landscape;margin:12mm}'
    +'*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#111827;padding:18px 20px 10px}'
    +'.pdf-head{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:12px;padding:14px 16px;border-radius:14px;background:linear-gradient(135deg,#14532d 0%,#16a34a 100%);color:#ffffff}'
    +'.pdf-brand{display:flex;align-items:center;gap:12px}.pdf-brand img{width:62px;height:62px;object-fit:contain}'
    +'.pdf-title{font-size:24px;font-weight:800;line-height:1.1}.pdf-sub{font-size:12px;color:rgba(255,255,255,.9);margin-top:4px}'
    +'.pdf-meta{text-align:right;font-size:12px;color:#ffffff}'
    +'.pdf-rule{border-top:2px solid #111827;margin:10px 0 14px}'
    +'table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #111827;padding:6px 7px;vertical-align:top;text-align:left}'
    +'th{background:linear-gradient(135deg,#14532d 0%,#16a34a 100%);color:#fff;font-weight:700}tbody tr:nth-child(even){background:#fafafa}'
    +'.pdf-foot{margin-top:12px;font-size:11px;color:#4b5563;display:flex;justify-content:space-between;gap:18px}'
    +'</style></head><body>'
    +'<div class="pdf-head">'
      +'<div class="pdf-brand">'+(crest?'<img src="'+escapeAttr(crest)+'" alt="">':'')+'<div><div class="pdf-title">'+safeHtml(schoolName)+'</div><div class="pdf-sub">Registered Students Report'+(admissionYear?' · Admission Year '+safeHtml(admissionYear):'')+'</div></div></div>'
      +'<div class="pdf-meta"><div><b>Generated:</b> '+safeHtml(generated)+'</div><div><b>Total students:</b> '+rows.length+'</div></div>'
    +'</div>'
    +'<div class="pdf-rule"></div>'
    +'<table><thead><tr>'+headers.map(function(h){ return '<th>'+safeHtml(h)+'</th>'; }).join('')+'</tr></thead><tbody>'
    +dataRows.map(function(r){ return '<tr>'+r.map(function(c){ return '<td>'+safeHtml(c==null?'':String(c),'&mdash;')+'</td>'; }).join('')+'</tr>'; }).join('')
    +'</tbody></table><div class="pdf-foot"><div>'+safeHtml(footerHead)+'</div><div>Total Students: '+rows.length+'</div></div></body></html>');
  w.document.close();
  setTimeout(function(){ w.print(); },350);
}
function downloadAdmissionList(){ openReportsModal(); }

/* ===== DETAILED ENROLMENT REPORTS ===== */
const REP_TABS=['Programme Report','House Report','Class List Report','CSSPS Enrolment Report','Boarding Status Report'];
function openReportsModal(){
  var ov=document.getElementById('reportsOverlay');
  if(!ov){ov=document.createElement('div');ov.id='reportsOverlay';ov.className='overlay';document.body.appendChild(ov);ov.addEventListener('click',function(e){if(e.target===ov)closeReports();});}
  ov.innerHTML='<div class="modal rep-modal">'
    +'<div class="modal-head"><div><h2>Detailed Enrolment Reports</h2><p>Generate and download enrolment reports</p></div><button class="modal-x" data-qa-onclick="closeReports()">×</button></div>'
    +'<div class="rep-tabs" id="repTabs">'+REP_TABS.map((t,i)=>`<button class="rep-tab" data-i="${i}" data-qa-onclick="repTab(${i})">${t}</button>`).join('')+'</div>'
    +'<div class="modal-body" id="repBody"></div></div>';
  ov.classList.add('show'); positionReportsOverlay(); requestAnimationFrame(positionReportsOverlay); repTab(3);
}
function positionReportsOverlay(){
  var overlay=document.getElementById('reportsOverlay');
  if(!overlay||!overlay.classList.contains('show'))return;
  var topbar=document.querySelector('.topbar'),sidebar=$('sidebar'),footer=document.querySelector('body > footer.system-footer');
  var desktop=window.matchMedia('(min-width:1025px)').matches;
  var top=topbar?Math.max(0,topbar.getBoundingClientRect().bottom):0;
  var left=desktop&&sidebar?Math.max(0,sidebar.getBoundingClientRect().right):0;
  var bottom=footer?Math.max(0,window.innerHeight-footer.getBoundingClientRect().top):0;
  overlay.style.setProperty('--reports-overlay-top',top+'px');
  overlay.style.setProperty('--reports-overlay-left',left+'px');
  overlay.style.setProperty('--reports-overlay-bottom',bottom+'px');
}
function closeReports(){
  var ov=document.getElementById('reportsOverlay');
  if(!ov)return;
  ov.classList.remove('show');
  ov.style.removeProperty('--reports-overlay-top');
  ov.style.removeProperty('--reports-overlay-left');
  ov.style.removeProperty('--reports-overlay-bottom');
}
window.addEventListener('resize',positionReportsOverlay);
function dateDefaults(){var to=new Date(),from=new Date();from.setDate(from.getDate()-60);return {from:from.toISOString().slice(0,10),to:to.toISOString().slice(0,10)};}
function repDateRow(){var d=dateDefaults();return `<label class="rep-lbl">Date of Admission</label><div class="rep-dates">From: <input type="date" id="rep_from" value="${d.from}"> To: <input type="date" id="rep_to" value="${d.to}"></div>`;}
function repRadios(){return `<div class="rep-radios"><label class="rep-radio"><input type="radio" name="rep_mode" value="full" checked> Full Report</label><label class="rep-radio"><input type="radio" name="rep_mode" value="summary"> Summary Report</label></div>`;}
function selOpts(arr,all){return (all?`<option value="">${all}</option>`:'<option value="">- Select -</option>')+arr.map(x=>`<option value="${x.id}">${x.name}</option>`).join('');}
function repTab(i){
  document.querySelectorAll('#repTabs .rep-tab').forEach((t,x)=>t.classList.toggle('active',x===i));
  var b=document.getElementById('repBody'),h='';
  if(i===0){ h=`<div class="rep-title">Programme Report - enrolment by academic programme</div>${repDateRow()}
    <label class="rep-lbl">Programme</label><select id="rep_prog">${selOpts(programmes,'- All programmes -')}</select>${repRadios()}
    <div class="rep-actions"><button class="btn-grn" data-qa-onclick="runReport('programme')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download (Excel)</button><button class="btn btn-ghost btn-sm" data-qa-onclick="runReport('programme','pdf')">PDF</button></div>`; }
  else if(i===1){ h=`<div class="rep-title">House Report</div>${repDateRow()}
    <label class="rep-lbl">House</label><select id="rep_house">${selOpts(houses,'- All houses -')}</select>
    <label class="rep-lbl">Boarding status</label><select id="rep_board"><option value="">All</option><option>Boarding</option><option>Day</option></select>
    <div class="rep-actions"><button class="btn-grn" data-qa-onclick="runReport('house')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download (Excel)</button><button class="btn btn-ghost btn-sm" data-qa-onclick="runReport('house','pdf')">PDF</button></div>`; }
  else if(i===2){ h=`<div class="rep-title">Class List Report</div>${repDateRow()}
    <label class="rep-lbl">Class</label><select id="rep_class">${selOpts(classes,'- All classes -')}</select>
    <div class="rep-actions"><button class="btn-grn" data-qa-onclick="runReport('class')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download (Excel)</button><button class="btn btn-ghost btn-sm" data-qa-onclick="runReport('class','pdf')">PDF</button></div>`; }
  else if(i===3){ h=`<div class="rep-title">CSSPS Enrolment Report</div>
    <p class="rep-note">Exports every submitted student's complete enrolment record, including programme, class, house, enrolment code, contact, parent/guardian, and personal record fields.</p>
    ${repDateRow()}
    <div class="rep-actions"><button class="btn-grn" data-qa-onclick="runReport('saprosoft')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download CSSPS Enrolment Report (Excel)</button></div>`; }
  else { h=`<div class="rep-title">Boarding Status Report</div>${repDateRow()}
    <label class="rep-lbl">Status</label><select id="rep_board"><option value="">All</option><option>Boarding</option><option>Day</option></select>
    <div class="rep-actions"><button class="btn-grn" data-qa-onclick="runReport('boarding')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download (Excel)</button><button class="btn btn-ghost btn-sm" data-qa-onclick="runReport('boarding','pdf')">PDF</button></div>`; }
  b.innerHTML=h;
}
function repVal(id){var e=document.getElementById(id);return e?e.value:'';}
function repMode(){var r=document.querySelector('input[name="rep_mode"]:checked');return r?r.value:'full';}
function inRange(s){var f=repVal('rep_from'),t=repVal('rep_to');if(f&&s.reg<f)return false;if(t&&s.reg>t)return false;return true;}
function pN(s){return studentProgrammeName(s);}
function cN(s){return displayedClassName(s)||'—';}
function hN(s){return displayedHouseName(s)||'—';}
async function runReport(type,fmt){
  if(SB_SCHOOL&&SB_SCHOOL.id&&!STUDENT_CACHE_STATE.loaded){ toast('Preparing submitted student records…'); await ensureStudentCache(); }
  var rows=[],headers=[],title='',data=submittedStudents();
  if(['programme','cssps','house','class','boarding','saprosoft'].indexOf(type)>-1) data=data.filter(inRange);
  if(type==='programme'||type==='cssps'){
    var pid=repVal('rep_prog'); if(pid)data=data.filter(s=>String(s.progId)===pid);
    if(repMode()==='summary'){ headers=['Programme','Students']; var by={}; data.forEach(s=>{var n=pN(s);by[n]=(by[n]||0)+1;}); rows=Object.keys(by).map(k=>[k,by[k]]); title=(type==='cssps'?'CSSPS Enrolment':'Programme')+' Summary'; }
    else { headers=['JHS Index No','Admission #','Student Name','Gender','Programme','Class','House','Date Registered','SMS Contact','Enrolment Code']; rows=data.map(s=>[s.index,displayedAdmissionNumber(s),s.name,s.gender,pN(s),cN(s),hN(s),s.reg,s.sms,s.enrol]); title=(type==='cssps'?'CSSPS Enrolment Report':'Programme Report'); }
  } else if(type==='house'){
    var hid=repVal('rep_house'),bd=repVal('rep_board'); if(hid)data=data.filter(s=>String(s.houseId)===hid); if(bd)data=data.filter(s=>s.res===bd);
    headers=['JHS Index No','Student Name','Gender','House','Boarding','Programme','Class']; rows=data.map(s=>[s.index,s.name,s.gender,hN(s),s.res,pN(s),cN(s)]); title='House Report';
  } else if(type==='class'){
    var cid=repVal('rep_class'); if(cid)data=data.filter(s=>String(s.classId)===cid);
    headers=['JHS Index No','Student Name','Gender','Class','Programme','House']; rows=data.map(s=>[s.index,s.name,s.gender,cN(s),pN(s),hN(s)]); title='Class List Report';
  } else if(type==='boarding'){
    var b2=repVal('rep_board'); if(b2)data=data.filter(s=>s.res===b2);
    headers=['JHS Index No','Student Name','Gender','Boarding','Programme','Class','House']; rows=data.map(s=>[s.index,s.name,s.gender,s.res,pN(s),cN(s),hN(s)]); title='Boarding Status Report';
  } else if(type==='saprosoft'){
    headers=['INDEX','ADMISSION NO','SURNAME','FULL NAME','GENDER','DATE OF BIRTH','PLACE OF BIRTH','NATIONALITY','RELIGION','DENOMINATION','AGGREGATE','RAW SCORE','ENROLMENT CODE','JHS ATTENDED','JHS TYPE','PROGRAMME','CLASS','HOUSE','RESIDENTIAL','PERMANENT ADDRESS','TOWN','REGION','DISTRICT','INTEREST','GHANA CARD/NHIS','SMS CONTACT','WHATSAPP','OTHER PHONE','EMAIL','FATHER NAME','FATHER OCCUPATION','MOTHER NAME','MOTHER OCCUPATION','GUARDIAN','GUARDIAN PHONE','DIGITAL ADDRESS','DATE REGISTERED','RECORDS SUBMITTED'];
    rows=data.map(s=>{ var r=s.rec||{}; var done=!!(r.father_name||r.dob||r.enrolment_code);
      return [s.index, displayedAdmissionNumber(s), (r.surname||s.name||''), (s.name||''), s.gender,
        (r.dob||s.dob||''), r.place_of_birth||'', r.nationality||'', r.religion||'', r.denomination||'',
        (r.aggregate!=null?r.aggregate:''), r.raw_score||'', (r.enrolment_code||s.enrol||'').toUpperCase(), r.jhs_attended||'', r.jhs_type||'',
        pN(s), (r.class_name||cN(s)), hN(s), s.res||'',
        r.address||'', r.town||'', r.region||'', r.district||'', r.interest||'', r.ghana_card||'',
        (r.sms_contact||s.sms||''), r.whatsapp||'', r.other_phone||'', r.email||'',
        r.father_name||'', r.father_occupation||'', r.mother_name||'', r.mother_occupation||'',
        r.guardian||'', r.guardian_phone||'', r.digital_address||'', s.reg||'', done?'YES':'NO']; });
    title='CSSPS Enrolment Report';
  }
  if(!rows.length){toast('No records match the selected filters');return;}
  if(fmt==='pdf') repPrint(title,headers,rows,data.length); else repExcel(title,headers,rows,data.length);
}
function analyticsRows(kind){
  var data=submittedStudents();
  var by={};
  data.forEach(function(s){
    var key=kind==='programme'?pN(s):(kind==='house'?hN(s):(kind==='class'?cN(s):(s.res||'Unknown')));
    by[key]=(by[key]||0)+1;
  });
  return Object.keys(by).sort().map(function(k){return [k,by[k]];});
}
async function exportEnrolmentAnalytics(){
  if(SB_SCHOOL&&SB_SCHOOL.id&&!STUDENT_CACHE_STATE.loaded){ toast('Preparing submitted student records…'); await ensureStudentCache(); }
  var totalStudents=submittedStudents().length;
  var sheets=[
    {name:'Programme',headers:['Programme','Students'],rows:analyticsRows('programme')},
    {name:'House',headers:['House','Students'],rows:analyticsRows('house')},
    {name:'Class',headers:['Class','Students'],rows:analyticsRows('class')},
    {name:'Boarding',headers:['Residential Status','Students'],rows:analyticsRows('boarding')}
  ];
  if(typeof XLSX==='undefined'){
    downloadExcelRows('enrolment_analytics','Programme',sheets[0].headers,sheets[0].rows,'Enrolment analytics',totalStudents);
    return;
  }
  const wb=XLSX.utils.book_new();
  sheets.forEach(function(sheet){
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(exportSheetRows(sheet.headers,sheet.rows,sheet.name+' Analytics',totalStudents)),sanitizeSheetName(sheet.name));
  });
  XLSX.writeFile(wb,excelFileName('enrolment_analytics'),{bookType:preferredExcelExtension()==='xls'?'xls':'xlsx'});
  toast('Enrolment analytics exported');
}
function repExcel(title,headers,rows,totalStudents){
  if(downloadExcelRows(title.replace(/[^a-z0-9]+/gi,'_'),title,headers,rows,title,totalStudents)) return;
  var schoolName=exportSchoolName(), admissionYear=exportAdmissionYear(), footerHead=exportHeadLabel();
  var total=(typeof totalStudents==='number'&&!isNaN(totalStudents))?totalStudents:rows.length;
  var html='<table border="1"><thead><tr>'+headers.map(h=>`<th>${safeHtml(h)}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>`<td>${safeHtml(c==null?'':String(c))}</td>`).join('')+'</tr>').join('')+'</tbody></table>';
  var blob=new Blob(['\ufeff<html><head><meta charset="utf-8"></head><body><h3>Asuom SHS — '+safeHtml(title)+'</h3>'+html+'</body></html>'],{type:'application/vnd.ms-excel'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=title.replace(/[^a-z0-9]+/gi,'_')+'.xls';a.click();
  toast('Downloaded '+rows.length+' rows (Excel)');
}
function repPrint(title,headers,rows){
  var w=window.open('','_blank'); if(!w){toast('Allow pop-ups to print / save PDF');return;}
  w.document.write('<html><head><title>'+safeHtml(title)+'</title><style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#1557B0;color:#fff}</style></head><body><h2>Asuom SHS — '+safeHtml(title)+'</h2><table><thead><tr>'+headers.map(h=>'<th>'+safeHtml(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+safeHtml(c==null?'':String(c))+'</td>').join('')+'</tr>').join('')+'</tbody></table></body></html>');
  w.document.close(); setTimeout(function(){w.print();},300);
}

function repExcel(title,headers,rows,totalStudents){
  if(downloadExcelRows(title.replace(/[^a-z0-9]+/gi,'_'),title,headers,rows,title,totalStudents)) return;
  var schoolName=exportSchoolName(), admissionYear=exportAdmissionYear(), footerHead=exportHeadLabel();
  var total=(typeof totalStudents==='number'&&!isNaN(totalStudents))?totalStudents:rows.length;
  var html='<table border="1" style="border-collapse:collapse;width:100%"><thead><tr>'+headers.map(h=>`<th style="border:1px solid #1f2937;padding:7px 9px;background:linear-gradient(135deg,#14532d 0%,#16a34a 100%);color:#ffffff;text-align:left">${safeHtml(h)}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>`<td style="border:1px solid #1f2937;padding:7px 9px">${safeHtml(c==null?'':String(c))}</td>`).join('')+'</tr>').join('')+'</tbody></table>';
  var blob=new Blob(['\ufeff<html><head><meta charset="utf-8"></head><body><h3>'+safeHtml(schoolName)+' - '+safeHtml(title)+'</h3><p>'+(admissionYear?('Admission Year: '+safeHtml(admissionYear)):'Admission Year: -')+'</p>'+html+'<p>'+safeHtml(footerHead)+'</p><p>Total Students: '+total+'</p></body></html>'],{type:'application/vnd.ms-excel'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=title.replace(/[^a-z0-9]+/gi,'_')+'.xls';a.click();
  toast('Downloaded '+rows.length+' rows (Excel)');
}
function repPrint(title,headers,rows,totalStudents){
  var w=window.open('','_blank'); if(!w){toast('Allow pop-ups to print / save PDF');return;}
  var schoolName=exportSchoolName(), admissionYear=exportAdmissionYear(), footerHead=exportHeadLabel();
  var total=(typeof totalStudents==='number'&&!isNaN(totalStudents))?totalStudents:rows.length;
  w.document.write('<html><head><title>'+safeHtml(title)+'</title><style>body{font-family:Arial,sans-serif;padding:24px}.pdf-head{margin-bottom:14px;padding:14px 16px;border-radius:14px;background:linear-gradient(135deg,#14532d 0%,#16a34a 100%);color:#fff}.pdf-head h2{margin:0 0 4px}.pdf-sub{font-size:12px;color:rgba(255,255,255,.9)}.pdf-foot{margin-top:14px;font-size:12px;color:#374151;display:flex;justify-content:space-between;gap:18px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:linear-gradient(135deg,#14532d 0%,#16a34a 100%);color:#fff}</style></head><body><div class="pdf-head"><h2>'+safeHtml(schoolName)+' - '+safeHtml(title)+'</h2><div class="pdf-sub">'+(admissionYear?('Admission Year: '+safeHtml(admissionYear)):'Admission Year: -')+'</div></div><table><thead><tr>'+headers.map(h=>'<th>'+safeHtml(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+safeHtml(c==null?'':String(c))+'</td>').join('')+'</tr>').join('')+'</tbody></table><div class="pdf-foot"><div>'+safeHtml(footerHead)+'</div><div>Total Students: '+total+'</div></div></body></html>');
  w.document.close(); setTimeout(function(){w.print();},300);
}


const VERIFY_STATE={query:'',timer:null,page:1,pageSize:50,total:0,totalPages:1,rows:[],selected:null,submitting:false};
const VERIFIED_STATE={page:1,pageSize:25,total:0,totalPages:1,rows:[],allRows:[],summary:{total_verified:0,male:0,female:0,day_students:0,boarding_students:0,verified_today:0},filters:{}};
const VERIFICATION_COUNTS={loaded:false,submitted:0,pending:0,actionable:0,verified:0};
function verificationAction(action,payload){ return invokeFnDetailed('student-verification',Object.assign({action,school_id:(SB_SCHOOL&&SB_SCHOOL.id)||null},payload||{})); }
function verificationStatusClass(status){ const key=String(status||'pending').toLowerCase().replace(/[^a-z]+/g,'_'); if(key==='documents_incomplete')return 'pending'; return ['pending','verified','rejected'].includes(key)?key:'pending'; }
function verificationStatusLabel(status){ const key=verificationStatusClass(status); return key==='pending'?'Awaiting Verification':(key.charAt(0).toUpperCase()+key.slice(1).replace(/_/g,' ')); }
function verificationBadge(status){ const key=verificationStatusClass(status); return '<span class="verify-status '+key+'">'+safeHtml(verificationStatusLabel(key))+'</span>'; }
function queueVerificationSearch(){ clearTimeout(VERIFY_STATE.timer); VERIFY_STATE.timer=setTimeout(function(){ loadVerificationSearch(false,1); },320); }
function clearVerificationSearch(){ const input=$('verifySearchInput'); if(input) input.value=''; VERIFY_STATE.query=''; loadVerificationSearch(true,1); }
function pendingVerificationStudents(){ return (students||[]).filter(function(s){ return !!s.submitted && verificationStatusClass(s.verificationStatus)==='pending' && String(s.status||'').toLowerCase()!=='rejected'; }); }
function verifiedStudentsLocal(){ return (students||[]).filter(function(s){ return verificationStatusClass(s.verificationStatus)==='verified'; }); }
function currentVerificationCounts(){ if(VERIFICATION_COUNTS.loaded) return VERIFICATION_COUNTS; const pending=pendingVerificationStudents().length; return {loaded:false,submitted:submittedStudents().length,pending:pending,actionable:pending,verified:verifiedStudentsLocal().length}; }
function renderVerificationQuickCounts(){ const host=$('verifyQuickCounts'); if(!host) return; const counts=currentVerificationCounts(); const cards=[['Awaiting Verification',counts.pending],['Verified',counts.verified],['Submitted Students',counts.submitted]]; host.innerHTML=cards.map(function(card){ return '<div class="verify-card"><div class="lbl">'+safeHtml(card[0])+'</div><div class="val">'+safeHtml(String(card[1]))+'</div></div>'; }).join(''); }
function updateVerificationBadges(){ const counts=currentVerificationCounts(); const bp=$('badge-verify-pending'); if(bp) bp.textContent=String(counts.actionable); const bv=$('badge-verified-total'); if(bv) bv.textContent=String(counts.verified); renderVerificationQuickCounts(); }
function applyVerificationCountDelta(delta){
  const current=currentVerificationCounts();
  if(!VERIFICATION_COUNTS.loaded){
    VERIFICATION_COUNTS.loaded=true;
    VERIFICATION_COUNTS.submitted=Math.max(Number(current.submitted)||0,0);
    VERIFICATION_COUNTS.pending=Math.max(Number(current.pending)||0,0);
    VERIFICATION_COUNTS.actionable=Math.max(Number(current.actionable)||VERIFICATION_COUNTS.pending,0);
    VERIFICATION_COUNTS.verified=Math.max(Number(current.verified)||0,0);
  }
  VERIFICATION_COUNTS.verified=Math.max(VERIFICATION_COUNTS.verified+delta,0);
  VERIFICATION_COUNTS.pending=Math.max(VERIFICATION_COUNTS.pending-delta,0);
  VERIFICATION_COUNTS.actionable=Math.max(VERIFICATION_COUNTS.actionable-delta,0);
  updateVerificationBadges();
}
async function loadVerificationCounts(){ if(!SB_SCHOOL||!SB_SCHOOL.id) return; const {data,error}=await verificationAction('summary'); if(error||!data||data.ok===false||!data.summary){ updateVerificationBadges(); return; } const summary=data.summary; VERIFICATION_COUNTS.loaded=true; VERIFICATION_COUNTS.submitted=Math.max(Number(summary.submitted)||0,0); VERIFICATION_COUNTS.pending=Math.max(Number(summary.pending)||0,0); VERIFICATION_COUNTS.actionable=Math.max(Number(summary.actionable)||0,VERIFICATION_COUNTS.pending); VERIFICATION_COUNTS.verified=Math.max(Number(summary.verified)||0,0); updateVerificationBadges(); }
async function loadVerificationSearch(force,page){ if(!SB_SCHOOL||!SB_SCHOOL.id) return; const input=$('verifySearchInput'); const query=((input&&input.value)||VERIFY_STATE.query||'').trim(); const changed=query!==VERIFY_STATE.query; VERIFY_STATE.query=query; const requestedPage=Math.max(Number(page)||(changed||force?1:VERIFY_STATE.page)||1,1); const meta=$('verifySearchMeta'); if(meta) meta.textContent=query?'Searching…':'Loading admitted students pending campus verification…'; const {data,error}=await verificationAction('search',{query,page:requestedPage,page_size:VERIFY_STATE.pageSize}); if(error||!data||data.ok===false){ if(meta) meta.textContent='Could not load verification results.'; toast((data&&data.message)||(error&&error.message)||'Could not search students'); return; } VERIFY_STATE.page=Number(data.page)||requestedPage; VERIFY_STATE.pageSize=Math.min(Math.max(Number(data.page_size)||50,1),50); VERIFY_STATE.total=Math.max(Number(data.total)||0,0); VERIFY_STATE.totalPages=Math.max(Number(data.total_pages)||1,1); VERIFY_STATE.rows=Array.isArray(data.rows)?data.rows:[]; renderVerificationSearch(); }
function renderVerificationSearch(){ const body=$('verifySearchRows'); const meta=$('verifySearchMeta'); if(!body||!meta) return; const rows=VERIFY_STATE.rows||[],total=VERIFY_STATE.total||0,page=VERIFY_STATE.page||1,pageSize=VERIFY_STATE.pageSize||50,totalPages=VERIFY_STATE.totalPages||1; const start=(page-1)*pageSize,from=total?start+1:0,to=Math.min(start+rows.length,total); meta.textContent=total?('Showing '+from+'–'+to+' of '+total+' matching student(s)'):'No matching admitted students found.'; const pageMeta=$('verifyPageMeta'),pagerMeta=$('verifyPagerMeta'),prev=$('verifyPrevBtn'),next=$('verifyNextBtn'); if(pageMeta)pageMeta.textContent='Showing '+from+'–'+to+' of '+total+' students'; if(pagerMeta)pagerMeta.textContent='Page '+page+' of '+totalPages+' · 50 per page'; if(prev)prev.disabled=page<=1; if(next)next.disabled=page>=totalPages; if(!rows.length){ body.innerHTML='<tr><td colspan="8" class="verify-empty">No matching admitted students found.</td></tr>'; return; } body.innerHTML=rows.map(function(row){ const photo=row.passport_photo_url?'<img class="verify-student-photo" src="'+escapeAttr(row.passport_photo_url)+'" alt="Passport">':'<div class="verify-student-photo" style="display:grid;place-items:center;color:var(--muted);font-size:11px">No photo</div>'; const verified=verificationStatusClass(row.verification_status)==='verified'; const rowId=escapeAttr(row.id||''); const actions=verified?'<div class="row-actions"><button class="act" data-qa-onclick="showVerificationSuccessById(\''+rowId+'\')">View</button><button class="act" data-qa-onclick="printVerificationSlipById(\''+rowId+'\')">Print slip</button></div>':'<div class="row-actions"><button class="act" data-qa-onclick="openVerifyStudentModal(\''+rowId+'\')">Verify Student</button></div>'; return '<tr><td>'+photo+'</td><td class="nm">'+safeHtml(row.full_name)+'<div class="verify-meta mono">'+safeHtml(row.bece_index)+'</div></td><td>'+safeHtml(row.programme||'—')+'</td><td>'+safeHtml(row.class_name||'—')+'</td><td>'+safeHtml(row.residential_status||'—')+'</td><td>'+verificationBadge(row.verification_status)+'</td><td class="mono">'+safeHtml(row.permanent_admission_number||'—')+'</td><td>'+actions+'</td></tr>'; }).join(''); }
function changeVerificationPage(delta){ const next=(VERIFY_STATE.page||1)+delta; if(next<1||next>(VERIFY_STATE.totalPages||1)) return; loadVerificationSearch(false,next); }
function verificationRecordById(id){ const fromSearch=(VERIFY_STATE.rows||[]).find(function(row){ return String(row.id)===String(id); }); if(fromSearch) return fromSearch; const fromCurrentPage=(VERIFIED_STATE.rows||[]).find(function(row){ return String(row.id)===String(id); }); if(fromCurrentPage) return fromCurrentPage; const fromVerified=(VERIFIED_STATE.allRows||[]).find(function(row){ return String(row.id)===String(id); }); if(fromVerified) return fromVerified; return null; }
function verificationInfoGrid(row){ return [['Student Name',row.full_name],['JHS Index Number',row.bece_index],['Programme',row.programme||'—'],['Class',row.class_name||'—'],['Residential Status',row.residential_status||'—'],['House',row.house_name||'—'],['Student Phone',row.student_phone||'—'],['Guardian Contact',row.guardian_contact||'—'],['Verification Status',verificationStatusLabel(row.verification_status)],['Permanent Admission Number',row.permanent_admission_number||'—']]; }
function showVerificationWorkspaceModal(){
  if(window.matchMedia('(min-width:1025px)').matches){
    const app=document.querySelector('.app');
    if(app) app.classList.remove('sidebar-hidden','sidebar-collapsed');
  }
  $('overlay').classList.add('show','student-verification-dialog');
  requestAnimationFrame(positionManageStudentEditor);
}
function openVerifyStudentModal(id){ const row=verificationRecordById(id); if(!row) return toast('Student not found'); const rowId=escapeAttr(id||''); const photo=row.passport_photo_url?'<img class="verify-modal-photo" src="'+escapeAttr(row.passport_photo_url)+'" alt="Passport">':'<div class="verify-modal-photo" style="display:grid;place-items:center;color:var(--muted);font-size:12px">No photo</div>'; const grid=verificationInfoGrid(row).map(function(item){ return '<div class="kv"><b>'+safeHtml(item[0])+':</b>'+safeHtml(item[1],'-')+'</div>'; }).join(''); $('modal').innerHTML='<div class="modal-head"><div><h2>Confirm Student Verification</h2><p>The admission number and house allocation will be saved together after confirmation.</p></div><button class="modal-x" data-qa-onclick="closeModal()">×</button></div><div class="modal-body"><div class="verify-slip-grid">'+photo+'<div><div class="grid-2 student-info-grid">'+grid+'</div><div class="panel panel-pad" style="margin:12px 0 0;background:#fff8e6;border:1px solid rgba(199,134,26,.22)"><b>Warning:</b> The first student successfully verified receives the first available permanent admission number for this school and admission year.</div></div></div></div><div class="modal-foot"><button class="btn btn-ghost" data-qa-onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="verifyConfirmBtn" data-qa-onclick="confirmVerifyStudent(\''+rowId+'\')">Confirm Verification</button></div>'; showVerificationWorkspaceModal(); }
async function confirmVerifyStudent(id){ if(VERIFY_STATE.submitting) return; const btn=$('verifyConfirmBtn'); VERIFY_STATE.submitting=true; if(btn){ btn.disabled=true; btn.textContent='Verifying…'; } const {data,error}=await verificationAction('verify',{student_id:id}); VERIFY_STATE.submitting=false; if(btn){ btn.disabled=false; btn.textContent='Confirm Verification'; } if(error||!data||data.ok===false){ toast((data&&data.message)||(error&&error.message)||'Verification failed'); return; } const record=verificationRecordById(id); if(record){ record.verification_status='verified'; record.permanent_admission_number=data.permanent_admission_number||record.permanent_admission_number; record.house_id=data.house_id||record.house_id; record.house_name=data.house_name||record.house_name; record.verified_at=data.verified_at||new Date().toISOString(); } syncLocalVerificationRecord(id,{verificationStatus:'verified',permAdm:data.permanent_admission_number||'',houseId:data.house_id||'',houseName:data.house_name||'',verifiedAt:data.verified_at||new Date().toISOString()}); applyVerificationCountDelta(1); renderStudentsRows(); renderRegisteredRows(); closeModal(); showVerificationSuccess(data.permanent_admission_number||'',record||verificationRecordById(id)); await Promise.all([loadVerificationCounts(),loadVerificationSearch(true,VERIFY_STATE.page||1),loadVerifiedStudents(VERIFIED_STATE.page||1,true)]); toast('Student verified and house allocated successfully'); }
function syncLocalVerificationRecord(id,patch){
  const copies=[...(students||[]),...(MANAGE_STATE.rows||[]),...(REG_STATE.rows||[])].filter(function(item){ return String(item._id)===String(id); });
  copies.forEach(function(row){
    if(patch.verificationStatus!==undefined) row.verificationStatus=patch.verificationStatus;
    if(patch.permAdm!==undefined){ row.permAdm=patch.permAdm; row.adm=patch.permAdm||row.legacyAdm||'-'; }
    if(patch.programmeId!==undefined){ row.progId=patch.programmeId||null; row.prog=patch.programmeId?row.prog:''; }
    if(patch.classId!==undefined){ row.classId=patch.classId||null; row.className=patch.classId?row.className:''; }
    if(patch.houseId!==undefined){ row.houseUuid=patch.houseId||''; row.houseId=patch.houseId?(hRev[patch.houseId]||row.houseId||null):null; }
    if(patch.houseName!==undefined){ row.houseName=patch.houseName; row.house=patch.houseName; }
    if(patch.verifiedAt!==undefined) row.verifiedAt=patch.verifiedAt;
  });
}
function showVerificationSuccess(permanentNo,row){ const record=row||{}; const canPrint=can('print_verification_slip'); const admissionNo=escapeAttr(permanentNo||record.permanent_admission_number||''); const rowId=escapeAttr(record.id||''); $('modal').innerHTML='<div class="modal-head"><div><h2>Student verified successfully.</h2><p>Admission number and house allocation saved.</p></div><button class="modal-x" data-qa-onclick="closeModal()">×</button></div><div class="modal-body"><div class="panel panel-pad" style="margin:0;background:#effcf4;border:1px solid rgba(22,101,52,.18)"><div style="font-size:13px;color:#166534;font-weight:700">Permanent Admission Number</div><div class="mono" style="font-size:28px;font-weight:800;color:#0f5132;margin-top:8px">'+safeHtml(permanentNo||record.permanent_admission_number||'—')+'</div><div style="font-size:13px;color:#166534;font-weight:700;margin-top:14px">House Allocation</div><div style="font-size:20px;font-weight:800;color:#0f5132;margin-top:5px">'+safeHtml(record.house_name||'—')+'</div></div><div class="grid-2 student-info-grid" style="margin-top:14px">'+verificationInfoGrid(record).map(function(item){ return '<div class="kv"><b>'+safeHtml(item[0])+':</b>'+safeHtml(item[1],'-')+'</div>'; }).join('')+'</div></div><div class="modal-foot"><button class="btn btn-ghost" data-qa-onclick="copyVerificationNumber(\''+admissionNo+'\')">Copy Number</button>'+(canPrint?'<button class="btn btn-primary" data-qa-onclick="printVerificationSlipById(\''+rowId+'\')">Print Verification Slip</button>':'')+'</div>'; showVerificationWorkspaceModal(); }
function showVerificationSuccessById(id){ const row=verificationRecordById(id); if(!row) return toast('Student not found'); showVerificationSuccess(row.permanent_admission_number,row); }
function copyVerificationNumber(value){ if(!value) return toast('No number to copy'); if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(value).then(function(){ toast('Permanent admission number copied'); }).catch(function(){ toast(value); }); } else { toast(value); } }
function setVerifiedSelectValue(select,value){ if(!select)return ''; const wanted=String(value||''); const exists=Array.from(select.options||[]).some(function(option){ return String(option.value)===wanted; }); select.value=exists?wanted:''; return select.value; }
function relatedVerifiedClasses(programmeId){ const wanted=String(programmeId||''); if(!wanted)return (classes||[]).slice(); const programme=(programmes||[]).find(function(p){ return String(p._id)===wanted; }); return (classes||[]).filter(function(c){ return (programme&&String(c.progId)===String(programme.id)) || String(pMap[c.progId]||'')===wanted; }); }
function relatedVerifiedHouses(residentialStatus){ const wanted=normalizeResidentialStatus(residentialStatus); if(!wanted)return (houses||[]).slice(); return (houses||[]).filter(function(h){ return normalizeResidentialStatus(h.rtype)===wanted; }); }
function fillVerifiedClassFilter(programmeId,selectedClass){ const cls=$('verf_class'); if(!cls)return; const rows=relatedVerifiedClasses(programmeId); const label=programmeId?'All related classes':'All classes'; cls.innerHTML='<option value="">'+label+'</option>'+rows.map(function(c){ return '<option value="'+c._id+'">'+safeHtml(c.name||c.code)+'</option>'; }).join(''); setVerifiedSelectValue(cls,selectedClass); }
function fillVerifiedHouseFilter(residentialStatus,selectedHouse){ const house=$('verf_house'); if(!house)return; const rows=relatedVerifiedHouses(residentialStatus); const label=residentialStatus?'All related houses':'All houses'; house.innerHTML='<option value="">'+label+'</option>'+rows.map(function(h){ return '<option value="'+h._id+'">'+safeHtml(h.name)+'</option>'; }).join(''); setVerifiedSelectValue(house,selectedHouse); }
function onVerifiedProgrammeFilterChange(){ fillVerifiedClassFilter(val('verf_programme'),''); }
function onVerifiedResidentialFilterChange(){ fillVerifiedHouseFilter(val('verf_residential'),''); }
function fillVerifiedFilterOptions(){ const prog=$('verf_programme'), cls=$('verf_class'), house=$('verf_house'), residential=$('verf_residential'); const filters=VERIFIED_STATE.filters||{}; const selectedProgramme=(prog&&prog.value)||filters.programme_id||''; const selectedClass=(cls&&cls.value)||filters.class_id||''; const selectedResidential=(residential&&residential.value)||filters.residential_status||''; const selectedHouse=(house&&house.value)||filters.house_id||''; if(prog){ prog.innerHTML='<option value="">All programmes</option>'+(programmes||[]).map(function(p){ return '<option value="'+p._id+'">'+safeHtml(p.name||p.code)+'</option>'; }).join(''); setVerifiedSelectValue(prog,selectedProgramme); } if(residential)setVerifiedSelectValue(residential,selectedResidential); fillVerifiedClassFilter(prog&&prog.value,selectedClass); fillVerifiedHouseFilter(residential&&residential.value,selectedHouse); }
function collectVerifiedFilters(){ return {search:val('verf_search')||'',gender:val('verf_gender')||'',programme_id:val('verf_programme')||'',class_id:val('verf_class')||'',residential_status:val('verf_residential')||'',house_id:val('verf_house')||'',date_from:val('verf_date_from')||'',date_to:val('verf_date_to')||'',page_size:VERIFIED_STATE.pageSize}; }
function applyVerifiedFilters(){ VERIFIED_STATE.filters=collectVerifiedFilters(); loadVerifiedStudents(1); }
function clearVerifiedFilters(){ ['verf_search','verf_gender','verf_programme','verf_class','verf_residential','verf_house','verf_date_from','verf_date_to'].forEach(function(id){ const el=$(id); if(el) el.value=''; }); VERIFIED_STATE.filters={}; loadVerifiedStudents(1); }
function activeFilterPills(filters){ const items=[]; if(filters.search) items.push('Search: '+filters.search); if(filters.gender) items.push('Gender: '+(filters.gender==='M'?'Male':'Female')); if(filters.programme_id){ const prog=(programmes||[]).find(function(p){ return String(p._id)===String(filters.programme_id); }); if(prog) items.push('Programme: '+prog.name); } if(filters.class_id){ const cls=(classes||[]).find(function(c){ return String(c._id)===String(filters.class_id); }); if(cls) items.push('Class: '+cls.name); } if(filters.residential_status) items.push('Residential: '+filters.residential_status); if(filters.house_id){ const house=(houses||[]).find(function(h){ return String(h._id)===String(filters.house_id); }); if(house) items.push('House: '+house.name); } if(filters.date_from) items.push('From: '+filters.date_from); if(filters.date_to) items.push('To: '+filters.date_to); return items; }
async function loadVerifiedStudents(page,silent){
  if(!SB_SCHOOL||!SB_SCHOOL.id) return;
  fillVerifiedFilterOptions();
  const requestedPage=Math.max(Number(page)||1,1);
  const filters=Object.assign({},VERIFIED_STATE.filters||collectVerifiedFilters(),{page:requestedPage,page_size:25});
  VERIFIED_STATE.filters=Object.assign({},filters);
  const {data,error}=await verificationAction('list_verified',{filters});
  if(error||!data||data.ok===false){ if(!silent) toast((data&&data.message)||(error&&error.message)||'Could not load verified students'); return; }
  const total=Math.max(Number(data.total)||0,0);
  const totalPages=Math.max(Math.ceil(total/25),1);
  if(requestedPage>totalPages) return loadVerifiedStudents(totalPages,silent);
  VERIFIED_STATE.page=requestedPage;
  VERIFIED_STATE.pageSize=25;
  VERIFIED_STATE.total=total;
  VERIFIED_STATE.totalPages=totalPages;
  VERIFIED_STATE.rows=(Array.isArray(data.rows)?data.rows:[]).slice(0,25);
  VERIFIED_STATE.allRows=Array.isArray(data.all_rows)?data.all_rows:[];
  VERIFIED_STATE.summary=data.summary||VERIFIED_STATE.summary;
  renderVerifiedStudents();
}
function renderVerifiedSummary(){ const host=$('verifiedSummaryCards'); if(!host) return; const s=VERIFIED_STATE.summary||{}; const cards=[['Total Verified',s.total_verified||0],['Male',s.male||0],['Female',s.female||0],['Day Students',s.day_students||0],['Boarding Students',s.boarding_students||0],['Verified Today',s.verified_today||0]]; host.innerHTML=cards.map(function(card){ return '<div class="verify-card"><div class="lbl">'+safeHtml(card[0])+'</div><div class="val">'+safeHtml(String(card[1]))+'</div></div>'; }).join(''); }
function renderVerifiedStudents(){ renderVerifiedSummary(); const pills=activeFilterPills(VERIFIED_STATE.filters||{}); const pillHost=$('verifiedActiveFilters'); if(pillHost) pillHost.innerHTML=pills.map(function(item){ return '<span>'+safeHtml(item)+'</span>'; }).join(''); const body=$('verifiedStudentsRows'); if(!body) return; const rows=VERIFIED_STATE.rows||[]; const start=rows.length?((VERIFIED_STATE.page-1)*25)+1:0,end=rows.length?start+rows.length-1:0; $('verifiedResultCount').textContent=String(VERIFIED_STATE.total||rows.length); $('verifiedPagerMeta').textContent='Page '+(VERIFIED_STATE.page||1)+' of '+(VERIFIED_STATE.totalPages||1)+' · 25 per page'; $('verifiedCountMeta').textContent='Showing '+start+'–'+end+' of '+(VERIFIED_STATE.total||0)+' verified student(s)'; const prev=$('verifiedPrevBtn'),next=$('verifiedNextBtn'); if(prev)prev.disabled=(VERIFIED_STATE.page||1)<=1; if(next)next.disabled=(VERIFIED_STATE.page||1)>=(VERIFIED_STATE.totalPages||1); if(!rows.length){ body.innerHTML='<tr><td colspan="13" class="verify-empty">No verified students match the current filters.</td></tr>'; return; } body.innerHTML=rows.map(function(row,idx){ const sn=((VERIFIED_STATE.page-1)*VERIFIED_STATE.pageSize)+idx+1; const photo=row.passport_photo_url?'<img class="verify-student-photo" src="'+escapeAttr(row.passport_photo_url)+'" alt="Passport">':'<div class="verify-student-photo" style="display:grid;place-items:center;color:var(--muted);font-size:11px">No photo</div>'; const rowId=escapeAttr(row.id||''); const actions=['<button class="act" data-qa-onclick="openVerifiedStudentDetails(\''+rowId+'\')">View Details</button>']; if(can('print_verification_slip')) actions.push('<button class="act" data-qa-onclick="printVerificationSlipById(\''+rowId+'\')">Print Verification Slip</button>'); if(can('reverse_student_verification')) actions.push('<button class="act" data-qa-onclick="reverseVerificationById(\''+rowId+'\')">Reverse Verification</button>'); return '<tr><td class="mono">'+sn+'</td><td>'+photo+'</td><td class="mono">'+safeHtml(row.permanent_admission_number||'—')+'</td><td class="mono">'+safeHtml(row.bece_index)+'</td><td class="nm">'+safeHtml(row.full_name)+'</td><td>'+safeHtml(row.gender||'—')+'</td><td>'+safeHtml(row.programme||'—')+'</td><td>'+safeHtml(row.class_name||'—')+'</td><td>'+safeHtml(row.residential_status||'—')+'</td><td>'+safeHtml(row.house_name||'—')+'</td><td>'+safeHtml((row.verified_at||'').slice(0,10),'—')+'</td><td>'+safeHtml(row.verified_by_name||'—')+'</td><td><div class="row-actions">'+actions.join('')+'</div></td></tr>'; }).join(''); }
function changeVerifiedPage(delta){ const next=(VERIFIED_STATE.page||1)+delta; if(next<1||next>(VERIFIED_STATE.totalPages||1)) return; loadVerifiedStudents(next); }
let verificationAutoRefreshBusy=false;
async function refreshVerificationDataAutomatically(){
  if(verificationAutoRefreshBusy||!SB_SCHOOL||!SB_SCHOOL.id||document.visibilityState==='hidden') return;
  verificationAutoRefreshBusy=true;
  try{
    const tasks=[loadVerificationCounts()];
    const verifiedView=$('view-verified-students');
    if(verifiedView&&verifiedView.classList.contains('active')) tasks.push(loadVerifiedStudents(VERIFIED_STATE.page||1,true));
    await Promise.allSettled(tasks);
  }finally{
    verificationAutoRefreshBusy=false;
  }
}
setInterval(refreshVerificationDataAutomatically,20000);
window.addEventListener('focus',refreshVerificationDataAutomatically);
document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') refreshVerificationDataAutomatically(); });
function openVerifiedStudentDetails(id){ const row=verificationRecordById(id); if(!row) return toast('Student not found'); const photo=row.passport_photo_url?'<img class="verify-modal-photo" src="'+escapeAttr(row.passport_photo_url)+'" alt="Passport">':'<div class="verify-modal-photo" style="display:grid;place-items:center;color:var(--muted);font-size:12px">No photo</div>'; $('modal').innerHTML='<div class="modal-head"><div><h2>Verified Student Details</h2><p>'+safeHtml(row.permanent_admission_number||'—')+'</p></div><button class="modal-x" data-qa-onclick="closeModal()">×</button></div><div class="modal-body"><div class="verify-slip-grid">'+photo+'<div><div class="grid-2 student-info-grid">'+verificationInfoGrid(row).map(function(item){ return '<div class="kv"><b>'+safeHtml(item[0])+':</b>'+safeHtml(item[1],'-')+'</div>'; }).join('')+'</div></div></div></div><div class="modal-foot"><button class="btn btn-ghost" data-qa-onclick="closeModal()">Close</button></div>'; if(window.matchMedia('(min-width:1025px)').matches){const app=document.querySelector('.app');if(app)app.classList.remove('sidebar-hidden','sidebar-collapsed');} $('overlay').classList.add('show','verified-student-details'); requestAnimationFrame(positionManageStudentEditor); }
function buildVerificationSlipHtml(row,title){ const crest=row.school_crest?'<img src="'+escapeAttr(row.school_crest)+'" alt="School logo" style="width:82px;height:82px;object-fit:contain">':''; const photo=row.passport_photo_url?'<img src="'+escapeAttr(row.passport_photo_url)+'" alt="Passport" style="width:110px;height:132px;object-fit:cover;border-radius:12px;border:1px solid #d1d5db">':''; const meta=[['Student full name',row.full_name],['Permanent admission number',row.permanent_admission_number||'—'],['JHS index number',row.bece_index],['Programme',row.programme||'—'],['Class',row.class_name||'—'],['Residential status',row.residential_status||'—'],['House',row.house_name||'—'],['Verification date',(row.verified_at||'').slice(0,10)||'—'],['Verified by',row.verified_by_name||'—']]; return '<html><head><title>'+safeHtml(title)+'</title><style>@page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;color:#0f172a;padding:18px}table{width:100%;border-collapse:collapse}td{border:1px solid #d1d5db;padding:8px 10px;font-size:12px}.head{display:flex;align-items:center;gap:14px;margin-bottom:14px;padding:16px;border-radius:16px;background:linear-gradient(135deg,#14532d 0%,#16a34a 100%);color:#fff}.head h1{margin:0;font-size:22px}.head p{margin:4px 0 0;font-size:12px;color:rgba(255,255,255,.92)}.grid{display:grid;grid-template-columns:130px 1fr;gap:18px;align-items:start}.sign{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:34px}.line{margin-top:42px;border-top:1px solid #1f2937;padding-top:6px;font-size:12px}</style></head><body><div class="head">'+crest+'<div><h1>'+safeHtml(row.school_name||exportSchoolName())+'</h1><p>'+safeHtml(title)+'</p><p>Academic Year: '+safeHtml(row.academic_year||exportAdmissionYear()||'—')+'</p></div></div><div class="grid">'+(photo||'<div></div>')+'<table>'+meta.map(function(item){ return '<tr><td style="width:32%;font-weight:700">'+safeHtml(item[0])+'</td><td>'+safeHtml(item[1],'-')+'</td></tr>'; }).join('')+'</table></div><div class="sign"><div><div class="line">Admission Officer Signature</div></div><div><div class="line">Head of School Signature</div></div></div></body></html>'; }
function printVerificationSlipById(id){ const row=verificationRecordById(id); if(!row) return toast('Student not found'); const w=window.open('','_blank'); if(!w){ toast('Allow pop-ups to print / save PDF'); return; } w.document.write(buildVerificationSlipHtml(row,'Verification Slip')); w.document.close(); setTimeout(function(){ w.print(); },300); }
function reprintAdmissionLetterById(id){ const row=verificationRecordById(id); if(!row) return toast('Student not found'); const w=window.open('','_blank'); if(!w){ toast('Allow pop-ups to print / save PDF'); return; } const crest=row.school_crest?'<img src="'+escapeAttr(row.school_crest)+'" alt="School logo" style="width:72px;height:72px;object-fit:contain">':''; w.document.write('<html><head><title>Admission Letter</title><style>@page{size:A4;margin:15mm}body{font-family:Arial,sans-serif;color:#111827;padding:24px}.head{display:flex;align-items:center;gap:12px;border-bottom:2px solid #111827;padding-bottom:12px;margin-bottom:18px}.title{font-size:24px;font-weight:800}.meta{font-size:12px;color:#4b5563}.letter{font-size:14px;line-height:1.7}.sign{margin-top:40px;border-top:1px solid #111827;padding-top:8px;width:260px}</style></head><body><div class="head">'+crest+'<div><div class="title">'+safeHtml(row.school_name||exportSchoolName())+'</div><div class="meta">Admission Letter · Academic Year '+safeHtml(row.academic_year||exportAdmissionYear()||'—')+'</div></div></div><div class="letter"><p>Date: '+safeHtml(new Date().toLocaleDateString('en-GB'))+'</p><p>Dear <b>'+safeHtml(row.full_name)+'</b>,</p><p>This is to confirm that your admission to <b>'+safeHtml(row.school_name||exportSchoolName())+'</b> has been verified on campus.</p><p>Your permanent admission number is <b>'+safeHtml(row.permanent_admission_number||'—')+'</b>.</p><p>You are enrolled under the programme <b>'+safeHtml(row.programme||'—')+'</b>'+(row.class_name?(' in class <b>'+safeHtml(row.class_name)+'</b>'):'')+'. '+(row.house_name?('House allocation: <b>'+safeHtml(row.house_name)+'</b>. '):'')+'Residential status: <b>'+safeHtml(row.residential_status||'—')+'</b>.</p><p>Please keep this letter together with your verification slip for school records.</p><div class="sign">'+safeHtml(exportHeadLabel())+'</div></div></body></html>'); w.document.close(); setTimeout(function(){ w.print(); },300); }
function reverseVerificationById(id){ const row=verificationRecordById(id); if(!row) return toast('Student not found'); const rowId=escapeAttr(id||''); $('modal').innerHTML='<div class="modal-head"><div><h2>Reverse Verification</h2><p>This action returns the student to pending verification. A note is optional.</p></div><button class="modal-x" data-qa-onclick="closeModal()">×</button></div><div class="modal-body"><div class="panel panel-pad" style="margin:0;background:#fff1f2;border:1px solid rgba(153,27,27,.16)"><b>Warning:</b> The permanent admission number, programme and house assignment will be released. The current classroom will stay assigned. Choose a programme that is linked to this classroom before verifying the student again. The next verification fills the lowest admission-number gap and allocates a house afresh using occupancy and configured priority.</div><div class="grid-2 student-info-grid" style="margin-top:14px">'+verificationInfoGrid(row).slice(0,6).map(function(item){ return '<div class="kv"><b>'+safeHtml(item[0])+':</b>'+safeHtml(item[1],'-')+'</div>'; }).join('')+'</div><div class="field" style="margin-top:14px"><label>Note (optional)</label><textarea id="verification_reverse_reason" rows="4" placeholder="Add a note about this reversal"></textarea></div></div><div class="modal-foot"><button class="btn btn-ghost" data-qa-onclick="closeModal()">Cancel</button><button class="btn btn-danger" data-qa-onclick="confirmReverseVerification(\''+rowId+'\')">Reverse Verification</button></div>'; showVerificationWorkspaceModal(); }
async function confirmReverseVerification(id){ const reason=(document.getElementById('verification_reverse_reason')&&document.getElementById('verification_reverse_reason').value||'').trim(); const {data,error}=await verificationAction('reverse',{student_id:id,reason}); if(error||!data||data.ok===false){ toast((data&&data.message)||(error&&error.message)||'Could not reverse verification'); return; } syncLocalVerificationRecord(id,{verificationStatus:'pending',permAdm:'',programmeId:'',houseId:'',houseName:'',verifiedAt:''}); applyVerificationCountDelta(-1); closeModal(); await Promise.all([loadVerificationCounts(),loadVerificationSearch(true),loadVerifiedStudents(VERIFIED_STATE.page||1,true)]); toast('Verification reversed; admission number, programme and house released. Classroom retained.'); }
async function exportVerifiedStudentsExcel(){ if(!can('export_verified_students')) return toast('You do not have permission to export verified students'); const {data,error}=await verificationAction('list_verified',{filters:Object.assign({},VERIFIED_STATE.filters||collectVerifiedFilters(),{page:1,page_size:5000})}); if(error||!data||!Array.isArray(data.all_rows)||!data.all_rows.length){ toast('No verified students match the current filters'); return; } const rows=data.all_rows; const headers=['S/N','Permanent Admission Number','JHS Index Number','Student Name','Gender','Programme','Class','Residential Status','House','Student Contact','Guardian Contact','Verification Date','Verified By']; const body=rows.map(function(row,idx){ return [idx+1,row.permanent_admission_number||'',row.bece_index||'',row.full_name||'',row.gender||'',row.programme||'',row.class_name||'',row.residential_status||'',row.house_name||'',row.student_phone||'',row.guardian_contact||'',(row.verified_at||'').slice(0,10),row.verified_by_name||'']; }); downloadExcelRows('verified-students-'+((rows[0]&&rows[0].school_code)||'SCHOOL')+'-'+(exportAdmissionYear()||new Date().getFullYear()),'Verified Students',headers,body,'Verified Students Report',rows.length); }
async function exportVerifiedStudentsPdf(){ if(!can('export_verified_students')) return toast('You do not have permission to export verified students'); const {data,error}=await verificationAction('list_verified',{filters:Object.assign({},VERIFIED_STATE.filters||collectVerifiedFilters(),{page:1,page_size:5000})}); if(error||!data||!Array.isArray(data.all_rows)||!data.all_rows.length){ toast('No verified students match the current filters'); return; } const rows=data.all_rows; const headers=['S/N','Permanent Admission Number','JHS Index Number','Student Name','Gender','Programme','Class','Residential Status','House','Verification Date','Verified By']; const tableRows=rows.map(function(row,idx){ return [idx+1,row.permanent_admission_number||'',row.bece_index||'',row.full_name||'',row.gender||'',row.programme||'',row.class_name||'',row.residential_status||'',row.house_name||'',(row.verified_at||'').slice(0,10),row.verified_by_name||'']; }); const crest=(rows[0]&&rows[0].school_crest)||''; const schoolName=(rows[0]&&rows[0].school_name)||exportSchoolName(); const admissionYear=(rows[0]&&rows[0].academic_year)||exportAdmissionYear(); const filters=activeFilterPills(VERIFIED_STATE.filters||{}); const generated=new Date().toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); const w=window.open('','_blank'); if(!w){ toast('Allow pop-ups to print / save PDF'); return; } w.document.write('<html><head><title>Verified Students Report</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#111827;padding:18px 20px 10px}.pdf-head{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:12px;padding:14px 16px;border-radius:14px;background:linear-gradient(135deg,#14532d 0%,#16a34a 100%);color:#ffffff}.pdf-brand{display:flex;align-items:center;gap:12px}.pdf-brand img{width:62px;height:62px;object-fit:contain}.pdf-title{font-size:24px;font-weight:800;line-height:1.1}.pdf-sub{font-size:12px;color:rgba(255,255,255,.9);margin-top:4px}.pdf-meta{text-align:right;font-size:12px;color:#ffffff}.pdf-filters{margin:10px 0 12px;font-size:12px;color:#334155}.pdf-filters span{display:inline-block;margin:0 8px 8px 0;padding:5px 8px;border-radius:999px;background:#e8f0ff;color:#123a78;font-weight:700}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #111827;padding:6px 7px;vertical-align:top;text-align:left}th{background:linear-gradient(135deg,#14532d 0%,#16a34a 100%);color:#fff;font-weight:700}tbody tr:nth-child(even){background:#fafafa}.pdf-foot{margin-top:18px;font-size:11px;color:#4b5563;display:flex;justify-content:space-between;gap:18px}.sign{display:flex;justify-content:space-between;gap:30px;margin-top:32px}.sign div{width:240px;border-top:1px solid #1f2937;padding-top:8px}</style></head><body><div class="pdf-head"><div class="pdf-brand">'+(crest?'<img src="'+escapeAttr(crest)+'" alt="">':'')+'<div><div class="pdf-title">'+safeHtml(schoolName)+'</div><div class="pdf-sub">Verified Students Report · Academic Year '+safeHtml(admissionYear||'—')+'</div></div></div><div class="pdf-meta"><div><b>Generated:</b> '+safeHtml(generated)+'</div><div><b>Total records:</b> '+rows.length+'</div></div></div><div class="pdf-filters">'+(filters.length?filters.map(function(item){ return '<span>'+safeHtml(item)+'</span>'; }).join(''):'<span>All verified students</span>')+'</div><table><thead><tr>'+headers.map(function(h){ return '<th>'+safeHtml(h)+'</th>'; }).join('')+'</tr></thead><tbody>'+tableRows.map(function(r){ return '<tr>'+r.map(function(c){ return '<td>'+safeHtml(c==null?'':String(c),'&mdash;')+'</td>'; }).join('')+'</tr>'; }).join('')+'</tbody></table><div class="sign"><div>Admission Officer</div><div>Head of School</div></div><div class="pdf-foot"><div>'+safeHtml(exportHeadLabel())+'</div><div>Page 1 of 1</div></div></body></html>'); w.document.close(); setTimeout(function(){ w.print(); },350); }
const titles={dashboard:['Dashboard','Admission overview for 2025/2026'],setup:['School Setup','Profile, calendar and admission configuration'],portal:['Student Portal Setup','Control what students see and fill in'],programmes:['Programmes','Define programmes and subject combinations'],houses:['Houses','Manage houses and allocation'],classes:['Classrooms','Manage classes and capacity'],placement:['Placement List','Import and manage CSSPS placements'],students:['Admission List','Browse submitted student records'],'verify-students':['Verify Student','Search admitted students and assign permanent admission numbers'],'verified-students':['Verified Students','Campus-verified students, filters and exports'],'manage-students':['Manage Students','Edit submitted student records'],'house-alloc':['Manage House Allocation','Assign students to houses'],'class-alloc':['Manage Class Allocation','Assign students to classes'],finance:['Financials','Payments overview and transaction history'],sms:['SMS','Programme-based bulk notifications'],'sms-settings':['SMS Settings','Sender ID, submission template and test delivery'],reports:['Reports','Enrolment analytics'],templates:['Document templates','Design your admission letter & records printout'],users:['Users','Manage who can sign in to this school'],utilities:['Utilities','Account and document tools']};
function go(view){
  closeModal();
  closeReports();
  if(!can(VIEW_CAP[view])){ view=firstAllowedView(); }
  const actualView=view==='sms-settings'?'setup':view;
  document.body.classList.toggle('qa-admin-footer-bottom-view',['manage-students','house-alloc','class-alloc'].includes(view));
  document.querySelectorAll('.nav-item,.nav-sub').forEach(n=>n.classList.toggle('active',n.dataset.view===view));
  // open the category containing the active view, collapse the rest
  document.querySelectorAll('#nav .nav-group').forEach(g=>g.classList.remove('open'));
  { const cur=[...document.querySelectorAll('#nav [data-view]')].find(n=>n.dataset.view===view); const grp=cur&&cur.closest('.nav-group'); if(grp)grp.classList.add('open'); }
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+actualView));
  { const ns=document.getElementById('navSelect'); if(ns&&ns.value!==view) ns.value=view; }
  $('pagetitle').firstChild.textContent=titles[view][0];
  $('pagesub').textContent=(view==='dashboard')?('Admission overview for '+((SB_CFG&&SB_CFG.academic_year)||'2025/2026')):titles[view][1];
  if(view==='sms-settings') setupTab(3);
  if(view==='setup') setupTab(0);
  if(view==='dashboard'){renderStats();renderRecent();refreshDashboardSummary(true);loadVerificationCounts();}
  if(view==='programmes')renderProg();
  if(view==='houses')renderHouses();
  if(view==='classes')renderClasses();
  if(view==='placement'){renderPlacement();loadPlacementRecords().then(renderPlacement);}
  if(view==='students')renderRegistered();
  if(view==='verify-students'){loadVerificationCounts();loadVerificationSearch(true);}
  if(view==='verified-students'){loadVerificationCounts();loadVerifiedStudents(1);}
  if(view==='manage-students')renderStudents();
  if(view==='house-alloc'){renderHouseAlloc();ensureStudentCache().then(renderHouseAlloc);}
  if(view==='class-alloc'){renderClassAlloc();ensureStudentCache().then(renderClassAlloc);}
  if(view==='finance'){renderFinance();loadFinancePayments().then(renderFinance);}
  if(view==='sms'){renderSms();Promise.all([loadPlacementRecords(),ensureStudentCache(),loadSmsHistory()]).then(renderSms);}
  if(view==='sms-settings') fillSmsSettingsForm();
  if(view==='users')renderUsers();
  if(view==='templates')renderTemplates();
  if(view==='reports')buildCharts();
  if(view==='portal')fillPortalSetupForm();
  if(view==='utilities'){renderLog();loadActivityLog().then(renderLog);}
  const admViews=['students','verify-students','verified-students','manage-students','house-alloc','class-alloc'];
  const inAdm=admViews.indexOf(view)>-1;
  document.getElementById('admParent').classList.toggle('active',inAdm);
  if(inAdm) setAdmMenu(true);
  closeSidebar();resetAdminScroll();
}
function setAdmMenu(open){document.getElementById('admMenu').classList.toggle('open',open);document.getElementById('admParent').classList.toggle('open',open);}
function toggleAdmMenu(){const m=document.getElementById('admMenu');setAdmMenu(!m.classList.contains('open'));}
function toggleNavGroup(lbl){
  const g=lbl.closest('.nav-group'); if(!g)return;
  const willOpen=!g.classList.contains('open');
  document.querySelectorAll('#nav .nav-group').forEach(x=>x.classList.remove('open'));
  if(willOpen) g.classList.add('open');
}
$('nav').addEventListener('click',e=>{const b=e.target.closest('.nav-item,.nav-sub');if(b&&b.dataset.view)go(b.dataset.view);});
// Phone/contact fields: digits only, max 10 (e.g. pl_sms, ep_sms, es_sms)
document.addEventListener('input',function(e){
  const el=e.target;
  if(el&&el.tagName==='INPUT'&&(/sms|phone|contact/i.test(el.id)||el.type==='tel'||el.getAttribute('inputmode')==='tel')){
    const v=(el.value||'').replace(/\D/g,'').slice(0,10);
    if(v!==el.value) el.value=v;
  }
});

/* ===== MODAL / SIDEBAR ===== */
function closeModal(){const overlay=$('overlay');overlay.classList.remove('show','manage-student-editor','student-verification-dialog','verified-student-details','class-subject-details','user-account-editor');overlay.style.removeProperty('--manage-editor-top');overlay.style.removeProperty('--manage-editor-left');overlay.style.removeProperty('--manage-editor-bottom');}
$('overlay').addEventListener('click',e=>{if(e.target===$('overlay'))closeModal();});
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

/* ===== LIVE ===== */
window._today=0;

/* ===== INIT ===== */
fillSelects();renderStats();renderRecent();buildColvis();updateVerificationBadges();
