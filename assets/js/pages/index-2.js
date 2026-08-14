const SUPABASE_URL='https://datxaylostmyroleisdl.supabase.co';
const SUPABASE_KEY='sb_publishable_c9WlfiojT_wz4uesb3lYaw_91QoIErh';
let PAYSTACK_PUBLIC_KEY='';
let PAYSTACK_CONFIG={loaded:false,public_mode:'unknown',public_key_present:false,secret_present:false,mode_mismatch:false};
const SCHOOL_CODE=null; // schools are resolved automatically from the index number
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false}});
const PASSWORD_RECOVERY_REQUESTED=(function(){
  try{
    const query=new URLSearchParams(window.location.search||'');
    const hash=new URLSearchParams(String(window.location.hash||'').replace(/^#/,''));
    return query.get('type')==='recovery'||hash.get('type')==='recovery'||query.has('code');
  }catch(e){return false;}
})();
let passwordRecoveryPending=false;
function setPasswordRecoveryMessage(message,isError){
  const el=document.getElementById('passwordRecoveryMessage');
  if(!el)return;
  el.textContent=message||'';
  el.classList.toggle('is-error',!!isError);
  el.style.display=message?'block':'none';
}
function showPasswordRecoveryGate(){
  const gate=document.getElementById('passwordRecoveryGate');
  if(!gate)return;
  document.body.classList.remove('booting');
  document.body.classList.add('password-recovery-active');
  gate.hidden=false;
}
async function initializePasswordRecovery(){
  showPasswordRecoveryGate();
  setPasswordRecoveryMessage('Verifying your password reset link...',false);
  try{
    const result=await sb.auth.getSession();
    if(result.error||!result.data||!result.data.session){
      setPasswordRecoveryMessage('This reset link is invalid or has expired. Return to the appropriate admin login and request a new link.',true);
      return;
    }
    setPasswordRecoveryMessage('Reset link verified. Enter your new password.',false);
    const password=document.getElementById('recoveryNewPassword');
    if(password)password.focus();
  }catch(e){
    setPasswordRecoveryMessage((e&&e.message)||'Could not verify this reset link.',true);
  }
}
async function completePasswordRecovery(){
  const password=document.getElementById('recoveryNewPassword');
  const confirmPassword=document.getElementById('recoveryConfirmPassword');
  const button=document.getElementById('passwordRecoveryButton');
  if(passwordRecoveryPending||!password||!confirmPassword||!button)return;
  if(password.value.length<10||!/[a-z]/.test(password.value)||!/[A-Z]/.test(password.value)||!/[0-9]/.test(password.value)||!(/[^A-Za-z0-9]/.test(password.value))){
    setPasswordRecoveryMessage('Use at least 10 characters with upper and lowercase letters, a number and a symbol.',true);
    password.focus();
    return;
  }
  if(password.value!==confirmPassword.value){
    setPasswordRecoveryMessage('The two passwords do not match.',true);
    confirmPassword.focus();
    return;
  }
  passwordRecoveryPending=true;
  button.disabled=true;
  button.textContent='UPDATING PASSWORD...';
  setPasswordRecoveryMessage('',false);
  try{
    const sessionResult=await sb.auth.getSession();
    if(sessionResult.error||!sessionResult.data||!sessionResult.data.session)throw new Error('This reset link is invalid or has expired. Request a new link.');
    const result=await sb.auth.updateUser({password:password.value});
    if(result.error)throw result.error;
    try{await sb.auth.signOut();}catch(ignore){}
    try{window.history.replaceState({},document.title,window.location.pathname);}catch(ignore){}
    password.value='';
    confirmPassword.value='';
    document.getElementById('passwordRecoveryForm').hidden=true;
    document.getElementById('passwordRecoveryTitle').textContent='Password updated';
    document.getElementById('passwordRecoveryIntro').textContent='Your password was changed successfully. You can now return to your admin login page and sign in.';
    setPasswordRecoveryMessage('',false);
  }catch(e){
    setPasswordRecoveryMessage((e&&e.message)||'Could not update the password. Request a new reset link.',true);
  }finally{
    passwordRecoveryPending=false;
    button.disabled=false;
    button.textContent='UPDATE PASSWORD';
  }
}
if(PASSWORD_RECOVERY_REQUESTED){
  sb.auth.onAuthStateChange(function(event){
    if(event!=='PASSWORD_RECOVERY')return;
    showPasswordRecoveryGate();
    setPasswordRecoveryMessage('Reset link verified. Enter your new password.',false);
  });
  const recoveryForm=document.getElementById('passwordRecoveryForm');
  if(recoveryForm)recoveryForm.addEventListener('submit',function(event){event.preventDefault();completePasswordRecovery();});
}
const PORTAL_ROOT_DOMAIN='quickadmissiongh.com';
const RESERVED_PORTAL_SUBDOMAINS=new Set(['www','admin','api','mail','ftp','support','staging','app','dashboard','cdn','static','assets','auth','login','portal','superadmin','super-admin','school-admin']);
function currentPortalSubdomain(){
  const host=String((window.location&&window.location.hostname)||'').toLowerCase().replace(/\.$/,'');
  if(!host||host===PORTAL_ROOT_DOMAIN||host==='www.'+PORTAL_ROOT_DOMAIN||!host.endsWith('.'+PORTAL_ROOT_DOMAIN))return '';
  const label=host.slice(0,-(PORTAL_ROOT_DOMAIN.length+1));
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(label)&&!RESERVED_PORTAL_SUBDOMAINS.has(label)?label:'';
}
const TENANT_PORTAL={subdomain:currentPortalSubdomain(),checked:false,school:null,error:'',promise:null};
function tenantPortalRequested(){return !!TENANT_PORTAL.subdomain;}
function platformDirectoryRequested(){return !tenantPortalRequested();}
function tenantSchoolId(){return TENANT_PORTAL.school&&TENANT_PORTAL.school.id?String(TENANT_PORTAL.school.id):'';}
function syncDirectoryViewport(){
  if(!platformDirectoryRequested()){
    document.documentElement.style.removeProperty('--directory-viewport-height');
    return;
  }
  const viewportHeight=window.visualViewport&&window.visualViewport.height
    ? window.visualViewport.height
    : window.innerHeight;
  document.documentElement.style.setProperty('--directory-viewport-height',Math.ceil(viewportHeight)+'px');
}
function configurePortalEntryView(){
  const directory=document.getElementById('schoolDirectoryPage');
  const tenantOnly=document.querySelectorAll('.tenant-portal-only');
  const showDirectory=platformDirectoryRequested();
  document.documentElement.classList.toggle('platform-directory-active',showDirectory);
  document.body.classList.toggle('platform-directory-active',showDirectory);
  syncDirectoryViewport();
  if(directory){
    directory.hidden=!showDirectory;
    directory.setAttribute('aria-hidden',showDirectory?'false':'true');
  }
  tenantOnly.forEach(function(node){
    node.hidden=showDirectory;
    node.setAttribute('aria-hidden',showDirectory?'true':'false');
  });
}
async function resolveTenantSchool(){
  if(!tenantPortalRequested())return null;
  if(TENANT_PORTAL.checked)return TENANT_PORTAL.school;
  if(TENANT_PORTAL.promise)return TENANT_PORTAL.promise;
  TENANT_PORTAL.promise=(async function(){
    try{
      const {data,error}=await sb.rpc('resolve_school_by_subdomain',{p_subdomain:TENANT_PORTAL.subdomain});
      if(error)throw error;
      const row=Array.isArray(data)?data[0]:data;
      TENANT_PORTAL.school=row&&row.id?row:null;
      TENANT_PORTAL.error=TENANT_PORTAL.school?'':'not_found';
    }catch(e){
      TENANT_PORTAL.school=null;
      TENANT_PORTAL.error='unavailable';
      console.warn('School portal lookup failed',e);
    }finally{
      TENANT_PORTAL.checked=true;
    }
    return TENANT_PORTAL.school;
  })();
  return TENANT_PORTAL.promise;
}
(function(){var b=document.getElementById('envBadge');if(!b)return;var prod=SUPABASE_URL.indexOf('datxaylostmyroleisdl')>-1;b.textContent=prod?'LIVE':'DEV / DEMO';b.className='env-badge'+(prod?'':' dev');})();
const stepLabels=['Placement','Personal','Parent / Guardian','Review'];
const REGIONS=['Ahafo','Ashanti','Bono','Bono East','Central','Eastern','Greater Accra','North East','Northern','Oti','Savannah','Upper East','Upper West','Volta','Western','Western North'];
const NATIONALITIES=['Ghanaian','Nigerian','Togolese','Ivorian','Burkinabe','Beninese','Liberian','Other'];
const DISTRICTS=Array.isArray(window.QAG_DISTRICTS)?window.QAG_DISTRICTS:[];

let session=null, SCHOOL=null, PROGRAMMES=[], STU=null;
let app={done:[false,false,false],classId:null,className:'',houseId:null,houseName:'',enrUploaded:false,photoUploaded:false,current:0,fields:{}};
let activeStudentSessionKey='';
const $=id=>document.getElementById(id);
const HTML_ESCAPE_MAP={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'};
function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"'`]/g,function(ch){return HTML_ESCAPE_MAP[ch];});}
function escapeAttr(v){return escapeHtml(v).replace(/\r?\n/g,'&#10;');}
function safeHtml(v,fallback){const text=String(v==null?'':v);return text?escapeHtml(text):(fallback||'');}
function schoolConfig(){return (SCHOOL&&SCHOOL.config)||{};}
function configBool(key,defaultValue){
  const cfg=schoolConfig();
  const v=cfg[key];
  if(v===undefined||v===null||v==='') return !!defaultValue;
  return v===true||v===1||v==='1'||String(v).toLowerCase()==='true'||String(v).toLowerCase()==='yes';
}
function allowPassportPhoto(){return configBool('allow_passport_photo',false);}
function allowHouseSelection(){return false;}
function allowClassSelection(){return configBool('allow_class_selection',true);}
function forceEnrolmentUpload(){return configBool('force_enrolment_upload',true);}
function acceptOnlinePayment(){return configBool('accept_online_payment',true);}
function portalCaption(key,fallback){
  const value=String((schoolConfig()[key])||'').trim();
  return value||fallback;
}
function setPortalButtonLabel(id,label){
  const button=$(id); if(!button)return;
  Array.from(button.childNodes).forEach(function(node){if(node.nodeType===3)button.removeChild(node);});
  button.appendChild(document.createTextNode(label));
}
function applyPortalSetup(){
  const cfg=schoolConfig();
  const records=$('docRecordsBtn'), undertaking=$('docUndertakingBtn'), subjects=$('docSubjectsBtn');
  if(records){records.style.display=configBool('show_personal_records',true)?'':'none';setPortalButtonLabel('docRecordsBtn',portalCaption('personal_records_caption','PERSONAL RECORDS FORM'));}
  if(undertaking){undertaking.style.display=configBool('show_undertaking',true)?'':'none';setPortalButtonLabel('docUndertakingBtn',portalCaption('undertaking_caption','UNDERTAKING / MEDICAL FORM'));}
  if(subjects){subjects.style.display=configBool('show_programme_selection',true)?'':'none';setPortalButtonLabel('docSubjectsBtn',portalCaption('programme_selection_caption','PROGRAMME / SUBJECT COMBINATION'));}
  const nav=$('navForm');
  if(nav){
    Array.from(nav.childNodes).forEach(function(node){if(node.nodeType===3)nav.removeChild(node);});
    nav.appendChild(document.createTextNode(portalCaption('personal_records_caption','Personal Records Form')));
  }
}
function isChristianReligion(){
  const rel=fieldValue?fieldValue('pf-rel',false):(($('pf-rel')&&$('pf-rel').value)||'');
  return /^christ/i.test(String(rel||'').trim());
}
function toast(m,type){$('toastMsg').textContent=m;const t=$('toast');t.classList.toggle('warn',type==='warn');t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>{t.classList.remove('show');t.classList.remove('warn');},2800);}
function syncPortalChrome(){
  const topbar=document.querySelector('#s-app .ptopbar');
  const portal=document.getElementById('s-app');
  if(!topbar||!portal||!portal.classList.contains('active'))return;
  const height=Math.max(Math.ceil(topbar.getBoundingClientRect().height),1);
  document.documentElement.style.setProperty('--portal-topbar-height',height+'px');
}
function showScreen(id){if(tenantPortalRequested()&&TENANT_PORTAL.checked&&!tenantSchoolId()&&id!=='s-login'){toast('This school portal is not available.','warn');id='s-login';}document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===id));document.body.classList.toggle('student-dashboard-active',id==='s-app');window.scrollTo(0,0);if(id==='s-app')requestAnimationFrame(syncPortalChrome);if(id==='s-purchase'){try{showPendingBanner();}catch(e){}}}
function studentSessionKey(){
  return [session&&session.school||'',session&&session.index||'',session&&session.token||''].join('::');
}
function resetStudentWizardState(){
  app={done:[false,false,false],classId:null,className:'',houseId:null,houseName:'',enrUploaded:false,photoUploaded:false,current:0,fields:{}};
  ['pf-raw','pf-enrol','pf-jhs','pf-jhstype','pf-dob','pf-pob','pf-nat','pf-rel','pf-den','pf-addr','pf-town','pf-region','pf-district','pf-interest','pf-card','pf-sms','pf-wa','pf-other','pf-email','pf-fname','pf-focc','pf-fphone','pf-mname','pf-mocc','pf-mphone','pf-guard','pf-gphone','pf-digital','pf-nat-other','pf-rel-other','pf-den-other','pf-interest-other'].forEach(function(id){
    const el=$(id);
    if(!el) return;
    if(el.tagName==='SELECT') el.selectedIndex=0;
    else el.value='';
    el.style.borderColor='';
  });
  ['pf-nat-other','pf-rel-other','pf-den-other','pf-interest-other'].forEach(function(id){
    const el=$(id);
    if(el) el.style.display='none';
  });
  const review=$('reviewBlocks');
  if(review) review.innerHTML='';
  removeEnr();
  resetPassportUploadUi();
}
function isHostedPortal(){
  const host=String((window.location&&window.location.hostname)||'').toLowerCase();
  if(!host) return false;
  return !['localhost','127.0.0.1'].includes(host) && !host.endsWith('.local');
}
function paystackModeMismatch(){
  return !!PAYSTACK_CONFIG.mode_mismatch;
}
function paystackTestModeOnLive(){
  return isHostedPortal()&&(PAYSTACK_CONFIG.public_mode==='test'||String(PAYSTACK_PUBLIC_KEY||'').startsWith('pk_test_'));
}
async function loadPaystackConfig(){
  try{
    const r=await fetch(SUPABASE_URL+'/functions/v1/verify-payment',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY},
      body:JSON.stringify({ping:true})
    });
    const data=await r.json().catch(()=>null);
    if(data&&data.ok){
      PAYSTACK_CONFIG=Object.assign({},PAYSTACK_CONFIG,data,{loaded:true});
      const key=String(data.public_key||'').trim();
      if(key) PAYSTACK_PUBLIC_KEY=key;
    }else{
      PAYSTACK_CONFIG=Object.assign({},PAYSTACK_CONFIG,{loaded:true});
    }
  }catch(e){
    PAYSTACK_CONFIG=Object.assign({},PAYSTACK_CONFIG,{loaded:true,error:'config_unreachable'});
  }
}
async function studentLoginRequest(payload){
  const body={p_index:payload.p_index,p_token:payload.p_token,p_school:payload.p_school||null};
  try{
    const r=await fetch(SUPABASE_URL+'/functions/v1/student-login',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY},
      body:JSON.stringify(body)
    });
    const data=await r.json().catch(()=>null);
    if(data&&(typeof data.ok==='boolean'||data.student||data.error)) return {data,error:null};
    if(!r.ok) return {data:null,error:{message:(data&&data.message)||('Login service returned '+r.status)}};
    return {data:null,error:{message:'Login service unavailable'}};
  }catch(e){
    return {data:null,error:{message:(e&&e.message)||'Login service unavailable'}};
  }
}
async function studentPortalRequest(action,payload){
  const body=Object.assign({action},payload||{});
  try{
    const r=await fetch(SUPABASE_URL+'/functions/v1/student-portal',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY},
      body:JSON.stringify(body)
    });
    const data=await r.json().catch(()=>null);
    if(data&&(typeof data.ok==='boolean'||data.error||data.token||data.name)) return {data,error:null};
    if(!r.ok) return {data:null,error:{message:(data&&data.message)||('Portal service returned '+r.status)}};
    return {data:null,error:{message:'Portal service unavailable'}};
  }catch(e){
    return {data:null,error:{message:(e&&e.message)||'Portal service unavailable'}};
  }
}
function storageObjectPath(value){
  const text=String(value||'').trim();
  if(!text)return '';
  let m=text.match(/^enrolment-forms\/(.+)$/i);
  if(m)return decodeURIComponent(m[1]);
  m=text.match(/\/storage\/v1\/object\/public\/enrolment-forms\/(.+)$/i)||text.match(/enrolment-forms\/(.+)$/i);
  if(m)return decodeURIComponent(m[1]);
  if(/^(passport-photos\/)?[^?#]+\.(jpe?g|png)$/i.test(text))return text;
  return '';
}
async function studentSignedFileUrl(pathOrUrl){
  const path=storageObjectPath(pathOrUrl);
  if(!path||!session||!session.index||!session.token)return String(pathOrUrl||'');
  const {data}=await studentPortalRequest('file_url',{p_index:session.index,p_token:session.token,p_school:session.school||null,path});
  return data&&data.ok&&data.url?data.url:String(pathOrUrl||'');
}
const progById=id=>PROGRAMMES.find(p=>p.id===id);
const initials=n=>{const w=(n||'').trim().split(' ').filter(Boolean);return ((w[0]&&w[0][0]||'?')+(w[1]&&w[1][0]||'')).toUpperCase();};
function setStudentAvatarFallback(name){
  const fallback=initials(name||'Applicant');
  ['sbAvatar','wuAvatar'].forEach(function(id){
    const avatar=$(id);
    if(!avatar)return;
    avatar.classList.remove('has-passport-photo');
    avatar.replaceChildren();
    avatar.textContent=fallback;
  });
}
function setStudentPassportAvatar(src){
  const photoSrc=String(src||'').trim();
  if(!photoSrc)return;
  ['sbAvatar','wuAvatar'].forEach(function(id){
    const avatar=$(id);
    if(!avatar)return;
    const image=document.createElement('img');
    image.src=photoSrc;
    image.alt='Passport photo';
    image.addEventListener('error',function(){ setStudentAvatarFallback(studentName(STU)||'Applicant'); },{once:true});
    avatar.classList.add('has-passport-photo');
    avatar.replaceChildren(image);
  });
}
function qagTabScope(){
  try{ if(window.parent&&window.parent!==window&&window.parent.name) return window.parent.name; }catch(e){}
  try{ return window.name||'qag_tab_fallback'; }catch(e){ return 'qag_tab_fallback'; }
}
function qagTabKey(key){
  return 'qag_tab_state::'+qagTabScope()+'::'+key;
}
function getStudentSession(){
  try{
    localStorage.removeItem(qagTabKey('qag_student'));
    return JSON.parse(sessionStorage.getItem(qagTabKey('qag_student'))||'null');
  }catch(e){return null;}
}
function setStudentSession(next){
  try{sessionStorage.setItem(qagTabKey('qag_student'),JSON.stringify(next));}catch(e){}
}
function clearStudentSession(){
  try{sessionStorage.removeItem(qagTabKey('qag_student'));localStorage.removeItem(qagTabKey('qag_student'));}catch(e){}
}
function readSubmissionSuccess(){
  try{return JSON.parse(sessionStorage.getItem(qagTabKey('qag_submission_success'))||'null');}catch(e){return null;}
}
function writeSubmissionSuccess(next){
  try{
    if(next) sessionStorage.setItem(qagTabKey('qag_submission_success'),JSON.stringify(next));
    else sessionStorage.removeItem(qagTabKey('qag_submission_success'));
  }catch(e){}
}
function patchSubmissionSuccess(next){
  const prev=readSubmissionSuccess()||{};
  writeSubmissionSuccess(Object.assign({},prev,next||{}));
  const dash=$('panel-dash');
  if(dash&&dash.style.display!=='none') renderSubmissionSuccess();
}
function dismissSubmissionSuccess(){
  writeSubmissionSuccess(null);
  renderSubmissionSuccess();
}
function finishStudentBoot(){
  try{document.body.classList.remove('booting');}catch(e){}
}
function studentName(s){
  if(!s)return '';
  return (s.student_name||s.placement_name||s.name||s.full_name||s.surname||'').trim();
}
function normalizeStudent(s){
  if(!s)return s;
  const nm=studentName(s);
  if(nm&&!s.full_name)s.full_name=nm;
  if(!s.surname&&nm)s.surname=nm;
  return s;
}
function nameFromLookup(d){
  return d&&(d.student_name||d.placement_name||d.applicant_name||d.full_name||d.name_on_placement||d.candidate_name||'');
}
function cleanContact(v){ return v==null?'':String(v).trim(); }
function placementSmsFromLookup(d){
  if(!d)return '';
  const x=d.student||d.placement||d;
  return cleanContact(x.sms_contact||x.placement_sms_contact||x.imported_sms_contact||x.cssps_sms_contact||x.sms);
}
function studentContact(s){
  if(!s)return '';
  const r=s.records||{};
  return cleanContact(r.sms_contact||s.parent_phone||s.placement_sms_contact||s.sms_contact||s.imported_sms_contact||s.cssps_sms_contact||s.sms||s.contact);
}
async function lookupPlacementName(idx,school){
  return '';
}
async function lookupPlacementSms(idx,school){
  return '';
}

async function applySchool(data){
  // data carries school + config + programmes + houses + classes from login
  SCHOOL={school:data.school,config:data.config,houses:data.houses||[],classes:data.classes||[]};
  PROGRAMMES=data.programmes||[];
  applyPortalSetup();
  try{
    normalizeStudent(STU);
    const sid=(data.school&&data.school.id)||(session&&session.school);
    if(STU&&sid&&STU.index){
      const nm=await lookupPlacementName(STU.index,sid);
      if(nm){STU.student_name=nm;STU.placement_name=nm;normalizeStudent(STU);}
      const sms=placementSmsFromLookup(data)||await lookupPlacementSms(STU.index,sid);
      if(sms){STU.sms_contact=sms;STU.placement_sms_contact=sms;STU.contact=sms;}
    }
  }catch(e){}
  if(data.school){
    $('topSchool').textContent=(data.school.name||'').toUpperCase();
    const helpdesk=firstNonEmpty(data.school.helpdesk,data.school.phone,LOGIN_DEFAULTS.phone);
    document.querySelectorAll('.helpline a').forEach(a=>{a.textContent=helpdesk;a.href='tel:'+helpdesk;});
  }
  if(data.config) $('topYear').textContent='Admission Year: '+(data.config.academic_year||'2025/2026');
}

/* ===== LOGIN ===== */
async function doLogin(){
  const idx=$('login-index').value.trim(),tok=$('login-token').value.trim().toUpperCase();
  const sid=tenantSchoolId()||$('login-school').value;
  const btn=$('loginBtn');
  const prevBtn=btn?btn.innerHTML:'';
  $('f-index').classList.remove('err');$('f-token').classList.remove('err');$('f-school').classList.remove('err');
  if(!sid){$('f-school').classList.add('err');return;}
  if(!idx){$('f-index').classList.add('err');return;}
  if(!tok){$('f-token').classList.add('err');return;}
  if(btn){btn.disabled=true;btn.style.pointerEvents='none';btn.style.opacity='.8';btn.innerHTML='Signing in...';}
  try{
    const {data,error}=await studentLoginRequest({p_index:idx,p_token:tok,p_school:sid});
    if(error){toast('Login failed - '+error.message);return;}
    if(!data.ok){
      if(data.error==='index')$('f-index').classList.add('err');
      else if(data.error==='token')$('f-token').classList.add('err');
      else if(data.error==='closed'){const b=$('admClosedBanner');if(b)b.style.display='block';toast(data.message||'Admission is closed for this school');}
      else if(data.error==='ambiguous')toast('This index appears under more than one school - contact your school office.');
      else toast(data.message||('Could not sign in ('+(data.error||'unknown error')+')'));
      return;
    }
    session={index:idx,token:tok,school:sid}; STU=data.student; await applySchool(data);
    setStudentSession(session);
    hydrate(); showScreen('s-app'); showPanel('dash'); watchDeletion();
  }finally{
    if(btn){btn.innerHTML=prevBtn;setButtonDisabled(btn,admissionClosed($('login-school').value));}
  }
}
async function bootStudent(){
  const s=getStudentSession();
  if(!s||!s.index||!s.token) return;
  try{
    const tenant=await resolveTenantSchool();
    if(tenantPortalRequested()&&(!tenant||String(s.school||'')!==String(tenant.id))){
      clearStudentSession();
      return;
    }
    const {data}=await studentLoginRequest({p_index:s.index,p_token:s.token,p_school:s.school||null});
    if(data&&data.ok){ session=s; STU=data.student; await applySchool(data); hydrate(); showScreen('s-app'); showPanel('dash'); watchDeletion(); }
    else { session=null; STU=null; clearStudentSession(); showScreen('s-login'); }
  }catch(e){}
}
async function refreshStudent(){
  if(!session||!session.index||!session.token) return;
  const force=arguments[0]&&arguments[0].force;
  const formPanel=$('panel-form');
  const formOpen=!!(formPanel&&formPanel.style.display!=='none');
  if(!force&&formOpen&&STU&&!STU.submitted) return;
  const activeSession={index:session.index,token:session.token,school:session.school||null};
  const {data}=await studentLoginRequest({p_index:activeSession.index,p_token:activeSession.token,p_school:activeSession.school});
  if(!session||session.index!==activeSession.index||session.token!==activeSession.token||(session.school||null)!==activeSession.school) return;
  if(data&&data.ok){STU=data.student;await applySchool(data);hydrate();}
  else if(data&&!data.ok){ revokeAccess(); }
}
// If the student's record has been deleted by the school, drop their access immediately.
function revokeAccess(){
  toast('Your record is no longer available - please contact your school.');
  logout();
}
async function validateSession(){
  if(!session||!session.index) return;
  try{
    const {data}=await studentLoginRequest({p_index:session.index,p_token:session.token,p_school:session.school||null});
    if(!data||!data.ok) revokeAccess();
  }catch(e){}
}
document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible'&&session) scheduleStudentRefresh('visible',true); });
setInterval(function(){ if(session) validateSession(); }, 60000);
setInterval(function(){ if(session) scheduleStudentRefresh('sync'); }, 30000);
// Realtime: the school broadcasts when a student is deleted - revoke access instantly.
let stuChannel=null, stuRefreshTimer=null, stuRefreshBusy=false, stuRefreshQueued=false;
function scheduleStudentRefresh(reason,immediate){
  if(!session) return;
  if(stuRefreshTimer){ clearTimeout(stuRefreshTimer); stuRefreshTimer=null; }
  stuRefreshTimer=setTimeout(function(){ runStudentRefresh(reason); },immediate?0:700);
}
async function runStudentRefresh(reason){
  if(!session) return;
  if(stuRefreshBusy){ stuRefreshQueued=true; return; }
  stuRefreshBusy=true;
  try{ await refreshStudent(); }
  catch(e){}
  finally{
    stuRefreshBusy=false;
    if(stuRefreshQueued){ stuRefreshQueued=false; scheduleStudentRefresh(reason,true); }
  }
}
function matchesStudentRefreshPayload(payload){
  if(!session) return false;
  const myIndex=String(session.index);
  if(payload&&Array.isArray(payload.indexes)&&payload.indexes.length){
    return payload.indexes.some(function(idx){ return String(idx)===myIndex; });
  }
  if(payload&&payload.index!=null){
    return String(payload.index)===myIndex;
  }
  return !payload||payload.scope!=='none';
}
function watchDeletion(){
  if(!session||!session.school) return;
  if(stuChannel){ try{sb.removeChannel(stuChannel);}catch(e){} stuChannel=null; }
  stuChannel=sb.channel('school:'+session.school)
    .on('broadcast',{event:'student_deleted'},function(msg){
      const p=(msg&&msg.payload)||{};
      if(session&&String(p.index)===String(session.index)) revokeAccess();
    })
    .on('broadcast',{event:'student_portal_refresh'},function(msg){
      const p=(msg&&msg.payload)||{};
      if(matchesStudentRefreshPayload(p)) scheduleStudentRefresh(p.reason||'school-update');
    })
    .subscribe();
}
function stopWatchDeletion(){
  if(stuRefreshTimer){ clearTimeout(stuRefreshTimer); stuRefreshTimer=null; }
  stuRefreshBusy=false; stuRefreshQueued=false;
  if(stuChannel){ try{sb.removeChannel(stuChannel);}catch(e){} stuChannel=null; }
}
function renderSubmissionSuccess(){
  const card=$('submissionSuccessCard');
  if(!card) return;
  const payload=readSubmissionSuccess();
  if(!payload||!payload.submitted){
    card.classList.remove('show');
    return;
  }
  const schoolText=$('submissionSuccessSchool');
  const appText=$('submissionSuccessApplication');
  const smsText=$('submissionSuccessSms');
  const note=$('submissionSuccessNote');
  if(schoolText) schoolText.textContent=payload.school_name||((SCHOOL&&SCHOOL.school&&SCHOOL.school.name)||'Your school');
  if(appText) appText.textContent='Ready to print';
  if(smsText) smsText.textContent=payload.sms_status_label||'Processing';
  if(note) note.textContent=payload.sms_note||'A confirmation SMS has been sent to your phone number.';
  card.classList.add('show');
}
function hydrate(){
  const s=STU;
  const nextSessionKey=studentSessionKey();
  if(activeStudentSessionKey!==nextSessionKey){
    resetStudentWizardState();
    activeStudentSessionKey=nextSessionKey;
  }
  const displayName=studentName(s)||'Applicant';
  const smsContact=studentContact(s);
  if(smsContact)s.contact=smsContact;
  $('sbName').textContent=displayName;
  setStudentAvatarFallback(displayName);
  { const url=schoolCrest(); const im=$('sbCrestImg'), tx=$('sbCrestText'), box=$('sbCrest');
    if(url){ if(im){im.src=url;im.style.display='block';} if(tx)tx.style.display='none'; if(box)box.classList.add('has-img'); }
    else { if(im)im.style.display='none'; if(tx)tx.style.display=''; if(box)box.classList.remove('has-img'); } }
  $('wuName').textContent=displayName;
  $('wuSchoolNo').textContent='Admission Number: '+(s.school_no||'______________________________');
  app.done=s.submitted?[true,true,true]:[!!s.personal_done,!!s.programme_done,!!s.undertaking_done];
  app.classId=s.class_id||null;
  app.houseId=s.house_id||null;
  app.houseName=s.house||'';
  $('pf1-index').value=s.index||''; $('pf1-gender').value=s.gender||''; $('pf1-prog').value=s.programme||'';
  $('pf1-res').value=s.residential||'-'; $('pf1-surname').value=displayName||s.surname||'';
  $('pf1-agg').value=(s.aggregate!=null?s.aggregate:'-');
  buildPickers(); buildClassTable(); buildHouseTable(); prefillRecords(s.records); applyFeatureVisibility();
  if(!$('pf-sms').value&&smsContact)$('pf-sms').value=smsContact;
  if(!app.fields.sms_contact&&smsContact)app.fields.sms_contact=smsContact;
  if(!s.submitted) syncStepCompletion();
  const done=s.submitted;
  $('welcomeCard').classList.toggle('pending',!done);
  $('welcomeMsg').textContent=done
    ? displayName+', WELL DONE! You have completed your Personal Records Form. Kindly download all the necessary documents. Thank you!'
    : displayName+', please complete your Personal Records Form to proceed with your admission.';
  const blocks=[
    {h:safeHtml(s.programme,'-'),l:'Programme'},
    {h:safeHtml(s.residential,'-'),l:'Residential Status'},
    {h:done?'<span class="pill ok">Completed</span>':'<span class="pill pend">Not completed</span>',l:'Personal Records',btn:'<button class="btn btn-primary btn-sm" data-qa-onclick="showPanel(\'form\')"><svg viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\'><path d=\'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\'/><path d=\'M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z\'/></svg>'+(done?'Edit Your Form':'Fill Your Form')+'</button>'},
    {h:safeHtml(s.gender,'-'),l:'Gender'},
    {h:s.class?safeHtml(s.class):'<span style="color:var(--muted)">______________________________</span>',l:'Class'},
    {h:s.house?safeHtml(s.house):'<span style="color:var(--muted)">______________________________</span>',l:'House Allocation'},
    {h:'<span class="mono">'+safeHtml(s.index,'-')+'</span>',l:'JHS Index No'},
    {h:'<span class="mono">'+safeHtml(s.contact,'-')+'</span>',l:'Contact Number'},
    {h:'',l:'Log Out',btn:'<button class="btn btn-danger btn-sm" data-qa-onclick="logout()"><svg viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\'><path d=\'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9\'/></svg>Log Out</button>'},
  ];
  $('wuGrid').innerHTML=blocks.map(b=>`<div class="wu-block"><div class="h">${b.h}</div>${b.btn||''}<div class="l">[${b.l}]</div></div>`).join('');
  const cfg=(SCHOOL&&SCHOOL.config)||{};
  const docs=(Array.isArray(cfg.req_docs)?cfg.req_docs:[cfg.req_doc_line1,cfg.req_doc_line2,cfg.req_doc_line3,cfg.req_doc_line4,cfg.req_doc_line5]).filter(Boolean);
  $('dashChecklist').innerHTML=docs.map((l,i)=>`<li><span class="n">${i+1}</span><span>${safeHtml(l,'-')}</span></li>`).join('');
  renderSubmissionSuccess();
  buildSteps(); refreshRail();
}

/* ===== PANELS / SIDEBAR ===== */
function showPanel(p){
  $('panel-dash').style.display=p==='dash'?'':'none';
  $('panel-form').style.display=p==='form'?'':'none';
  $('navDash').classList.toggle('active',p==='dash');
  $('navForm').classList.toggle('active',p==='form');
  if(p==='dash') renderSubmissionSuccess();
  if(p==='form'){ goStep(app.current||0); }
  document.querySelector('.psidebar').classList.remove('open');$('pbackdrop').classList.remove('open');
  window.scrollTo(0,0);
}
function toggleSb(){const s=document.querySelector('.psidebar');s.classList.toggle('open');$('pbackdrop').classList.toggle('open',s.classList.contains('open'));}

/* ===== PURCHASE / RETRIEVE ===== */
const PENDING_KEY='qa_pending_pay';
function savePending(o){try{localStorage.setItem(PENDING_KEY,JSON.stringify(o));}catch(e){}}
function getPending(){try{return JSON.parse(localStorage.getItem(PENDING_KEY)||'null');}catch(e){return null;}}
function clearPending(){try{localStorage.removeItem(PENDING_KEY);}catch(e){}}
function showPendingBanner(){
  const p=getPending(); const el=$('p-pending'); if(!el)return;
  if(p&&p.reference){ el.style.display='block';
    el.innerHTML='Payment not yet confirmed (ref <b>'+safeHtml(p.reference)+'</b>)'+(p.reason?'<br><span style="font-weight:600">Reason: '+safeHtml(p.reason)+'</span>':'')+'.<br><a data-qa-onclick="retryVerify()">Retry verification</a> \u2014 you will <b>not</b> be charged again. &nbsp; - &nbsp; <a data-qa-onclick="dismissPending()">dismiss</a>'; }
  else el.style.display='none';
}
function dismissPending(){ clearPending(); showPendingBanner(); toast('Cleared. If you completed a payment, it stays valid \u2014 use Retrieve token.'); }
function validParentContact(value){
  const digits=String(value||'').replace(/\D/g,'');
  return digits.length===9||digits.length===10||(digits.startsWith('233')&&digits.length===12);
}
async function payToken(method){
  const idx=$('p-index').value.trim(),name=$('p-name').value.trim();
  const sid=tenantSchoolId()||$('p-school-sel').value;
  const pend=getPending();
  const parentContact=String($('p-phone').value||pend&&pend.parentContact||'').trim();
  if(!sid){toast('Please select your school first','warn');return;}
  if(admissionClosed(sid)){toast('Admission is closed for this school','warn');return;}
  if(!idx||!name){toast('Enter your index number and name first','warn');return;}
  if(!validParentContact(parentContact)){toast('Enter a valid Parent Contact for secure token retrieval','warn');$('p-phone').focus();return;}
  if(method!=='Paystack'){toast(method+' isn\u2019t available yet - please use Paystack');return;}
  // recover an unconfirmed payment instead of charging again
  if(pend&&pend.index===idx&&pend.reference){ toast('Found an unconfirmed payment - verifying instead of charging again'); return verifyPayment(pend.reference, idx, name, pend.school||sid, parentContact); }
  // already paid? then don't charge again
  const {data:has}=await studentPortalRequest('has_token',{p_index:idx,p_school:sid,parent_contact:parentContact});
  if(has&&has.ok&&has.paid){ toast('This index has already paid. Use "Retrieve token" to get your token.','warn'); $('r-value').value=idx; showScreen('s-retrieve'); return; }
  const {data:sch}=await studentPortalRequest('lookup',{p_index:idx,p_school:sid});
  if(!sch||!sch.ok){toast('This index is not on any participating school\u2019s placement list','warn');return;}
  const liveAdmissionStatus=String(sch.admission_status||'').trim().toUpperCase();
  if(liveAdmissionStatus&&!['OPEN','OPENED','ACTIVE','TRUE','YES','1'].includes(liveAdmissionStatus)){toast('Admission is closed for this school','warn');return;}
  if(sch.accept_online_payment===false){toast('Online token payment is currently unavailable for this school. Contact the school office.','warn');return;}
  const verifiedName=nameFromLookup(sch)||await lookupPlacementName(idx,sid)||name;
  const amount=Math.round(Number(sch.charge||0)*100);
  if(!amount){toast('This school has no service charge set','warn');return;}
  const email=normalizedPaymentEmail(idx);
  if(!PAYSTACK_PUBLIC_KEY){toast('Paystack public key is not configured for this portal yet.');return;}
  if(paystackModeMismatch()){toast('Paystack public and secret keys are in different modes - contact the administrator.');return;}
  if(paystackTestModeOnLive()){toast('Paystack is running in test mode. Use test payment details only.');}
  if(!window.PaystackPop){toast('Payment library didn\u2019t load - check your connection and reload');return;}
  toast('Opening secure payment for '+sch.name+'\u2026');
  const handler=window.PaystackPop.setup({
    key:PAYSTACK_PUBLIC_KEY, email, amount, currency:'GHS',
    metadata:{custom_fields:[
      {display_name:'Index Number',variable_name:'index',value:idx},
      {display_name:'Applicant',variable_name:'name',value:verifiedName},
      {display_name:'School',variable_name:'school',value:sch.name},
      {display_name:'School ID',variable_name:'school_id',value:sid}
    ]},
    callback:function(resp){ savePending({reference:resp.reference,index:idx,name:verifiedName,school:sid,parentContact}); verifyPayment(resp.reference, idx, verifiedName, sid, parentContact); },
    onClose:function(){ toast('Payment window closed'); }
  });
  handler.openIframe();
}
function retryVerify(){ const p=getPending(); if(!p||!p.reference){toast('No unconfirmed payment found');return;} verifyPayment(p.reference,p.index,p.name||'',p.school||null,p.parentContact||''); }
function normalizedPaymentEmail(idx){
  const raw=$('p-email')?$('p-email').value.trim():'';
  return raw||(String(idx||'applicant').trim()+'@quickadmissiongh.com');
}
async function verifyPayment(reference, idx, name, school, parentContact){
  toast('Verifying payment\u2026');
  if(!school||!parentContact){ const p=getPending(); school=school||(p&&p.school)||$('p-school-sel').value||null; parentContact=parentContact||(p&&p.parentContact)||$('p-phone').value||''; }
  name=(await lookupPlacementName(idx,school))||name;
  const email=normalizedPaymentEmail(idx);
  let data=null, netErr=null;
  try{
    const r=await fetch(SUPABASE_URL+'/functions/v1/verify-payment',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY},
      body:JSON.stringify({reference,index:idx,name,phone:parentContact,email,school})
    });
    data=await r.json().catch(()=>null);
  }catch(e){ netErr=e; }
  if(!data||!data.ok){
    try{console.log('[verify-payment] response:',data,'netErr:',netErr);}catch(e){}
    let msg, reason;
    if(netErr){ reason='network error'; msg='Network problem reaching the server. Tap Retry verification.'; }
    else if(data&&data.error==='not_configured'){ reason='payment system not configured'; msg='Payment system key not set yet. Your payment is safe - Retry verification shortly.'; }
    else if(data&&data.error==='verification_failed'){
      const gs=data.gateway_status||data.gateway_message||'not found';
      reason='Paystack status \u201c'+gs+'\u201d'+(data.gateway_message&&data.gateway_status?(' \u2014 '+data.gateway_message):'');
      msg='Paystack says: '+gs+'. '+(gs==='abandoned'||gs==='failed'?'That payment wasn\u2019t completed - finish the card + OTP step.':'Reference not recognised on this account.');
    }
    else { reason=(data&&(data.message||data.gateway_message||data.error))||'unknown'; msg='Could not verify yet ('+reason+'). Tap Retry verification.'; }
    savePending({reference,index:idx,name:name||'',school,parentContact,reason}); showPendingBanner();
    toast(msg); return;
  }
  clearPending(); showPendingBanner();
  const loginSchool=data.school_id||school||null;
  fillPurchasedTokenLogin(idx,data.token,loginSchool);
}
function fillPurchasedTokenLogin(idx,token,school){
  const loginIndex=String(idx||'').trim();
  const loginToken=String(token||'').trim().toUpperCase();
  const loginSchool=tenantSchoolId()||String(school||'');
  window._newToken={idx:loginIndex,tk:loginToken,school:loginSchool};
  if($('login-school')&&loginSchool){
    $('login-school').value=loginSchool;
    syncLoginSchoolPicker();
    onLoginSchoolChange();
  }
  $('login-index').value=loginIndex;
  $('login-token').value=loginToken;
  $('f-school').classList.remove('err');
  $('f-index').classList.remove('err');
  $('f-token').classList.remove('err');
  $('purchase-form').style.display='block';
  $('purchase-done').style.display='none';
  showScreen('s-login');
  requestAnimationFrame(function(){if($('loginBtn'))$('loginBtn').focus();});
  const actionLabel=$('loginBtn')?$('loginBtn').textContent.trim():'Continue Admission';
  toast('Payment confirmed. Your index and token are filled in - tap '+actionLabel+'.');
}
function useNewToken(){if(window._newToken)fillPurchasedTokenLogin(window._newToken.idx,window._newToken.tk,window._newToken.school);}
let retrieveOtpState=null;
function resetRetrieveOtp(){
  retrieveOtpState=null;
  if($('retrieve-result'))$('retrieve-result').style.display='none';
  if($('r-otp'))$('r-otp').value='';
}
$('r-by').addEventListener('change',e=>{$('r-label').textContent=e.target.value==='index'?'Index number':'Payment receipt number';resetRetrieveOtp();});
$('r-value').addEventListener('input',resetRetrieveOtp);
$('r-otp').addEventListener('input',function(){this.value=this.value.replace(/\D/g,'').slice(0,6);});
$('r-otp').addEventListener('keydown',function(event){if(event.key==='Enter'){event.preventDefault();verifyRetrievedOtp();}});
async function retrieveToken(){
  const by=$('r-by').value,v=$('r-value').value.trim(); if(!v){toast('Enter a value to search','warn');return;}
  const rsid=tenantSchoolId()||$('r-school').value; if(!rsid){toast('Please select your school first','warn');return;}
  const button=$('retrieve-request-btn'); if(button){button.disabled=true;button.textContent='Sending code...';}
  try{
    const {data,error}=await studentPortalRequest('retrieve',{p_by:by,p_value:v,p_school:rsid});
    if(error||!data||!data.ok){toast(data&&data.message?data.message:error&&error.message?error.message:'No paid token was found','warn');return;}
    retrieveOtpState={challengeId:data.challenge_id,index:data.index,school:data.school_id||rsid};
    $('r-otp-hint').textContent='A 6-digit code was sent to the Parent Contact ending in '+String(data.phone_last_two||'--')+'. It expires in 5 minutes.';
    $('retrieve-result').style.display='block';
    $('r-otp').value='';$('r-otp').focus();
    toast('Verification code sent to Parent Contact ending in '+String(data.phone_last_two||'--'));
  }finally{if(button){button.disabled=false;button.textContent='Send verification code';}}
}
async function verifyRetrievedOtp(){
  const otp=$('r-otp').value.trim();
  if(!retrieveOtpState){toast('Request a verification code first','warn');return;}
  if(!/^\d{6}$/.test(otp)){toast('Enter the 6-digit verification code','warn');$('r-otp').focus();return;}
  const button=$('retrieve-verify-btn'); if(button){button.disabled=true;button.textContent='Verifying...';}
  try{
    const {data,error}=await studentPortalRequest('retrieve_verify',{challenge_id:retrieveOtpState.challengeId,otp,p_index:retrieveOtpState.index,p_school:retrieveOtpState.school});
    if(error||!data||!data.ok){toast(data&&data.message?data.message:error&&error.message?error.message:'Verification failed','warn');return;}
    const loginSchool=data.school_id||retrieveOtpState.school;
    let loginResult=await studentLoginRequest({p_index:data.index,p_token:data.token,p_school:loginSchool});
    if(!(loginResult.data&&loginResult.data.ok)){await new Promise(function(resolve){setTimeout(resolve,350);});loginResult=await studentLoginRequest({p_index:data.index,p_token:data.token,p_school:loginSchool});}
    if(!(loginResult.data&&loginResult.data.ok)){resetRetrieveOtp();toast('Code verified, but sign-in could not be completed. Request a new code and try again.','warn');return;}
    session={index:data.index,token:data.token,school:loginSchool}; STU=loginResult.data.student; await applySchool(loginResult.data); setStudentSession(session); hydrate(); resetRetrieveOtp(); showScreen('s-app'); showPanel('dash'); watchDeletion(); toast('Parent Contact verified. Welcome back.');
  }finally{if(button){button.disabled=false;button.textContent='Verify and continue';}}
}

/* ===== WIZARD ===== */
function buildSteps(){$('stepsList').innerHTML=stepLabels.map((l,i)=>`<li class="step" data-i="${i}" data-qa-onclick="goStep(${i})"><span class="dot"><span class="num">${i+1}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="display:none"><polyline points="20 6 9 17 4 12"/></svg></span><span class="lbl">${l}</span></li>`).join('');}
function refreshRail(){
  const pct=Math.round(app.done.filter(Boolean).length/3*100);
  $('progPct').textContent=pct;$('progFill').style.width=pct+'%';
  document.querySelectorAll('.step').forEach(s=>{const i=+s.dataset.i;s.classList.toggle('active',i===app.current);const d=i<3&&app.done[i];s.classList.toggle('done',d);s.querySelector('.num').style.display=d?'none':'';s.querySelector('svg').style.display=d?'block':'none';});
}
function goStep(i){app.current=i;document.querySelectorAll('.stepcard').forEach(c=>c.classList.toggle('active',c.dataset.step==i));if(i===3)buildReview();refreshRail();window.scrollTo(0,0);}
function val(id){var e=$(id);return e?e.value.trim():'';}
function maxDobValue(){
  const now=new Date();
  return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
}
function normalizeDobValue(value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  let match=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/),year,month,day;
  if(match){year=Number(match[1]);month=Number(match[2]);day=Number(match[3]);}
  else{
    match=raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if(!match)return '';
    day=Number(match[1]);month=Number(match[2]);year=Number(match[3]);
  }
  const checked=new Date(year,month-1,day);
  if(checked.getFullYear()!==year||checked.getMonth()!==month-1||checked.getDate()!==day)return '';
  return [String(year).padStart(4,'0'),String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
}
function need(ids){for(const id of ids){if(!val(id)){const e=$(id);if(e){e.focus();e.style.borderColor='var(--danger)';setTimeout(()=>e.style.borderColor='',1500);}return false;}}return true;}
const FIELD_STATE_KEYS={
  'pf-raw':'raw_score','pf-enrol':'enrolment_code','pf-jhs':'jhs_attended','pf-jhstype':'jhs_type',
  'pf-dob':'dob','pf-pob':'place_of_birth','pf-nat':'nationality','pf-rel':'religion','pf-den':'denomination',
  'pf-addr':'address','pf-town':'town','pf-region':'region','pf-district':'district','pf-interest':'interest',
  'pf-card':'ghana_card','pf-sms':'sms_contact','pf-wa':'whatsapp','pf-other':'other_phone','pf-email':'email',
  'pf-fname':'father_name','pf-focc':'father_occupation','pf-fphone':'father_phone','pf-mname':'mother_name',
  'pf-mocc':'mother_occupation','pf-mphone':'mother_phone','pf-guard':'guardian','pf-gphone':'guardian_phone',
  'pf-digital':'digital_address'
};
const OTHER_VALUE_IDS=new Set(['pf-nat','pf-rel','pf-den','pf-interest']);
function storedFieldValue(id){
  const key=FIELD_STATE_KEYS[id];
  if(!key||!app||!app.fields) return '';
  const v=app.fields[key];
  return v==null?'':String(v).trim();
}
function fieldValue(id,useStored){
  const live=OTHER_VALUE_IDS.has(id)?otherVal(id).trim():val(id);
  const value=live||((useStored&&storedFieldValue(id))||'');
  return id==='pf-dob'?normalizeDobValue(value):value;
}
function firstMissing(ids,useStored){
  for(const id of ids){ if(!fieldValue(id,useStored)) return id; }
  return '';
}
function flagField(id,silent){
  if(!id) return;
  const e=$(id);
  if(!e) return;
  e.style.borderColor='var(--danger)';
  setTimeout(()=>e.style.borderColor='',1500);
  if(!silent){
    try{ e.focus(); }catch(err){}
    try{ e.scrollIntoView({behavior:'smooth',block:'center'}); }catch(err){}
  }
}
function failStep(step,message,id,silent){
  if(id) flagField(id,silent);
  if(!silent&&message) toast(message);
  return {ok:false,step,field:id,message};
}
function validateStep(step,opts){
  const silent=!!(opts&&opts.silent);
  const useStored=!!(opts&&opts.useStored);
  if(step===0){
    const missing=firstMissing(['pf-raw','pf-enrol','pf-jhs','pf-jhstype'],useStored);
    if(missing) return failStep(step,'Fill all required Part 2 fields',missing,silent);
    if(forceEnrolmentUpload()&&!app.enrUploaded) return failStep(step,'Please upload your enrolment form','',silent);
  }
  if(step===1){
    const missing=firstMissing(['pf-dob','pf-pob','pf-nat','pf-rel','pf-addr','pf-town','pf-region','pf-district','pf-interest'],useStored);
    if(missing) return failStep(step,'Please complete the required personal fields',missing,silent);
    if(fieldValue('pf-dob',useStored)>maxDobValue()) return failStep(step,'Date of birth cannot be in the future','pf-dob',silent);
    if(isChristianReligion()&&!fieldValue('pf-den',useStored)) return failStep(step,'Please select your religious denomination','pf-den',silent);
    if(allowClassSelection()&&!app.classId&&eligibleStudentClasses().length) return failStep(step,'Please select a class','',silent);
  }
  if(step===2){
    const missing=firstMissing(['pf-sms','pf-fname','pf-focc','pf-fphone','pf-mname','pf-mocc','pf-mphone'],useStored);
    if(missing) return failStep(step,'Please complete the required parent fields',missing,silent);
  }
  collect(step,{useStored});
  return {ok:true,step};
}
function syncStepCompletion(){
  app.done=[0,1,2].map(function(step){ return validateStep(step,{silent:true,useStored:true}).ok; });
  return app.done;
}

function buildPickers(){
  $('pf-region').innerHTML='<option value="">Select...</option>'+REGIONS.map(r=>`<option>${r}</option>`).join('');
  $('pf-nat').innerHTML=NATIONALITIES.map(n=>`<option ${n==='Ghanaian'?'selected':''}>${n}</option>`).join('');
  const dob=$('pf-dob');if(dob)dob.max=maxDobValue();
  var districtList=$('pf-district-list');
  if(districtList) districtList.innerHTML=DISTRICTS.map(function(d){ return `<option value="${d}"></option>`; }).join('');
}
function portalSubjectItems(raw){
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
function fmtCombo(str){ return portalSubjectItems(str).join(' - '); }
function portalClassSubjectItems(c,fallbackSubjects){
  const own=portalSubjectItems(c&&c.subjects);
  return own.length?own:portalSubjectItems(fallbackSubjects);
}
function portalClassSubjectPreviewHTML(c,fallbackSubjects,limit){
  const items=portalClassSubjectItems(c,fallbackSubjects);
  if(!items.length)return '<span>Standard combination</span>';
  const visible=items.slice(0,Math.max(1,limit||3));
  const preview=visible.map(function(subject,index){return '<span>'+(index+1)+'. '+safeHtml(subject)+'</span>';}).join('');
  const encodedId=encodeURIComponent(String(c&&c.id||''));
  const more=items.length>visible.length?'<button type="button" class="cls-subject-more" data-qa-onclick="event.stopPropagation();openPortalClassSubjects(\''+encodedId+'\',event)">View more (+'+(items.length-visible.length)+')</button>':'';
  return '<div class="cls-subject-summary">'+preview+more+'</div>';
}
function ensurePortalSubjectOverlay(){
  let overlay=$('portalClassSubjectsOverlay');
  if(overlay)return overlay;
  overlay=document.createElement('div');
  overlay.id='portalClassSubjectsOverlay';
  overlay.className='subject-combo-overlay';
  overlay.setAttribute('aria-hidden','true');
  overlay.addEventListener('click',function(event){if(event.target===overlay)closePortalClassSubjects();});
  document.body.appendChild(overlay);
  return overlay;
}
function closePortalClassSubjects(){
  const overlay=$('portalClassSubjectsOverlay');
  if(!overlay)return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden','true');
}
function openPortalClassSubjects(encodedId,event){
  if(event){event.preventDefault();event.stopPropagation();}
  const id=decodeURIComponent(String(encodedId||''));
  const c=((SCHOOL&&SCHOOL.classes)||[]).find(function(item){return String(item&&item.id||'')===id;});
  if(!c){toast('Class subject combination is unavailable','warn');return;}
  const programme=progById(c.programme_id||resolveStudentProgrammeId())||{};
  const items=portalClassSubjectItems(c,programme.subjects);
  const overlay=ensurePortalSubjectOverlay();
  overlay.innerHTML='<div class="subject-combo-dialog" role="dialog" aria-modal="true" aria-labelledby="portalClassSubjectsTitle"><div class="subject-combo-head"><div><h3 id="portalClassSubjectsTitle">'+safeHtml(c.name,'Class')+' subject combination</h3><p>'+safeHtml(items.length)+' subject'+(items.length===1?'':'s')+'</p></div><button type="button" class="subject-combo-close" aria-label="Close" data-qa-onclick="closePortalClassSubjects()">×</button></div>'+(items.length?'<ol class="subject-combo-list">'+items.map(function(subject){return '<li>'+safeHtml(subject)+'</li>';}).join('')+'</ol>':'<div style="padding:22px;color:var(--muted)">No subjects have been added to this class.</div>')+'</div>';
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden','false');
  const closeButton=overlay.querySelector('.subject-combo-close');
  if(closeButton)closeButton.focus();
}
function programmeKey(value){
  return String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');
}
function resolveStudentProgrammeId(){
  const names=[
    (STU&&STU.programme)||'',
    ($('pf1-prog')&&$('pf1-prog').value)||'',
    (app&&app.fields&&app.fields.programme)||''
  ].map(programmeKey).filter(Boolean);
  if(STU&&STU.programme_id&&(PROGRAMMES||[]).some(function(p){return String(p.id||'')===String(STU.programme_id);})){ return STU.programme_id; }
  const hit=(PROGRAMMES||[]).find(function(p){
    return names.includes(programmeKey(p.name)) || names.includes(programmeKey(p.code));
  });
  return hit?hit.id:null;
}
function eligibleStudentClasses(){
  const studentProgrammeId=resolveStudentProgrammeId();
  if(!studentProgrammeId)return [];
  return ((SCHOOL&&SCHOOL.classes)||[]).filter(function(c){
    if(String(c.programme_id||'')!==String(studentProgrammeId))return false;
    const seats=Number(c.seats);
    return String(c.id||'')===String(app.classId||'')||!Number.isFinite(seats)||seats>0;
  });
}
function buildClassTable(){
  const studentProgrammeId=resolveStudentProgrammeId();
  const progSubs=(progById(studentProgrammeId)||{}).subjects||'';
  const classes=eligibleStudentClasses();
  if(app.classId&&!classes.some(function(c){return String(c.id||'')===String(app.classId);})){app.classId=null;app.className='';}
  $('clsRows').innerHTML=classes.length?classes.map(c=>{
    const combo=portalClassSubjectPreviewHTML(c,progSubs,3);
    return `<tr class="cls-row ${c.id===app.classId?'sel':''}" data-id="${c.id}" data-qa-onclick="pickClass('${c.id}','${encodeURIComponent(String(c.name||''))}')"><td><span class="cls-radio"></span>${safeHtml(c.name,'-')}</td><td class="cls-combo">${combo}</td><td class="cls-seats">${safeHtml(c.seats,'0')}</td></tr>`;
  }).join(''):`<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:18px">No classes have been linked to your programme yet. You can still submit; a class will be assigned by the school.</td></tr>`;
}
function pickClass(id,name){app.classId=id;app.className=decodeURIComponent(String(name||''));document.querySelectorAll('.cls-row').forEach(r=>r.classList.toggle('sel',r.dataset.id===id));}
function portalHouseGender(value){
  const gender=String(value||'').trim().toLowerCase();
  if(gender==='m'||gender==='male'||gender==='boy')return 'M';
  if(gender==='f'||gender==='female'||gender==='girl')return 'F';
  return '';
}
function portalHouseResidential(value){
  const residential=String(value||'').trim().toLowerCase();
  if(residential==='boarding'||residential==='boarder'||residential==='resident'||residential==='b')return 'Boarding';
  if(residential==='day'||residential==='day student'||residential==='d')return 'Day';
  return '';
}
function houseMatchesStudent(h){
  const houseGender=portalHouseGender(h&&h.gender), studentGender=portalHouseGender(STU&&STU.gender);
  const houseResidential=portalHouseResidential(h&&(h.residential_type||h.rtype)), studentResidential=portalHouseResidential(STU&&STU.residential);
  const priority=Number(h&&h.priority), capacity=Number(h&&(h.capacity||h.cap));
  return !!houseGender&&!!studentGender&&houseGender===studentGender&&!!houseResidential&&!!studentResidential&&houseResidential===studentResidential&&Number.isFinite(priority)&&priority>0&&Number.isFinite(capacity)&&capacity>0;
}
function eligibleStudentHouses(){
  return ((SCHOOL&&SCHOOL.houses)||[]).filter(function(h){
    if(!houseMatchesStudent(h))return false;
    const seats=Number(h.seats);
    return String(h.id||'')===String(app.houseId||'')||!Number.isFinite(seats)||seats>0;
  }).slice().sort(function(a,b){
    const priorityDiff=Number(a.priority)-Number(b.priority);
    return priorityDiff||String(a.name||'').localeCompare(String(b.name||''),undefined,{sensitivity:'base'});
  });
}
function buildHouseTable(){
  const body=$('houseRows'); if(!body)return;
  const houses=eligibleStudentHouses();
  if(app.houseId&&!houses.some(h=>String(h.id||'')===String(app.houseId))){app.houseId=null;app.houseName='';}
  body.innerHTML=houses.length?houses.map(function(h){
    const id=String(h.id||'');
    const type=[h.residential_type||h.rtype||'',h.gender||''].filter(Boolean).join(' - ')||'Available';
    return `<tr class="cls-row house-row ${id===String(app.houseId||'')?'sel':''}" data-id="${safeHtml(id)}" data-qa-onclick="pickHouse('${encodeURIComponent(id)}','${encodeURIComponent(String(h.name||''))}')"><td><span class="cls-radio"></span>${safeHtml(h.name,'-')}</td><td class="cls-combo">${safeHtml(type,'Available')}</td><td class="cls-seats">${safeHtml(h.seats!=null?h.seats:(h.capacity||h.cap||'-'))}</td></tr>`;
  }).join(''):`<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:18px">No configured house matches your gender and residential status. You can still submit; the school will assign a house after configuration.</td></tr>`;
}
function pickHouse(id,name){
  app.houseId=decodeURIComponent(String(id||''));
  app.houseName=decodeURIComponent(String(name||''));
  document.querySelectorAll('.house-row').forEach(r=>r.classList.toggle('sel',String(r.dataset.id)===String(app.houseId)));
}
function applyFeatureVisibility(){
  const passport=$('passportPhotoField'); if(passport) passport.style.display=allowPassportPhoto()?'':'none';
  const cls=$('classSelectBlock'); if(cls) cls.style.display=allowClassSelection()?'':'none';
  const hs=$('houseSelectBlock'); if(hs) hs.style.display='none';
  const enrLabel=document.querySelector('label[for="enrFileInput"]');
  const enrReq=document.querySelector('#enrWrap')&&document.querySelector('#enrWrap').closest('.field')?.querySelector('.rq');
  if(enrReq) enrReq.style.display=forceEnrolmentUpload()?'':'none';
  onReligionChange();
}
function uploadEnr(){ const inp=$('enrFileInput'); if(inp) inp.click(); }
async function uploadStudentFile(kind,file){
  if(!session||!session.index||!session.token||!session.school) return {ok:false,message:'Please log in again'};
  const form=new FormData();
  form.append('school_id',session.school);
  form.append('index',session.index);
  form.append('token',session.token);
  form.append('kind',kind);
  form.append('file',file,file.name||kind);
  try{
    const response=await fetch(SUPABASE_URL+'/functions/v1/student-upload',{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY},body:form});
    const data=await response.json().catch(()=>null);
    return data||{ok:false,message:'Upload service returned an invalid response'};
  }catch(error){return {ok:false,message:(error&&error.message)||'Upload service is unavailable'};}
}
async function handleEnrFile(inp){
  const file=inp.files&&inp.files[0]; inp.value='';
  if(!file) return;
  const isJpg = file.type==='image/jpeg' || file.type==='image/jpg' || /\.jpe?g$/i.test(file.name);
  if(!isJpg){ toast('Please upload a JPG image'); return; }
  if(file.size > 5*1024*1024){ toast('File too large - max 5 MB'); return; }
  if(!STU||!session){ toast('Please log in again'); return; }
  $('enrWrap').innerHTML='<div class="dropzone"><b>Uploading...</b><small>Please wait</small></div>';
  const result=await uploadStudentFile('enrolment',file);
  if(!result.ok){
    toast('Upload failed - '+(result.message||result.error||'unknown error'));
    removeEnr();
    return;
  }
  app.enrUploaded=true;
  app.fields.enrolment_form_url = result.storage_ref;
  app.fields.enrolment_form_path = result.path;
  app.fields.enrolment_uploaded = true;
  const kb=Math.max(1,Math.round(file.size/1024));
  $('enrWrap').innerHTML=`<div class="file-done"><span class="fi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span><div><b>${file.name.replace(/[<>"]/g,'')}</b><small>Uploaded - ${kb} KB</small></div><button class="x" data-qa-onclick="removeEnr()">Remove</button></div>`;
  toast('Enrolment form uploaded');
}
function removeEnr(){app.enrUploaded=false;app.fields.enrolment_form_url='';app.fields.enrolment_form_path='';app.fields.enrolment_uploaded=false;$('enrWrap').innerHTML=`<div class="dropzone" data-qa-onclick="uploadEnr()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><b>Tap to upload your enrolment form</b><small>JPG only - up to 5 MB - enrolment code must be visible</small></div>`;}
function resetPassportUploadUi(){
  const wrap=$('photoWrap'); if(!wrap)return;
  app.photoUploaded=false;
  if(app.fields){app.fields.passport_photo_url='';app.fields.passport_photo_path='';app.fields.passport_photo_uploaded=false;}
  wrap.innerHTML=`<div class="dropzone" data-qa-onclick="uploadPassportPhoto()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg><b>Tap to upload your passport photo</b><small>JPG or PNG - up to 2 MB</small></div>`;
}
function uploadPassportPhoto(){ const inp=$('photoFileInput'); if(inp) inp.click(); }
async function handlePassportFile(inp){
  const file=inp.files&&inp.files[0]; inp.value='';
  if(!file) return;
  const okType=/^image\/(jpeg|png)$/i.test(file.type)||/\.(jpe?g|png)$/i.test(file.name);
  if(!okType){ toast('Please upload a JPG or PNG passport photo'); return; }
  if(file.size > 2*1024*1024){ toast('Photo too large - max 2 MB'); return; }
  if(!STU||!session){ toast('Please log in again'); return; }
  $('photoWrap').innerHTML='<div class="dropzone"><b>Uploading photo...</b><small>Please wait</small></div>';
  const result=await uploadStudentFile('passport',file);
  if(!result.ok){ toast('Passport upload failed - '+(result.message||result.error||'unknown error')); resetPassportUploadUi(); return; }
  const previewUrl=URL.createObjectURL(file);
  app.photoUploaded=true;
  app.fields.passport_photo_url=result.storage_ref;
  app.fields.passport_photo_path=result.path;
  app.fields.passport_photo_uploaded=true;
  $('photoWrap').innerHTML=`<div class="file-done passport-photo-done"><span class="fi passport-preview-frame"><img src="${escapeHtml(previewUrl)}" alt="Passport photo"></span><div><b>${escapeHtml(file.name)}</b><small>Passport photo uploaded</small></div><button class="x" data-qa-onclick="resetPassportUploadUi()">Remove</button></div>`;
  setStudentPassportAvatar(previewUrl);
  toast('Passport photo uploaded');
}

function toggleOther(selId){ const s=$(selId), o=$(selId+'-other'); if(!s||!o)return; const isOther=/^others?$/i.test((s.value||'').trim()); o.style.display=isOther?'block':'none'; if(!isOther)o.value=''; }
function otherVal(selId){ const s=$(selId), o=$(selId+'-other'); if(s&&/^others?$/i.test((s.value||'').trim())&&o&&o.value.trim()) return o.value.trim(); return s?s.value:''; }
function onReligionChange(){
  toggleOther('pf-rel');
  const field=$('pf-den-field');
  const show=isChristianReligion();
  if(field) field.style.display=show?'':'none';
  if(!show){
    const den=$('pf-den'),other=$('pf-den-other');
    if(den) den.value='';
    if(other){other.value='';other.style.display='none';}
  }
}
function setSelectMaybeOther(selId,v){ const s=$(selId), o=$(selId+'-other'); if(!s)return; if(v==null||v==='')return;
  const has=[...s.options].some(op=>op.value===v||op.text===v);
  if(has){ s.value=v; } else { const oo=[...s.options].find(op=>/^others?$/i.test(op.value||op.text)); if(oo){ s.value=oo.value||oo.text; if(o){o.value=v;} } else { s.value=v; } }
  toggleOther(selId);
}
function collect(step,opts){
  const useStored=!!(opts&&opts.useStored);
  const f=app.fields;
  if(step===0){Object.assign(f,{raw_score:fieldValue('pf-raw',useStored),enrolment_code:fieldValue('pf-enrol',useStored).toUpperCase(),jhs_attended:fieldValue('pf-jhs',useStored),jhs_type:fieldValue('pf-jhstype',useStored),enrolment_uploaded:app.enrUploaded});}
  if(step===1){Object.assign(f,{dob:fieldValue('pf-dob',useStored),place_of_birth:fieldValue('pf-pob',useStored),nationality:fieldValue('pf-nat',useStored),religion:fieldValue('pf-rel',useStored),denomination:isChristianReligion()?fieldValue('pf-den',useStored):'',address:fieldValue('pf-addr',useStored),town:fieldValue('pf-town',useStored),region:fieldValue('pf-region',useStored),district:fieldValue('pf-district',useStored),interest:fieldValue('pf-interest',useStored),ghana_card:fieldValue('pf-card',useStored),class_id:app.classId,class_name:app.className});}
  if(step===2){Object.assign(f,{sms_contact:fieldValue('pf-sms',useStored),whatsapp:fieldValue('pf-wa',useStored),other_phone:fieldValue('pf-other',useStored),email:fieldValue('pf-email',useStored),father_name:fieldValue('pf-fname',useStored),father_occupation:fieldValue('pf-focc',useStored),father_phone:fieldValue('pf-fphone',useStored),mother_name:fieldValue('pf-mname',useStored),mother_occupation:fieldValue('pf-mocc',useStored),mother_phone:fieldValue('pf-mphone',useStored),guardian:fieldValue('pf-guard',useStored),guardian_phone:fieldValue('pf-gphone',useStored),digital_address:fieldValue('pf-digital',useStored)});}
}
function stepNext(step){
  const check=validateStep(step);
  if(!check.ok) return;
  app.done[step]=true;
  goStep(step+1);
}
function prefillRecords(r){
  if(!r)return;
  const set=(id,v)=>{const e=$(id);if(e&&v!=null)e.value=v;};
  set('pf-raw',r.raw_score);set('pf-enrol',r.enrolment_code);set('pf-jhs',r.jhs_attended);set('pf-jhstype',r.jhs_type);
  set('pf-dob',normalizeDobValue(r.dob));set('pf-pob',r.place_of_birth);setSelectMaybeOther('pf-nat',r.nationality);setSelectMaybeOther('pf-rel',r.religion);setSelectMaybeOther('pf-den',r.denomination);
  set('pf-addr',r.address);set('pf-town',r.town);set('pf-region',r.region);set('pf-district',r.district);setSelectMaybeOther('pf-interest',r.interest);set('pf-card',r.ghana_card);
  set('pf-sms',r.sms_contact);set('pf-wa',r.whatsapp);set('pf-other',r.other_phone);set('pf-email',r.email);
  set('pf-fname',r.father_name);set('pf-focc',r.father_occupation);set('pf-fphone',r.father_phone);set('pf-mname',r.mother_name);set('pf-mocc',r.mother_occupation);set('pf-mphone',r.mother_phone);
  set('pf-guard',r.guardian);set('pf-gphone',r.guardian_phone);set('pf-digital',r.digital_address);
  if(r.enrolment_uploaded){app.enrUploaded=true;$('enrWrap').innerHTML=`<div class="file-done"><span class="fi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span><div><b>enrolment-form.jpg</b><small>Uploaded</small></div><button class="x" data-qa-onclick="removeEnr()">Remove</button></div>`;}
  if(r.passport_photo_url||r.passport_photo_path){app.photoUploaded=true;$('photoWrap').innerHTML=`<div class="file-done"><span class="fi"><span style="font-size:11px">Loading</span></span><div><b>passport-photo</b><small>Uploaded</small></div><button class="x" data-qa-onclick="resetPassportUploadUi()">Remove</button></div>`; refreshPassportPreview(r);}
  if(r.class_name)app.className=r.class_name;
  Object.assign(app.fields,r);
  onReligionChange();
}
async function refreshPassportPreview(r){
  const wrap=$('photoWrap');
  if(!wrap||!r)return;
  const src=await studentSignedFileUrl(r.passport_photo_path||r.passport_photo_url);
  if(!src)return;
  wrap.innerHTML=`<div class="file-done passport-photo-done"><span class="fi passport-preview-frame"><img src="${escapeHtml(src)}" alt="Passport photo"></span><div><b>passport-photo</b><small>Uploaded</small></div><button class="x" data-qa-onclick="resetPassportUploadUi()">Remove</button></div>`;
  setStudentPassportAvatar(src);
}
function rev(t,rows,step){return `<div class="rev-block"><div class="rev-head"><span class="t">${safeHtml(t)}</span><a data-qa-onclick="goStep(${step})" style="font-size:11.5px">edit</a></div><dl class="rev-body">${rows.map(r=>`<dt>${safeHtml(r[0])}</dt><dd>${safeHtml(r[1],'-')}</dd>`).join('')}</dl></div>`;}
function buildReview(){
  collect(0,{useStored:true});collect(1,{useStored:true});collect(2,{useStored:true});
  const f=app.fields,s=STU;
  const studentDisplayName=studentName(s)||s.full_name||s.surname||'';
  let h='';
  h+=rev('Enrolment data - Part 1',[['Index No',s.index],['Gender',s.gender],['Programme',s.programme],['Residential',s.residential],['Student Name',studentDisplayName],['Aggregate',s.aggregate]],0);
  h+=rev('Enrolment data - Part 2',[['Raw Score',f.raw_score],['Enrolment Code',f.enrolment_code],['JHS Attended',f.jhs_attended],['JHS Type',f.jhs_type],['Enrolment form',app.enrUploaded?'Uploaded':'Not uploaded'],['Passport photo',app.photoUploaded?'Uploaded':'Not uploaded']],0);
  h+=rev('Personal data',[['Date of Birth',f.dob],['Place of Birth',f.place_of_birth],['Nationality',f.nationality],['Religion',f.religion],['Denomination',f.denomination],['Address',f.address],['Town',f.town],['Region',f.region],['District',f.district],['Interest',f.interest],['Ghana Card/NHIS',f.ghana_card]],1);
  h+=rev('Class selection',[['Class',allowClassSelection()?(app.className||''):'Assigned by school']],1);
  h+=rev('Communication',[['Mobile (SMS)',f.sms_contact],['WhatsApp',f.whatsapp],['Other Phone',f.other_phone],['E-mail',f.email]],2);
  h+=rev('Parental data',[["Father's Name",f.father_name],["Father's Occupation",f.father_occupation],["Father's Contact",f.father_phone],["Mother's Name",f.mother_name],["Mother's Occupation",f.mother_occupation],["Mother's Contact",f.mother_phone],['Guardian',f.guardian],['Residential Tel.',f.guardian_phone],['Digital Address',f.digital_address]],2);
  $('reviewBlocks').innerHTML=h;
}
async function sendSubmissionConfirmation(){
  if(!session||!session.index||!session.token) return {ok:false,status:'processing',message:'No active session.'};
  try{
    const res=await fetch(SUPABASE_URL+'/functions/v1/send-sms',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY},
      body:JSON.stringify({mode:'submission-confirmation',index:session.index,token:session.token,school:session.school||null,application_no:''})
    });
    const data=await res.json().catch(()=>null);
    if(!data) return {ok:false,status:'processing',message:'SMS confirmation could not be confirmed yet.'};
    return data;
  }catch(e){
    return {ok:false,status:'processing',message:'SMS confirmation could not be confirmed yet.'};
  }
}
function applySubmittedStudentState(payload){
  if(!STU) return;
  const cleanPayload=Object.assign({},payload||{});
  ['admission_no','admission_number','permanent_admission_number','school_no','house','house_id','house_name'].forEach(function(key){delete cleanPayload[key];});
  const nextRecords=Object.assign({},STU.records||{},cleanPayload);
  STU=Object.assign({},STU,{
    records:nextRecords,
    contact:(payload&&payload.sms_contact)||STU.contact||'',
    class_id:app.classId||STU.class_id||null,
    class:app.className||STU.class||'',
    personal_done:true,
    programme_done:true,
    undertaking_done:true,
    documents_done:!!app.enrUploaded,
    submitted:true
  });
  app.done=[true,true,true];
}
async function runSubmissionAftercare(){
  const smsResult=await sendSubmissionConfirmation();
  const smsStatus=(smsResult&&smsResult.status)||'processing';
  const smsStatusLabel=smsStatus==='sent'||smsStatus==='duplicate'?'Sent':(smsStatus==='skipped'?'Skipped':'Processing');
  const smsNote=smsStatusLabel==='Sent'
    ? 'A confirmation SMS has been sent to your phone number.'
    : 'Your personal record was saved even though SMS delivery could not be confirmed.';
  patchSubmissionSuccess({
    sms_status:smsStatus,
    sms_status_label:smsStatusLabel,
    sms_note:smsNote
  });
  try{ await refreshStudent({force:true}); }catch(e){}
}
async function submitApp(){
  syncStepCompletion();
  const firstInvalid=app.done.findIndex(d=>!d);
  if(firstInvalid>-1){ goStep(firstInvalid); validateStep(firstInvalid); return; }
  const payload=Object.assign({},app.fields,{surname:STU.surname||STU.full_name,other_names:STU.other_names,aggregate:STU.aggregate});
  ['admission_no','admission_number','permanent_admission_number','school_no','house','house_id','house_name'].forEach(function(key){delete payload[key];});
  const submitBtn=$('submitBtn');
  const previousLabel=submitBtn.textContent;
  submitBtn.textContent='Submitting...';
  submitBtn.disabled=true;
  try{
    const {data,error}=await studentPortalRequest('submit',{p_index:session.index,p_token:session.token,payload,p_school:session.school||null});
    if(error||!data.ok){
      if(data&&data.error==='closed'){toast('Admission is closed for this school - submission not allowed.');return;}
      toast((data&&data.message)||(error&&error.message)||'Submission failed - please try again');return;
    }
    applySubmittedStudentState(payload);
    patchSubmissionSuccess({
      school_name:(SCHOOL&&SCHOOL.school&&SCHOOL.school.name)||'Your school',
      submitted:true,
      sms_status:'processing',
      sms_status_label:'Processing',
      sms_note:'Your personal record has been saved. Your admission letter is ready to print.'
    });
    app.current=0;
    hydrate();
    showPanel('dash');
    renderSubmissionSuccess();
    toast('Personal record saved. Your admission letter is ready to print.');
    setTimeout(function(){ runSubmissionAftercare(); },0);
  } finally {
    submitBtn.textContent=previousLabel;
    submitBtn.disabled=false;
  }
}

/* ===== DOCUMENTS ===== */
function schoolCrest(){
  let u=(SCHOOL&&SCHOOL.school&&SCHOOL.school.crest_url)||'';
  if(!u){ const s=SCHOOL&&SCHOOL.school; const sid=s&&s.id, snm=s&&s.name;
    const m=(SCHOOLS_LIST||[]).find(x=>(sid&&String(x.id)===String(sid))||(snm&&x.name===snm));
    if(m)u=m.crest_url||''; }
  return u;
}
function schoolProfileRecord(){
  const s=(SCHOOL&&SCHOOL.school)||{};
  const sid=s&&s.id, snm=s&&s.name;
  const m=(SCHOOLS_LIST||[]).find(x=>(sid&&String(x.id)===String(sid))||(snm&&x.name===snm));
  return Object.assign({}, m||{}, s||{});
}
function schoolPhoneValue(){
  const s=schoolProfileRecord();
  return firstNonEmpty(
    s.helpdesk_line,s.helpdeskLine,s.helpdesk_phone,s.helpdeskPhone,s.support_phone,s.supportPhone,
    s.helpdesk,s.helpline,s.help_line,s.phone,s.contact_phone,s.school_phone,''
  )||'';
}
function schoolEmailValue(){
  const s=schoolProfileRecord();
  return firstNonEmpty(
    s.helpdesk_email,s.helpdeskEmail,s.support_email,s.supportEmail,s.help_email,
    s.email,s.contact_email,s.school_email,''
  )||'';
}
function printDoc(title,bodyHTML,bare){
  const w=window.open('','_blank'); if(!w){toast('Allow pop-ups to open the document');return;}
  const sch=(SCHOOL&&SCHOOL.school.name)||'Senior High School';
  const bodyFont=(title==='Personal Records Form')?"'Times New Roman',Times,serif":'Georgia,serif';
  const isLetter=(title==='Admission Letter');
  const wantWM=(title==='Admission Letter'||title==='Personal Records Form');
  const crest=schoolCrest();
  const onePage=isLetter
    ? 'html,body{height:auto}body{max-width:760px;margin:0 auto;padding:14px 22px 6px;line-height:1.45}h1{font-size:18px;margin-bottom:1px}.sub{font-size:12px;margin-bottom:12px}h2{font-size:15px;padding-bottom:3px;margin:6px 0}p{margin:6px 0}table{margin:8px 0}td{padding:3px 4px;font-size:13px}@page{size:A4;margin:12.7mm}@media print{body{margin:0;padding:0;max-width:none}p,table,h2,div{page-break-inside:avoid}}'
    : '';
  // Compact layout so the full Personal Records Form fits within 2 A4 pages, with Word-default 1in margins.
  const recPage=(title==='Personal Records Form')
    ? 'body{max-width:760px;margin:0 auto;padding:14px 22px;line-height:1.3}h1{font-size:18px;margin-bottom:1px}.sub{font-size:12px;margin-bottom:10px}h2{font-size:14px;padding-bottom:3px;margin:6px 0}p{margin:4px 0;font-size:12.5px}table{margin:6px 0}td{padding:3px 6px;font-size:12px}.sec-h{font-size:11px;padding:5px 6px}@page{size:A4;margin:12.7mm}@media print{body{margin:0;padding:0;max-width:none}tr{page-break-inside:avoid}}'
    : '';
  const head='<html><head><title>'+title+'</title><style>body{font-family:'+bodyFont+';max-width:780px;margin:30px auto;padding:0 24px;color:#14201c;line-height:1.6}h1{font-size:20px;text-align:center;margin-bottom:2px}.sub{text-align:center;color:#555;font-size:13px;margin-bottom:24px}h2{font-size:16px;border-bottom:2px solid #1557B0;padding-bottom:4px}table{width:100%;border-collapse:collapse;margin:12px 0}td{padding:6px 4px;border-bottom:1px solid #eee;font-size:14px}.lbl{color:#666;width:230px}.rn{color:#999;font-weight:600;margin-right:4px}.sec-h{background:#1557B0;color:#fff;font-weight:700;font-size:12px;letter-spacing:.06em;text-transform:uppercase;padding:7px 8px;border-bottom:none}img{max-width:100%}.qa-wm{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:62%;max-width:520px;z-index:0;pointer-events:none;opacity:.2;-webkit-print-color-adjust:exact;print-color-adjust:exact}.qa-wm img{width:100%;height:auto;display:block}body>*{position:relative;z-index:1}@media print{body{margin:0}.sec-h{-webkit-print-color-adjust:exact;print-color-adjust:exact}.qa-wm{opacity:.2}}'+onePage+recPage+'</style></head><body>';
  const wm=(wantWM&&crest)?'<div class="qa-wm"><img src="'+crest+'" alt=""></div>':'';
  const banner=bare?'':'<h1>'+sch.toUpperCase()+'</h1><div class="sub">Online Admission - '+((SCHOOL&&SCHOOL.config.academic_year)||'2025/2026')+'</div>';
  const copyright='<p style="margin-top:'+(isLetter?'18px':'30px')+';text-align:center;color:#888;font-size:11px;border-top:1px solid #e5e7eb;padding-top:8px">Copyright &copy; 2026 AXIOMBYTE HUB. All rights reserved. - Version 1.0</p>';
  const inner=(bare?'<div style="position:relative">'+bodyHTML+'</div>':banner+bodyHTML)+copyright;
  w.document.write(head+wm+inner+'</body></html>');
  w.document.close(); setTimeout(()=>w.print(),350);
}
function reopening(){const c=SCHOOL&&SCHOOL.config,raw=String((c&&c.reopening_date)||'').trim();if(!raw)return 'Reporting date not set';const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})/),d=m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3])):new Date(raw);return Number.isNaN(d.getTime())?raw:d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});}
const HANDWRITING_LINE='______________________________';
function admissionNumberValue(){return String((STU&&(STU.permanent_admission_number||STU.admission_no||STU.school_no))||'').trim();}
function houseAllocationValue(){return String((STU&&(STU.house_name||STU.house))||'').trim();}
function recordsTableHTML(){
  const s=STU, r=(s.records||{});
  const row=(l,v)=>'<tr><td class="lbl">'+safeHtml(l)+'</td><td>'+safeHtml(v,'-')+'</td></tr>';
  const RN=['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii','xiii','xiv','xv','xvi','xvii','xviii','xix','xx'];
  let n=0;
  const rowN=(l,v)=>'<tr><td class="lbl"><span class="rn">'+(RN[n++]||(n))+'.</span> '+safeHtml(l)+'</td><td>'+safeHtml(v,'-')+'</td></tr>';
  const section=(letter,title)=>{ n=0; return '<tr><td class="sec-h" colspan="2">'+safeHtml(letter)+'. '+safeHtml(title)+'</td></tr>'; };
  return '<table class="records-table">'
    +section('A','Placement')
    +rowN('Full name',studentName(s))+rowN('Gender',s.gender)+rowN('JHS Index No.',s.index)
    +rowN('Programme',s.programme)+rowN('Residential Status',s.residential)+rowN('Class',s.class||r.class_name)+rowN('House Allocation',houseAllocationValue()||HANDWRITING_LINE)+rowN('Admission Number',admissionNumberValue()||HANDWRITING_LINE)
    +section('B','Enrolment Data')
    +rowN('Aggregate of Best Six',(s.aggregate!=null?s.aggregate:''))+rowN('Raw Score',r.raw_score)+rowN('Enrolment Code',r.enrolment_code)
    +rowN('JHS Attended',r.jhs_attended)+rowN('JHS Type',r.jhs_type)
    +section('C','Personal Data')
    +rowN('Date of Birth',r.dob)+rowN('Place of Birth',r.place_of_birth)+rowN('Nationality',r.nationality)+rowN('Religion',r.religion)+rowN('Denomination',r.denomination)
    +rowN('Home Address',r.address)+rowN('Home Town',r.town)+rowN('Region',r.region)+rowN('District',r.district)+rowN('Interest(s)',r.interest)+rowN('Ghana Card / NHIS',r.ghana_card)
    +section('D','Parent / Guardian')
    +rowN('SMS Contact',r.sms_contact||s.contact)+rowN('WhatsApp',r.whatsapp)+rowN('Other Phone',r.other_phone)+rowN('E-mail',r.email)
    +rowN('Father\u2019s Name',r.father_name)+rowN('Father\u2019s Occupation',r.father_occupation)+rowN('Father\u2019s Contact',r.father_phone)
    +rowN('Mother\u2019s Name',r.mother_name)+rowN('Mother\u2019s Occupation',r.mother_occupation)+rowN('Mother\u2019s Contact',r.mother_phone)
    +rowN('Guardian',r.guardian)+rowN('Guardian Phone',r.guardian_phone)+rowN('Guardian Digital Address',r.digital_address)
    +'</table>';
}
function tplVars(){
  const s=STU, sc=(SCHOOL&&SCHOOL.school)||{}, cf=(SCHOOL&&SCHOOL.config)||{};
  const cu=schoolCrest();
  return {
    CREST: cu?('<img src="'+cu+'" style="width:90px;height:auto;display:block;margin:0 auto 4px" alt="">'):'',
    CREST_TOP: cu?('<img src="'+cu+'" style="width:54px;height:auto;display:block" alt="">'):'',
    CREST_CENTER: cu?('<img src="'+cu+'" style="width:148px;height:auto;display:block;margin:0 auto" alt="">'):'',
    SCHOOL_NAME:sc.name||'', SCHOOL_ADDRESS:sc.address||'', SCHOOL_PHONE:schoolPhoneValue(), SCHOOL_EMAIL:schoolEmailValue(),
    HEADMASTER:sc.headmaster_name||'', ACADEMIC_YEAR:cf.academic_year||'2025/2026',
    DATE:new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}),
    REPORTING_DATE:reopening(), REPORTING_TIME:cf.reopening_time||'',
    STUDENT_NAME:studentName(s), INDEX:s.index||'', ADMISSION_NO:admissionNumberValue()||HANDWRITING_LINE,
    PROGRAMME:s.programme||'', CLASS:s.class||'', HOUSE:houseAllocationValue()||HANDWRITING_LINE,
    GENDER:s.gender||'', RESIDENTIAL:s.residential||'', AGGREGATE:(s.aggregate!=null?s.aggregate:''), CONTACT:s.contact||''
  };
}
function qrText(){
  const v=tplVars();
  const admissionNumber=admissionNumberValue(), houseName=houseAllocationValue();
  return [v.SCHOOL_NAME,'Name: '+v.STUDENT_NAME,'Index: '+v.INDEX,admissionNumber?('Adm No: '+admissionNumber):'',
    'Programme: '+v.PROGRAMME,houseName?('House: '+houseName):'','Residential: '+v.RESIDENTIAL,'Year: '+v.ACADEMIC_YEAR]
    .filter(Boolean).join('\n');
}
function buildQR(text,px){
  try{ if(typeof qrcode==='undefined'||!text) return '';
    const q=qrcode(0,'M'); q.addData(text); q.make();
    const cells=q.getModuleCount(); const cell=Math.max(2,Math.round((px||108)/(cells+8)));
    return q.createDataURL(cell,cell*4);
  }catch(e){ return ''; }
}
const GES_HEAD='<table style="width:100%;border-collapse:collapse;margin:0 0 6px"><tr><td style="border:none;width:64px;vertical-align:middle">{CREST_TOP}</td><td style="border:none;vertical-align:middle;padding-left:10px"><div style="font-size:16px;font-weight:700;letter-spacing:.35px">{SCHOOL_NAME}</div><div style="font-size:11px">{SCHOOL_ADDRESS}</div></td></tr></table><div style="border-top:1.6px solid #111;margin:4px 0 24px"></div><div style="text-align:center;line-height:1.25;margin-bottom:12px"><div style="font-size:28px;font-weight:700;letter-spacing:.35px">{SCHOOL_NAME}</div><div style="font-size:12px;font-weight:700;margin-top:6px">(GHANA EDUCATION SERVICE)</div></div><table style="width:100%;border-collapse:collapse;margin:0 0 14px"><tr><td style="border:none;vertical-align:top;width:34%;font-size:12px;line-height:1.45"><div style="font-weight:700">{HEADMASTER}</div><div><b>Our Ref. No.</b> ........................</div><div><b>Your Ref. No.</b> ........................</div><div><b>Phone:</b> {SCHOOL_PHONE}</div><div><b>Email:</b> {SCHOOL_EMAIL}</div></td><td style="border:none;vertical-align:top;width:32%;text-align:center">{CREST_CENTER}</td><td style="border:none;vertical-align:top;width:34%;font-size:12px;line-height:1.45;text-align:right"><div style="font-weight:700">{SCHOOL_ADDRESS}</div><div style="margin-top:14px;font-weight:700">{DATE}</div></td></tr></table><div style="border-top:1.2px solid #111;margin:6px 0 18px"></div>';
const DOC_STUDENT_HEAD='<table style="width:100%;border-collapse:collapse;margin:0 0 10px"><tr><td style="border:none;font-size:12.5px"><b>Student:</b> {STUDENT_NAME}</td><td style="border:none;font-size:12.5px"><b>Index No.:</b> {INDEX}</td><td style="border:none;font-size:12.5px"><b>Admission Number:</b> {ADMISSION_NO}</td></tr><tr><td style="border:none;font-size:12.5px"><b>Programme:</b> {PROGRAMME}</td><td style="border:none;font-size:12.5px"><b>Class:</b> {CLASS}</td><td style="border:none;font-size:12.5px"><b>House Allocation:</b> {HOUSE}</td></tr></table>';
const LETTER_DEFAULT=GES_HEAD
  +'<h3 style="text-align:center;text-decoration:underline;margin:12px 0 18px;font-size:17px">ADMISSION &mdash; {ACADEMIC_YEAR} ACADEMIC YEAR</h3>'
  +'<p style="font-size:13.5px;line-height:1.6">I am pleased to inform you that on the basis of your ward&rsquo;s performance at the BECE, Master/Miss <b>{STUDENT_NAME}</b> (Index No. <b>{INDEX}</b>) has been offered admission into <b>{SCHOOL_NAME}</b> as a <b>{RESIDENTIAL}</b> student to pursue the Free SHS Programme.</p>'
  +'<p><b>Admission Number:</b> {ADMISSION_NO}</p><p><b>House Allocation:</b> {HOUSE}</p>'
 +'<ol>'
 +'<li>The Programme offered him/her is <b>{PROGRAMME}</b>. Parents are to note that after admission students have only two weeks to change their course/Programme if they wish to do so.</li>'
 +'<li>Please find enclosed a copy of the prospectus of the school.</li>'
 +'<li>Fill the enclosed forms and return them without delay to the school&rsquo;s Administration.</li>'
 +'<li>You are required to attach a copy of your ward&rsquo;s Admission Letter, BECE Result Slip, Birth Certificate, Placement Slip, and completed Enrolment Form for submission to the Headmaster.</li>'
 +'<li>Your ward should bring to school four (4) passport-size photographs for his/her personal records.</li>'
 +'<li><b>ALL NEWLY ADMITTED STUDENTS ARE TO REPORT ON {REPORTING_DATE}.</b></li></ol>'
 +'<table style="width:100%;border-collapse:collapse;margin-top:54px"><tr><td style="border:none;vertical-align:bottom;width:68%"><p style="margin:0 0 34px">Yours faithfully,</p><div style="border-top:1.2px solid #111;width:220px;margin-bottom:4px"></div><div><b>{HEADMASTER}</b></div><div>(HEADMASTER)</div></td><td style="border:none;text-align:right;vertical-align:bottom">{QR_CODE}</td></tr></table>';
const RECORDS_DEFAULT=GES_HEAD
  +'<h3 style="text-align:center;text-decoration:underline;margin:10px 0 12px;font-size:17px">PERSONAL RECORDS FORM &mdash; {ACADEMIC_YEAR}</h3>'
  +'{RECORDS_TABLE}'
  +'<p style="margin-top:18px">Signature: _______________________ &nbsp;&nbsp; Date: _______________</p>';
const LEGACY_GES_HEAD='<div style="text-align:center;line-height:1.3">{CREST}<div style="font-size:22px;font-weight:700;letter-spacing:.5px">{SCHOOL_NAME}</div><div style="font-size:12px">(GHANA EDUCATION SERVICE)</div><div style="font-size:12px">{SCHOOL_ADDRESS} &middot; Tel: {SCHOOL_PHONE}</div></div><hr style="border:none;border-top:2px solid #000;margin:8px 0">';
const LEGACY_LETTER_DEFAULT=LEGACY_GES_HEAD
  +'<table style="width:100%;font-size:12px"><tr><td style="border:none;text-align:left">Our Ref. No: ........................<br>Your Ref. No: ........................</td><td style="border:none;text-align:right">Date: {DATE}</td></tr></table>'
  +'<h3 style="text-align:center;text-decoration:underline;margin:12px 0">ADMISSION &mdash; {ACADEMIC_YEAR} ACADEMIC YEAR</h3>'
  +'<p>I am pleased to inform you that on the basis of your ward&rsquo;s performance at the BECE, Master/Miss <b>{STUDENT_NAME}</b> (Index No. {INDEX}) has been offered admission into <b>{SCHOOL_NAME}</b> as a <b>{RESIDENTIAL}</b> student to pursue the Free SHS Programme.</p>'
  +'<p><b>Admission Number:</b> {ADMISSION_NO}</p><p><b>House Allocation:</b> {HOUSE}</p>'
 +'<ol>'
 +'<li>The Programme offered him/her is <b>{PROGRAMME}</b>. Parents are to note that after admission students have only two weeks to change their course/Programme if they wish to do so.</li>'
 +'<li>Please find enclosed a copy of the prospectus of the school.</li>'
 +'<li>Fill the enclosed forms and return them without delay to the school&rsquo;s Administration.</li>'
 +'<li>You are required to attach a copy of your ward&rsquo;s Admission Letter, BECE Result Slip, Birth Certificate, Placement Slip, and completed Enrolment Form for submission to the Headmaster.</li>'
 +'<li>Your ward should bring to school four (4) passport-size photographs for his/her personal records.</li>'
 +'<li><b>ALL NEWLY ADMITTED STUDENTS ARE TO REPORT ON {REPORTING_DATE}.</b></li></ol>'
 +'<p>Yours faithfully,</p><p style="margin-top:34px">_______________________<br><b>{HEADMASTER}</b><br>(HEADMASTER)</p>';
const LEGACY_RECORDS_DEFAULT=LEGACY_GES_HEAD
  +'<h3 style="text-align:center;text-decoration:underline;margin:10px 0">PERSONAL RECORDS FORM &mdash; {ACADEMIC_YEAR}</h3>'
  +'{RECORDS_TABLE}'
  +'<p style="margin-top:18px">Signature: _______________________ &nbsp;&nbsp; Date: _______________</p>';
function normalizeTemplateHeader(tpl,kind){
  const raw=String(tpl||'');
  if(!raw.trim()) return raw;
  let out=raw.includes(LEGACY_GES_HEAD) ? raw.replace(LEGACY_GES_HEAD,GES_HEAD) : raw;
  const isLetter=kind==='letter';
  const titleRx=isLetter
    ? /<h3[^>]*>[\s\S]*?ADMISSION[\s\S]*?<\/h3>/i
    : /<h3[^>]*>[\s\S]*?PERSONAL RECORDS FORM[\s\S]*?<\/h3>/i;
  const titleHtml=isLetter
    ? '<h3 style="text-align:center;text-decoration:underline;margin:12px 0 18px;font-size:17px">ADMISSION &mdash; {ACADEMIC_YEAR} ACADEMIC YEAR</h3>'
    : '<h3 style="text-align:center;text-decoration:underline;margin:10px 0 12px;font-size:17px">PERSONAL RECORDS FORM &mdash; {ACADEMIC_YEAR}</h3>';
  const legacyStudentLine=/<p>\s*Student:\s*<b>\{STUDENT_NAME\}<\/b>\s*&middot;\s*Index:\s*\{INDEX\}\s*&middot;\s*Programme:\s*\{PROGRAMME\}\s*<\/p>/i;
  const studentHeadRx=new RegExp(DOC_STUDENT_HEAD.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g');
  const needsHeaderRefresh=(!out.includes('{CREST_TOP}') || !out.includes('{CREST_CENTER}') || /Our\s*Ref\.\s*No:\s*\.{6,}/i.test(out) || /<hr\b/i.test(out));
  const titleMatch=out.match(titleRx);
  if(needsHeaderRefresh && titleMatch){
    let tail=out.slice((titleMatch.index||0)+titleMatch[0].length).trimStart();
    tail=tail.replace(studentHeadRx,'').replace(legacyStudentLine,'').trimStart();
    out=GES_HEAD+titleHtml+tail;
  }else if(titleMatch){
    out=out.replace(titleRx,titleHtml);
  }
  out=out.replace(studentHeadRx,'').replace(legacyStudentLine,'');
  return out;
}
function resolveDocTemplate(kind,tpl){
  // A saved template is authoritative. Re-normalizing custom HTML here used to
  // restore headers and fields that the school had removed in the editor.
  const raw=window.QATemplateSanitizer.sanitize(String(tpl||'')).trim();
  const fallback=kind==='letter'?LETTER_DEFAULT:RECORDS_DEFAULT;
  if(!raw) return fallback;
  if(kind==='letter' && raw===LEGACY_LETTER_DEFAULT) return LETTER_DEFAULT;
  if(kind==='records' && raw===LEGACY_RECORDS_DEFAULT) return RECORDS_DEFAULT;
  return raw;
}
function ensureAdmissionAssignmentFields(tpl){
  let out=String(tpl||'');
  let required='';
  if(!out.includes('{ADMISSION_NO}')) required+='<p><b>Admission Number:</b> {ADMISSION_NO}</p>';
  if(!out.includes('{HOUSE}')) required+='<p><b>House Allocation:</b> {HOUSE}</p>';
  if(!required) return out;
  return /<ol(?:\s|>)/i.test(out)?out.replace(/<ol(?:\s|>)/i,function(match){return required+match;}):out+required;
}
function fillTemplate(tpl){
  const v=tplVars();
  let out=String(tpl).replace(/\{RECORDS_TABLE\}/g, recordsTableHTML());
  const qurl=buildQR(qrText(),108);
  out=out.replace(/\{QR_CODE\}/g, qurl?'<img src="'+qurl+'" style="width:108px;height:108px" alt="QR code">':'');
  out=out.replace(/\{SCHOOL_ADDRESS\}/g,escapeHtml(v.SCHOOL_ADDRESS).replace(/\r\n?|\n/g,'<br>'));
  const htmlVars=new Set(['CREST','CREST_TOP','CREST_CENTER']);
  out=out.replace(/\{([A-Z_]+)\}/g,(m,k)=> (k in v)? (htmlVars.has(k)?String(v[k]||''):escapeHtml(v[k])) : m);
  return window.QATemplateSanitizer.sanitize(out);
}
function personalRecordComplete(){
  return !!(STU&&(
    STU.submitted ||
    (STU.personal_done&&STU.programme_done&&STU.undertaking_done)
  ));
}
function requirePersonalRecordComplete(){
  if(personalRecordComplete()) return true;
  toast('Complete personal record','warn');
  showPanel('form');
  return false;
}
function docAdmissionLetter(){
  if(!requirePersonalRecordComplete()) return;
  const tpl=(SCHOOL&&SCHOOL.config&&SCHOOL.config.letter_template);
  printDoc('Admission Letter', fillTemplate(ensureAdmissionAssignmentFields(resolveDocTemplate('letter',tpl))), true);
}
function docRecords(){
  if(!configBool('show_personal_records',true)){toast('The personal records document is disabled by the school.');return;}
  if(!requirePersonalRecordComplete()) return;
  const tpl=(SCHOOL&&SCHOOL.config&&SCHOOL.config.records_template);
  printDoc('Personal Records Form', fillTemplate(resolveDocTemplate('records',tpl)), true);
}
function schoolDocUrl(k){ const c=(SCHOOL&&SCHOOL.config)||{}; return c[k]||''; }
function openUploadedDoc(url){ const w=window.open(url,'_blank'); if(!w)toast('Allow pop-ups to open the document'); }
function docUndertaking(){
  if(!configBool('show_undertaking',true)){toast('The undertaking document is disabled by the school.');return;}
  if(!requirePersonalRecordComplete()) return;
  const u=schoolDocUrl('undertaking_url'); if(u){return openUploadedDoc(u);}
  printDoc('Undertaking','<h2>Undertaking</h2><p>I, <b>'+(STU.full_name||'')+'</b> (Index No. '+(STU.index||'')+'), hereby undertake to abide by all the rules and regulations of '+((SCHOOL&&SCHOOL.school.name)||'the school')+'. I understand that any breach may lead to disciplinary action.</p><p style="margin-top:30px">Signature of Student: _______________________</p><p>Signature of Parent / Guardian: _______________________</p><p>Date: _______________________</p>');
}
function docSubjects(){
  if(!configBool('show_programme_selection',true)){toast('The programme / subject document is disabled by the school.');return;}
  if(!requirePersonalRecordComplete()) return;
  const u=schoolDocUrl('subjects_url'); if(u){return openUploadedDoc(u);}
  const p=progById(STU.programme_id);
  const subs=p?(p.subjects||'').split(',').map(x=>'<li>'+x.trim()+'</li>').join(''):'<li>No subject combination is configured.</li>';
  printDoc('Programme / Subject Combination','<h2>'+(p?p.name:(STU.programme||'Programme'))+'</h2><p>Subject combination for '+(STU.full_name||'')+':</p><ol>'+subs+'</ol>');
}
function docProspectus(){
  if(!requirePersonalRecordComplete()) return;
  const u=schoolDocUrl('prospectus_url'); if(u){return openUploadedDoc(u);}
  printDoc('Prospectus','<h2>School Prospectus</h2><p>Welcome to '+((SCHOOL&&SCHOOL.school.name)||'our school')+'. This prospectus outlines what you need to know as a fresh student - academic programmes, school rules, boarding arrangements and the items to bring on reporting day.</p><p>For the full printed prospectus, please collect a copy at the administration office on reporting day.</p>');
}

function gotoSuper(){ try{ if(window.parent&&window.parent!==window&&window.parent.qaShow){ window.parent.qaShow('super'); return; } }catch(e){} location.href='super-admin.html'; }
function logout(){stopWatchDeletion();session=null;STU=null;activeStudentSessionKey='';clearStudentSession();writeSubmissionSuccess(null); showScreen('s-login');$('login-token').value='';$('login-index').value='';}

buildSteps();
// Phone/contact fields: digits only, max 10
(function(){
  const PHONE_IDS=['pf-sms','pf-wa','pf-other','pf-fphone','pf-mphone','pf-gphone','p-phone'];
  document.addEventListener('input',function(e){
    const el=e.target;
    if(el&&el.tagName==='INPUT'&&(PHONE_IDS.indexOf(el.id)>-1||el.type==='tel'||el.getAttribute('inputmode')==='tel')){
      const v=(el.value||'').replace(/\D/g,'').slice(0,10);
      if(v!==el.value) el.value=v;
    }
  });
})();
// Populate the school selectors (login / purchase / retrieve)
let SCHOOLS_LIST=[];
const LOGIN_DEFAULTS={
  title:'QuickAdmissionGH',
  phone:'0256744028',
  email:'admissions@quickadmissiongh.com',
  charge:30,
  code:'QA'
};
const SCHOOL_PROFILE_CACHE_KEY='qag_public_school_profile_cache';
function firstNonEmpty(){
  for(let i=0;i<arguments.length;i++){
    const value=arguments[i];
    if(value!==undefined&&value!==null&&String(value).trim()!=='') return value;
  }
  return '';
}
function readSchoolProfileCache(){
  try{
    const raw=localStorage.getItem(SCHOOL_PROFILE_CACHE_KEY);
    const parsed=raw?JSON.parse(raw):{};
    return parsed&&typeof parsed==='object'?parsed:{};
  }catch(e){
    return {};
  }
}
function mergeCachedSchoolProfile(s){
  if(!s) return s;
  const key=String(s.id||s.school_id||'');
  if(!key) return s;
  const cached=readSchoolProfileCache()[key];
  if(!cached||typeof cached!=='object') return s;
  return Object.assign({},s,cached,{id:s.id||cached.id||key});
}
function schoolField(s,keys,fallback){
  const value=firstNonEmpty(...keys.map(key=>s&&s[key]));
  if(value!=='') return value;
  return fallback;
}
function schoolPortalSubdomain(s){
  const value=String(schoolField(s,['subdomain','portal_subdomain'],'')||'').trim().toLowerCase();
  if(!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(value))return '';
  return RESERVED_PORTAL_SUBDOMAINS.has(value)?'':value;
}
function redirectToSelectedSchool(){
  const select=document.getElementById('directory-school');
  const selectedValue=select?String(select.value||''):'';
  const school=(SCHOOLS_LIST||[]).find(function(row){return String(row.id||row.school_id)===selectedValue;});
  const status=document.getElementById('schoolDirectoryStatus');
  if(!school){
    if(status)status.textContent='Select a school from the list.';
    return;
  }
  const subdomain=schoolPortalSubdomain(school);
  if(!subdomain){
    if(status)status.textContent='This school\'s portal address has not been configured yet.';
    return;
  }
  const schoolName=String(schoolField(school,['name','school_name'],'the selected school'));
  if(status)status.textContent='Opening '+schoolName+'...';
  const target='https://'+subdomain+'.'+PORTAL_ROOT_DOMAIN+'/';
  window.setTimeout(function(){window.location.assign(target);},120);
}
function schoolShortLabel(s){
  const code=String(schoolField(s,['code','school_code'],'')||'').trim();
  if(code) return code.toUpperCase();
  const name=String(schoolField(s,['name','school_name'],'')||'').trim();
  if(!name) return LOGIN_DEFAULTS.code;
  const initials=name.split(/\s+/).filter(Boolean).map(word=>word.charAt(0)).join('').slice(0,4).toUpperCase();
  return initials||LOGIN_DEFAULTS.code;
}
function selectedLoginSchoolLabel(){
  const s=getSelectedSchool();
  return s?String(schoolField(s,['name','school_name'],'Unnamed school')):'-- Select your school --';
}
const SCHOOL_PICKER_CONFIG={
  directory:{select:'directory-school',picker:'directorySchoolPicker',panel:'directorySchoolPanel',search:'directorySchoolSearch',options:'directorySchoolOptions',trigger:'directorySchoolTrigger',triggerText:'directorySchoolTriggerText',onPick:function(){ redirectToSelectedSchool(); }},
  login:{select:'login-school',picker:'loginSchoolPicker',panel:'loginSchoolPanel',search:'loginSchoolSearch',options:'loginSchoolOptions',trigger:'loginSchoolTrigger',triggerText:'loginSchoolTriggerText',onPick:function(){ onLoginSchoolChange(); }},
  purchase:{select:'p-school-sel',picker:'purchaseSchoolPicker',panel:'purchaseSchoolPanel',search:'purchaseSchoolSearch',options:'purchaseSchoolOptions',trigger:'purchaseSchoolTrigger',triggerText:'purchaseSchoolTriggerText'},
  retrieve:{select:'r-school',picker:'retrieveSchoolPicker',panel:'retrieveSchoolPanel',search:'retrieveSchoolSearch',options:'retrieveSchoolOptions',trigger:'retrieveSchoolTrigger',triggerText:'retrieveSchoolTriggerText',onPick:function(){ resetRetrieveOtp(); }}
};
function schoolPickerConfig(key){
  return SCHOOL_PICKER_CONFIG[key]||null;
}
function selectedSchoolPickerLabel(key){
  const cfg=schoolPickerConfig(key);
  const select=cfg?$(cfg.select):null;
  const selectedValue=select?String(select.value||''):'';
  if(selectedValue&&Array.isArray(SCHOOLS_LIST)){
    const found=SCHOOLS_LIST.find(function(s){ return String(s.id)===selectedValue; });
    if(found) return String(schoolField(found,['name','school_name'],'Unnamed school'));
  }
  if(key==='login') return selectedLoginSchoolLabel();
  return '-- Select your school --';
}
function syncSchoolPicker(key){
  const cfg=schoolPickerConfig(key);
  const trigger=cfg?$(cfg.trigger):null;
  const triggerText=cfg?$(cfg.triggerText):null;
  const select=cfg?$(cfg.select):null;
  const isPlaceholder=!(select&&String(select.value||''));
  if(trigger) trigger.classList.toggle('has-placeholder',isPlaceholder);
  if(triggerText){
    triggerText.textContent=selectedSchoolPickerLabel(key);
    triggerText.classList.toggle('is-placeholder',isPlaceholder);
    triggerText.style.setProperty('color','#002B4C','important');
    triggerText.style.setProperty('-webkit-text-fill-color','#002B4C','important');
  }
}
function buildSchoolPickerOptions(key,filterText){
  const cfg=schoolPickerConfig(key);
  const host=cfg?$(cfg.options):null;
  if(!host) return;
  const query=String(filterText||'').trim().toLowerCase();
  const selected=cfg&&$(cfg.select)?$(cfg.select).value:'';
  const baseList=(Array.isArray(SCHOOLS_LIST)?SCHOOLS_LIST:[]).filter(function(s){
    const name=String(schoolField(s,['name','school_name'],'')).toLowerCase();
    const code=String(schoolField(s,['code','school_code'],'')).toLowerCase();
    return !query || name.includes(query) || code.includes(query);
  });
  const list=baseList.slice().sort(function(a,b){
    const aSel=String(a.id)===String(selected)?1:0;
    const bSel=String(b.id)===String(selected)?1:0;
    if(aSel!==bSel) return bSel-aSel;
    const an=String(schoolField(a,['name','school_name'],''));
    const bn=String(schoolField(b,['name','school_name'],''));
    return an.localeCompare(bn);
  });
  if(!list.length){
    host.innerHTML='<div class="login-school-empty">No matching school found.</div>';
    return;
  }
  host.innerHTML=list.map(function(s){
    const isActive=String(s.id)===String(selected);
    const name=safeHtml(schoolField(s,['name','school_name'],'Unnamed school'));
    const code=safeHtml(schoolField(s,['code','school_code'],''));
    const subdomain=schoolPortalSubdomain(s);
    const directoryMeta=key==='directory'?(subdomain?subdomain+'.'+PORTAL_ROOT_DOMAIN:'Portal address pending'):'';
    const meta=directoryMeta||(code&&code!=='&mdash;'?code:'');
    const canOpen=key!=='directory'||!!subdomain;
    return `<button class="login-school-option${isActive?' active':''}" type="button"${canOpen?` data-qa-onclick="pickSchoolPickerValue('${escapeAttr(String(key))}','${escapeAttr(String(s.id))}')"`:' disabled'}><span><strong>${name}</strong>${meta?`<small>${safeHtml(meta)}</small>`:''}</span></button>`;
  }).join('');
}
function openSchoolPicker(key){
  if(tenantPortalRequested())return;
  const cfg=schoolPickerConfig(key);
  const picker=cfg?$(cfg.picker):null;
  const panel=cfg?$(cfg.panel):null;
  const search=cfg?$(cfg.search):null;
  const trigger=cfg?$(cfg.trigger):null;
  if(!picker||!panel) return;
  Object.keys(SCHOOL_PICKER_CONFIG).forEach(function(name){ if(name!==key) closeSchoolPicker(name); });
  picker.classList.add('open');
  panel.hidden=false;
  if(trigger)trigger.setAttribute('aria-expanded','true');
  if(search){
    search.value='';
    buildSchoolPickerOptions(key,'');
    setTimeout(function(){ search.focus(); },0);
  }else{
    buildSchoolPickerOptions(key,'');
  }
}
function closeSchoolPicker(key){
  const cfg=schoolPickerConfig(key);
  const picker=cfg?$(cfg.picker):null;
  const panel=cfg?$(cfg.panel):null;
  const search=cfg?$(cfg.search):null;
  const trigger=cfg?$(cfg.trigger):null;
  if(picker) picker.classList.remove('open');
  if(panel) panel.hidden=true;
  if(trigger)trigger.setAttribute('aria-expanded','false');
  if(search) search.value='';
}
function toggleSchoolPicker(key,forceOpen){
  const cfg=schoolPickerConfig(key);
  const panel=cfg?$(cfg.panel):null;
  if(!panel) return;
  const shouldOpen=typeof forceOpen==='boolean'?forceOpen:panel.hidden;
  if(shouldOpen) openSchoolPicker(key);
  else closeSchoolPicker(key);
}
function filterSchoolPickerOptions(key,value){
  buildSchoolPickerOptions(key,value);
}
function handleSchoolPickerSearchKey(key,event){
  if(event.key==='Escape'){
    closeSchoolPicker(key);
    const cfg=schoolPickerConfig(key);
    const trigger=cfg?$(cfg.trigger):null;
    if(trigger) trigger.focus();
    return;
  }
  if(event.key==='Enter'){
    event.preventDefault();
    const cfg=schoolPickerConfig(key);
    const first=cfg&&$(cfg.options)?$(cfg.options).querySelector('.login-school-option') : null;
    if(first) first.click();
  }
}
function pickSchoolPickerValue(key,value){
  const cfg=schoolPickerConfig(key);
  const select=cfg?$(cfg.select):null;
  if(!select) return;
  select.value=tenantSchoolId()||String(value||'');
  closeSchoolPicker(key);
  syncSchoolPicker(key);
  if(cfg&&typeof cfg.onPick==='function') cfg.onPick();
}
document.addEventListener('click',function(event){
  Object.keys(SCHOOL_PICKER_CONFIG).forEach(function(key){
    const cfg=schoolPickerConfig(key);
    const picker=cfg?$(cfg.picker):null;
    if(picker&&!picker.contains(event.target)) closeSchoolPicker(key);
  });
});
function syncLoginSchoolPicker(){
  syncSchoolPicker('login');
}
function buildLoginSchoolOptions(filterText){
  buildSchoolPickerOptions('login',filterText);
}
function openLoginSchoolPicker(){
  openSchoolPicker('login');
}
function closeLoginSchoolPicker(){
  closeSchoolPicker('login');
}
function toggleLoginSchoolPicker(forceOpen){
  toggleSchoolPicker('login',forceOpen);
}
function filterLoginSchoolOptions(value){
  filterSchoolPickerOptions('login',value);
}
function handleLoginSchoolSearchKey(event){
  handleSchoolPickerSearchKey('login',event);
}
function pickLoginSchool(value){
  pickSchoolPickerValue('login',value);
}
function getSelectedSchool(){
  const select=document.getElementById('login-school');
  const selectedValue=select?select.value:'';
  if(!selectedValue||!Array.isArray(SCHOOLS_LIST)) return null;
  const found=SCHOOLS_LIST.find(s=>
    String(s.id)===String(selectedValue) ||
    String(s.school_id)===String(selectedValue) ||
    String(s.code)===String(selectedValue) ||
    String(s.school_code)===String(selectedValue) ||
    String(s.name)===String(selectedValue) ||
    String(s.school_name)===String(selectedValue)
  )||null;
  return mergeCachedSchoolProfile(found);
}
function setButtonDisabled(el,disabled){
  if(!el) return;
  el.disabled=!!disabled;
  el.style.opacity=disabled?'.55':'';
  el.style.pointerEvents=disabled?'none':'';
}
const SCHOOL_STATUS_REFRESHED={};
async function refreshSelectedSchoolStatus(schoolId){
  if(!schoolId)return;
  const now=Date.now();
  if(now-Number(SCHOOL_STATUS_REFRESHED[schoolId]||0)<5000)return;
  SCHOOL_STATUS_REFRESHED[schoolId]=now;
  const {data}=await studentPortalRequest('school_status',{p_school:schoolId});
  if(!data||!data.ok||String(($('login-school')&&$('login-school').value)||'')!==String(schoolId))return;
  const school=SCHOOLS_LIST.find(function(row){return String(row.id||row.school_id)===String(schoolId);});
  if(school)Object.assign(school,data);
  onLoginSchoolChange();
}
function selectedSchoolHelpdeskPhone(selectedSchool){
  if(!selectedSchool) return LOGIN_DEFAULTS.phone;
  const helpdeskPhone=firstNonEmpty(
    selectedSchool.helpdesk_line,
    selectedSchool.helpdeskLine,
    selectedSchool.helpdesk_phone,
    selectedSchool.helpdeskPhone,
    selectedSchool.support_phone,
    selectedSchool.supportPhone,
    selectedSchool.helpdesk,
    selectedSchool.helpline,
    selectedSchool.help_line
  );
  const schoolPhone=firstNonEmpty(
    selectedSchool.phone,
    selectedSchool.contact_phone,
    selectedSchool.school_phone
  );
  return String(helpdeskPhone||schoolPhone||LOGIN_DEFAULTS.phone).trim()||LOGIN_DEFAULTS.phone;
}
function selectedSchoolHelpdeskEmail(selectedSchool){
  if(!selectedSchool) return LOGIN_DEFAULTS.email;
  const helpdeskEmail=firstNonEmpty(
    selectedSchool.helpdesk_email,
    selectedSchool.helpdeskEmail,
    selectedSchool.support_email,
    selectedSchool.supportEmail,
    selectedSchool.help_email
  );
  const schoolEmail=firstNonEmpty(
    selectedSchool.email,
    selectedSchool.contact_email,
    selectedSchool.school_email
  );
  return String(helpdeskEmail||schoolEmail||LOGIN_DEFAULTS.email).trim()||LOGIN_DEFAULTS.email;
}
function updateBlueBannerHelpdesk(){
  const selectedSchool=getSelectedSchool();
  const finalPhone=selectedSchoolHelpdeskPhone(selectedSchool);
  const finalEmail=selectedSchoolHelpdeskEmail(selectedSchool);
  const phoneText=$('blueBannerHelpdeskPhone');
  const phoneLink=$('blueBannerHelpdeskPhoneLink');
  const emailText=$('blueBannerHelpdeskEmail');
  const emailLink=$('blueBannerHelpdeskEmailLink');
  if(phoneText) phoneText.textContent=finalPhone;
  if(phoneLink) phoneLink.href='tel:'+finalPhone.replace(/\s+/g,'');
  if(emailText) emailText.textContent=finalEmail;
  if(emailLink) emailLink.href='mailto:'+finalEmail;
}
async function loadSchoolsFromPublicTables(){
  const schoolsRes=await sb
    .from('schools')
    .select('id,name,school_code,code,subdomain,phone,email,helpdesk,crest_url')
    .eq('status','active')
    .order('name',{ascending:true})
    .limit(10000);
  if(schoolsRes.error) throw schoolsRes.error;
  let configs=[];
  try{
    const configsRes=await sb
      .from('school_config')
      .select('school_id,admission_status,academic_year,service_charge,accept_online_payment,announcement,helpdesk_line,allow_passport_photo,allow_house_selection,allow_class_selection,force_enrolment_upload')
      .limit(10000);
    if(!configsRes.error) configs=configsRes.data||[];
  }catch(e){}
  const configBySchool={};
  (configs||[]).forEach(function(cfg){
    if(cfg&&cfg.school_id) configBySchool[String(cfg.school_id)]=cfg;
  });
  return (schoolsRes.data||[]).map(function(school){
    const cfg=configBySchool[String(school.id)]||{};
    return {
      id:school.id,
      school_id:school.id,
      name:firstNonEmpty(school.name),
      school_name:firstNonEmpty(school.name),
      school_code:firstNonEmpty(school.school_code,school.code),
      code:firstNonEmpty(school.code,school.school_code),
      subdomain:firstNonEmpty(school.subdomain),
      phone:firstNonEmpty(school.phone),
      email:firstNonEmpty(school.email),
      helpdesk:firstNonEmpty(school.helpdesk,cfg.helpdesk_line),
      helpdesk_line:firstNonEmpty(cfg.helpdesk_line,school.helpdesk),
      crest_url:firstNonEmpty(school.crest_url),
      admission_status:firstNonEmpty(cfg.admission_status),
      academic_year:firstNonEmpty(cfg.academic_year),
      service_charge:Number(cfg.service_charge||0),
      accept_online_payment:cfg.accept_online_payment!==false,
      announcement:firstNonEmpty(cfg.announcement),
      allow_passport_photo:Boolean(cfg.allow_passport_photo||false),
      allow_house_selection:Boolean(cfg.allow_house_selection||false),
      allow_class_selection:cfg.allow_class_selection!==false,
      force_enrolment_upload:cfg.force_enrolment_upload!==false
    };
  });
}
function applyTenantSchoolLock(){
  const schoolId=tenantSchoolId();
  if(!schoolId)return;
  document.documentElement.classList.add('tenant-school-locked');
  Object.keys(SCHOOL_PICKER_CONFIG).forEach(function(key){
    const cfg=schoolPickerConfig(key);
    const select=cfg?$(cfg.select):null;
    const picker=cfg?$(cfg.picker):null;
    if(select)select.value=schoolId;
    if(picker){
      closeSchoolPicker(key);
      const field=picker.closest('.field');
      if(field)field.style.display='none';
    }
    syncSchoolPicker(key);
  });
}
function showTenantPortalUnavailable(){
  document.documentElement.classList.add('tenant-school-unavailable');
  const schoolField=$('f-school');
  if(schoolField)schoolField.style.display='none';
  const title=$('portalLoginFormTitle');
  const subtitle=$('loginFormSub');
  if(title)title.textContent='School portal unavailable';
  if(subtitle)subtitle.textContent='This school portal does not exist or has been suspended. Please confirm the address with the school.';
  setButtonDisabled($('loginBtn'),true);
  setButtonDisabled($('buyTokenBtn'),true);
  setButtonDisabled($('buyTokenQuickBtn'),true);
}
async function loadSchools(){
  const tenantSchool=await resolveTenantSchool();
  const ids=['directory-school','login-school','p-school-sel','r-school'];
  const selected=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)?document.getElementById(id).value:'']));
  let rows=[];
  let loadError=null;
  const directoryCacheKey='qag_school_directory_v1';
  try{
    const cached=JSON.parse(localStorage.getItem(directoryCacheKey)||'null');
    if(cached&&Array.isArray(cached.rows)&&Date.now()-Number(cached.saved_at||0)<30000) rows=cached.rows;
  }catch(e){}
  if(!rows.length) try{
    const {data,error}=await studentPortalRequest('directory',{});
    if(error) throw error;
    rows=Array.isArray(data&&data.schools)?data.schools:[];
    if(rows.length) try{localStorage.setItem(directoryCacheKey,JSON.stringify({saved_at:Date.now(),rows}));}catch(e){}
  }catch(e){
    loadError=e;
  }
  if(!rows.length){
    try{
      rows=await loadSchoolsFromPublicTables();
      loadError=null;
    }catch(e){
      loadError=loadError||e;
    }
  }
  if(tenantPortalRequested()){
    if(tenantSchool){
      const match=rows.find(function(row){return String(row.id||row.school_id)===String(tenantSchool.id);});
      rows=[Object.assign({},tenantSchool,match||{})];
    }else{
      rows=[];
    }
  }
  SCHOOLS_LIST=rows.slice().sort((a,b)=>{
    const an=String(schoolField(a,['name','school_name'],'')||'');
    const bn=String(schoolField(b,['name','school_name'],'')||'');
    return an.localeCompare(bn);
  }).map(function(s){ return mergeCachedSchoolProfile(s)||s; });
  const opts='<option value="">-- Select your school --</option>'+SCHOOLS_LIST.map(s=>`<option value="${s.id}">${safeHtml(schoolField(s,['name','school_name'],'Unnamed school'))}</option>`).join('');
  ids.forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.innerHTML=SCHOOLS_LIST.length?opts:'<option value="">No schools available</option>';
    if(tenantSchoolId())el.value=tenantSchoolId();
    else if(selected[id]&&SCHOOLS_LIST.some(s=>String(s.id)===String(selected[id]))) el.value=selected[id];
  });
  Object.keys(SCHOOL_PICKER_CONFIG).forEach(function(key){
    buildSchoolPickerOptions(key,'');
    syncSchoolPicker(key);
  });
  if(loadError&&!SCHOOLS_LIST.length){
    const msg='Could not load schools. Check your internet connection and refresh.';
    ['directorySchoolOptions','loginSchoolOptions','purchaseSchoolOptions','retrieveSchoolOptions'].forEach(function(id){
      const host=$(id);
      if(host) host.innerHTML='<div class="login-school-empty">'+safeHtml(msg)+'</div>';
    });
    console.warn('School directory load failed',loadError);
  }
  const directoryStatus=$('schoolDirectoryStatus');
  if(directoryStatus&&platformDirectoryRequested()){
    const readyCount=SCHOOLS_LIST.filter(function(s){return !!schoolPortalSubdomain(s);}).length;
    directoryStatus.textContent=loadError&&!SCHOOLS_LIST.length
      ? 'Could not load schools. Check your internet connection and refresh.'
      : readyCount
        ? readyCount+' school portal'+(readyCount===1?' is':'s are')+' available.'
        : 'No school portal is available yet.';
  }
  if(tenantSchoolId())applyTenantSchoolLock();
  else if(tenantPortalRequested())showTenantPortalUnavailable();
  onLoginSchoolChange();
}
function schoolStatus(id){
  const s=SCHOOLS_LIST.find(x=>String(x.id)===String(id));
  if(!s) return null;
  if(typeof s.admission_open==='boolean') return s.admission_open?'OPEN':'CLOSED';
  const raw=schoolField(s,['admission_status'],'');
  if(!raw) return null;
  const status=String(raw).trim().toUpperCase();
  if(['OPEN','OPENED','ACTIVE','TRUE','YES'].includes(status)) return 'OPEN';
  return 'CLOSED';
}
function admissionClosed(id){
  return !!id&&schoolStatus(id)==='CLOSED';
}
function setAdmissionClosedView(closed){
  const panel=$('studentLoginPanel');
  const closedView=$('admissionClosedView');
  if(panel){
    panel.hidden=!!closed;
    panel.setAttribute('aria-hidden',closed?'true':'false');
  }
  if(closedView){
    closedView.hidden=!closed;
    closedView.setAttribute('aria-hidden',closed?'false':'true');
  }
}
function chooseAnotherLoginSchool(){
  if(tenantPortalRequested())return;
  const school=$('login-school');
  if(school) school.value='';
  onLoginSchoolChange();
  const trigger=$('loginSchoolTrigger');
  if(trigger) trigger.focus();
  if(typeof toggleLoginSchoolPicker==='function') toggleLoginSchoolPicker();
}
function onLoginSchoolChange(){
  const lockedId=tenantSchoolId();
  if(lockedId&&$('login-school'))$('login-school').value=lockedId;
  const sid=lockedId||($('login-school')?$('login-school').value:'');
  const s=getSelectedSchool();
  const schoolName=String(schoolField(s,['name','school_name'],LOGIN_DEFAULTS.title));
  const schoolCharge=Number(schoolField(s,['service_charge'],LOGIN_DEFAULTS.charge));
  const chargeValue=Number.isFinite(schoolCharge)?schoolCharge:Number(LOGIN_DEFAULTS.charge);
  const title=$('schTitle');
  const logo=$('schLogo'), crestText=$('schCrestText');
  const welcomeTitle=$('loginWelcomeTitle'), welcomeSub=$('loginWelcomeSubtitle');
  const charge=$('loginCharge'), formSub=$('loginFormSub');
  const crestLabel=schoolShortLabel(s);
  const crestUrl=String(schoolField(s,['crest_url','logo_url'],'')||'').trim();
  syncLoginSchoolPicker();
  if(title) title.textContent=s?schoolName:LOGIN_DEFAULTS.title;
  if(welcomeTitle) welcomeTitle.textContent='Welcome to '+(s?schoolName:LOGIN_DEFAULTS.title);
  if(welcomeSub) welcomeSub.textContent='Online Admission Portal';
  if(formSub) formSub.textContent=s?'Enter your BECE index number and admission token to continue.':'Select your school and enter your details to continue.';
  if(charge) charge.textContent='A service charge of GHS '+chargeValue.toFixed(2)+' is required.';
  if(logo){
    logo.onerror=function(){
      this.style.display='none';
      if(crestText){
        crestText.style.display='';
        crestText.textContent=crestLabel;
      }
    };
    if(crestUrl){
      logo.src=crestUrl;
      logo.style.display='block';
      if(crestText) crestText.style.display='none';
    }else if(!s){
      logo.src='logo-icon.svg';
      logo.style.display='block';
      if(crestText) crestText.style.display='none';
    }else{
      logo.style.display='none';
      logo.removeAttribute('src');
      if(crestText){
        crestText.style.display='';
        crestText.textContent=crestLabel;
      }
    }
  }
  updateBlueBannerHelpdesk();
  const acceptsOnline=!s||schoolField(s,['accept_online_payment'],true)!==false;
  const announcementText=String(schoolField(s,['announcement'],'')||'').trim();
  const announcement=$('loginAnnouncement');
  if(announcement){announcement.textContent=announcementText;announcement.style.display=announcementText?'block':'none';}
  if(charge) charge.textContent=acceptsOnline
    ? 'A service charge of GHS '+chargeValue.toFixed(2)+' is required.'
    : 'Online token payment is currently unavailable for this school.';
  const quickBuy=$('buyTokenQuickBtn');
  if(quickBuy)quickBuy.style.display=acceptsOnline?'':'none';
  const closed=admissionClosed(sid);
  const banner=$('admClosedBanner');
  if(banner) banner.style.display=closed?'block':'none';
  setAdmissionClosedView(closed);
  setButtonDisabled($('loginBtn'),closed);
  setButtonDisabled($('buyTokenBtn'),closed||!acceptsOnline);
  refreshSelectedSchoolStatus(sid);
}
async function initStudentPortal(){
  try{
    if(PASSWORD_RECOVERY_REQUESTED){
      await initializePasswordRecovery();
      return;
    }
    configurePortalEntryView();
    if(platformDirectoryRequested()) await loadSchools();
    else await Promise.allSettled([loadPaystackConfig(),loadSchools(),bootStudent()]);
  }finally{
    finishStudentBoot();
  }
}
initStudentPortal();
window.addEventListener('resize',syncPortalChrome,{passive:true});
window.addEventListener('orientationchange',syncPortalChrome,{passive:true});
window.addEventListener('resize',syncDirectoryViewport,{passive:true});
window.addEventListener('orientationchange',syncDirectoryViewport,{passive:true});
if(window.visualViewport)window.visualViewport.addEventListener('resize',syncDirectoryViewport,{passive:true});
if('ResizeObserver' in window){
  const portalTopbar=document.querySelector('#s-app .ptopbar');
  if(portalTopbar)new ResizeObserver(syncPortalChrome).observe(portalTopbar);
}
window.addEventListener('storage',function(evt){
  if(evt&&evt.key===SCHOOL_PROFILE_CACHE_KEY){
    try{ onLoginSchoolChange(); }catch(e){}
  }
});
// Live school detection on the purchase form
(function(){
  var pi=document.getElementById('p-index'); if(!pi)return;
  var box=document.getElementById('p-school');
  pi.addEventListener('blur', async function(){
    var v=pi.value.trim(); if(!box)return;
    if(!v){box.style.display='none';return;}
    try{
      var psid=document.getElementById('p-school-sel'); var sidv=tenantSchoolId()||(psid?psid.value:null);
      var {data}=await studentPortalRequest('lookup',{p_index:v,p_school:sidv||null});
      if(data&&data.ok){ box.innerHTML='Applying to <b>'+safeHtml(data.name)+'</b> - service charge GHS '+Number(data.charge||0).toFixed(2); box.className='notice info'; box.style.display='block'; }
      else { box.innerHTML='We could not match this index to a participating school. Check the number, or contact your school office.'; box.className='notice warn'; box.style.display='block'; }
    }catch(e){}
  });
})();
