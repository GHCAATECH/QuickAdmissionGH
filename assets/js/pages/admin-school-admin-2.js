/* ================= SUPABASE INTEGRATION (school admin) ================= */
const SB_URL='https://datxaylostmyroleisdl.supabase.co';
const SB_KEY='sb_publishable_c9WlfiojT_wz4uesb3lYaw_91QoIErh';
function schoolAuthScope(){
  try{ if(window.parent&&window.parent!==window&&window.parent.name) return window.parent.name; }catch(e){}
  try{ return window.name||'qag_tab_fallback'; }catch(e){ return 'qag_tab_fallback'; }
}
function schoolAuthKey(k){
  return 'qag_auth_scope::'+schoolAuthScope()+'::'+k;
}
function schoolAdminTabKey(k){
  return 'qag_school_admin_tab::'+schoolAuthScope()+'::'+k;
}
function clearLegacySchoolAuthStorage(){
  try{
    const prefix='qag_auth_scope::'+schoolAuthScope()+'::';
    for(let i=window.localStorage.length-1;i>=0;i--){
      const k=window.localStorage.key(i);
      if(k&&k.indexOf(prefix)===0&&k.indexOf('qag-school-auth')>-1){
        window.localStorage.removeItem(k);
      }
    }
  }catch(e){}
}
function schoolAdminTabSessionActive(){
  try{ return window.sessionStorage.getItem(schoolAdminTabKey('active'))==='1'; }catch(e){ return false; }
}
function setSchoolAdminTabSessionActive(on){
  try{
    if(on) window.sessionStorage.setItem(schoolAdminTabKey('active'),'1');
    else window.sessionStorage.removeItem(schoolAdminTabKey('active'));
  }catch(e){}
}
const schoolAuthStorage={
  getItem:function(k){ try{ return window.sessionStorage.getItem(schoolAuthKey(k)); }catch(e){ return null; } },
  setItem:function(k,v){ try{ window.sessionStorage.setItem(schoolAuthKey(k),v); }catch(e){} },
  removeItem:function(k){ try{ window.sessionStorage.removeItem(schoolAuthKey(k)); }catch(e){} }
};
clearLegacySchoolAuthStorage();
const sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'qag-school-auth',storage:schoolAuthStorage}});
const SCHOOL_ADMIN_ROOT_DOMAIN='quickadmissiongh.com';
const RESERVED_SCHOOL_ADMIN_SUBDOMAINS=new Set(['www','admin','api','mail','ftp','support','staging','app','dashboard','cdn','static','assets','auth','login','portal','superadmin','super-admin','school-admin']);
function currentSchoolAdminSubdomain(){
  const host=String((window.location&&window.location.hostname)||'').toLowerCase().replace(/\.$/,'');
  if(!host||host===SCHOOL_ADMIN_ROOT_DOMAIN||host==='www.'+SCHOOL_ADMIN_ROOT_DOMAIN||!host.endsWith('.'+SCHOOL_ADMIN_ROOT_DOMAIN))return '';
  const label=host.slice(0,-(SCHOOL_ADMIN_ROOT_DOMAIN.length+1));
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(label)&&!RESERVED_SCHOOL_ADMIN_SUBDOMAINS.has(label)?label:'';
}
async function requireMatchingSchoolAdminPortal(prof){
  const subdomain=currentSchoolAdminSubdomain();
  if(!subdomain)return null;
  const {data,error}=await sb.rpc('resolve_school_by_subdomain',{p_subdomain:subdomain});
  if(error)throw new Error('Could not verify this school portal. Please refresh and try again.');
  const school=Array.isArray(data)?data[0]:data;
  if(!school||!school.id)throw new Error('This school portal does not exist or has been suspended.');
  if(!prof||!prof.school_id||String(prof.school_id)!==String(school.id)){
    throw new Error('This account does not belong to the school portal you opened.');
  }
  return school;
}
// Always attach a FRESH user token to privileged Edge Function calls, otherwise an
// expired session makes the client send the publishable key and the function 401s.
async function freshToken(){
  let {data:s}=await sb.auth.getSession();
  let tok=s&&s.session&&s.session.access_token;
  const exp=s&&s.session&&s.session.expires_at;
  if(!tok||(exp&&exp*1000<Date.now()+10000)){
    try{ const r=await sb.auth.refreshSession(); tok=(r.data&&r.data.session&&r.data.session.access_token)||tok; }catch(e){}
  }
  return tok;
}
async function invokeFn(name,body){
  const tok=await freshToken();
  if(!tok) return {data:null,error:{message:'Your session expired — please sign in again.'}};
  return await sb.functions.invoke(name,{body,headers:{Authorization:'Bearer '+tok}});
}
async function invokeFnDetailed(name,body){
  const tok=await freshToken();
  if(!tok) return {data:null,error:{message:'Your session expired - please sign in again.'}};
  try{
    const res=await fetch(SB_URL+'/functions/v1/'+name,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey':SB_KEY,
        'Authorization':'Bearer '+tok
      },
      body:JSON.stringify(body||{})
    });
    const raw=await res.text();
    let data=null;
    try{ data=raw?JSON.parse(raw):null; }catch(e){ data=raw?{message:raw}:null; }
    if(res.ok) return {data,error:null};
    const msg=(data&&((typeof data.message==='string'&&data.message)||(typeof data.error==='string'&&data.error)))||('Edge Function returned HTTP '+res.status);
    return {data,error:{message:msg,status:res.status}};
  }catch(e){
    return {data:null,error:{message:(e&&e.message)||'Could not reach the Edge Function.'}};
  }
}
(function(){var b=document.getElementById('envBadge');if(!b)return;var prod=SB_URL.indexOf('datxaylostmyroleisdl')>-1;b.textContent=prod?'PRODUCTION':'DEV / DEMO';b.className='env-badge'+(prod?'':' dev');})();
var SB_SCHOOL=null, SB_CFG=null, SB_STUDENT_SUMMARY={}, SB_ADMIN_NAME='Admin', SB_PERMS=null, SB_UID=null, SB_HOUSE=null, READONLY=false;
let dashboardSummaryLoading=false;
async function refreshDashboardSummary(force){
  if(dashboardSummaryLoading||!SB_SCHOOL||!SB_SCHOOL.id)return;
  dashboardSummaryLoading=true;
  try{
    const result=await invokeFnDetailed('admin-school-summary',{school_id:SB_SCHOOL.id,refresh:force===true});
    if(!result.error&&result.data&&result.data.ok!==false&&result.data.summary){
      SB_STUDENT_SUMMARY=result.data.summary;
      if(Number.isFinite(Number(SB_STUDENT_SUMMARY.placed))) placementTotalCount=Math.max(Number(SB_STUDENT_SUMMARY.placed),0);
      renderStats();renderRecent();renderProg();renderHouses();renderClasses();
    }
  }finally{
    dashboardSummaryLoading=false;
  }
}
async function loadAdminSchoolStructure(schoolId){
  let result=await invokeFnDetailed('admin-school-structure',{school_id:schoolId});
  if(!result.error&&result.data&&result.data.ok!==false)return result;
  const [programmesResult,housesResult,classroomsResult]=await Promise.all([
    sb.from('programmes').select('id,code,name,subjects,capacity').eq('school_id',schoolId).order('code').limit(5000),
    sb.from('houses').select('id,name,color,motto,capacity,priority,gender,residential_type').eq('school_id',schoolId).order('name').limit(5000),
    sb.from('classrooms').select('id,name,code,capacity,subjects,programme_id').eq('school_id',schoolId).order('name').limit(5000)
  ]);
  const fallbackError=programmesResult.error||housesResult.error||classroomsResult.error;
  if(fallbackError)return {data:null,error:{message:'Could not load programme, class and house data: '+fallbackError.message}};
  return {data:{ok:true,programmes:programmesResult.data||[],houses:housesResult.data||[],classrooms:classroomsResult.data||[]},error:null};
}
// Capability catalogue (key -> friendly label)
const CAPS=[
  ['students','Admissions & students'],
  ['placement','Placement list import'],
  ['structure','Programmes, houses & classes'],
  ['finance','Financials & payments'],
  ['sms','SMS messaging'],
  ['reports','Reports & exports'],
  ['templates','Document templates'],
  ['setup','School setup'],
  ['portal','Student portal setup'],
  ['utilities','Utilities'],
  ['users','Manage users & privileges']
];
const STUDENT_SUBCAPS=[
  ['students_house_view','Admissions -> View student house'],
  ['verify_students','Admissions -> Verify students'],
  ['view_verified_students','Admissions -> View verified students'],
  ['export_verified_students','Admissions -> Export verified students'],
  ['print_verification_slip','Admissions -> Print verification slip'],
  ['reverse_student_verification','Admissions -> Reverse student verification']
];
const ALL_CAPS=CAPS.concat(STUDENT_SUBCAPS);
const CAP_LABEL=Object.fromEntries(ALL_CAPS);
// nav data-view -> required capability (null/undefined => always allowed, e.g. dashboard)
const VIEW_CAP={dashboard:null, setup:'setup', portal:'portal',
  programmes:'structure', houses:'structure', classes:'structure',
  placement:'placement', students:'students','verify-students':'verify_students','verified-students':'view_verified_students','manage-students':'students','house-alloc':'students','class-alloc':'students',
  finance:'finance', sms:'sms','sms-settings':'sms', reports:'reports', templates:'templates', users:'users', utilities:'utilities'};
function isOwner(){ return SB_PERMS==null; }                 // NULL permissions = full access
function isCoAdmin(){ return !!(SB_PERMS&&SB_PERMS.co_admin); }
function hasWriteAccess(){ return isOwner() || isCoAdmin(); }
function can(cap){ if(!cap) return true; if(isOwner()) return true; if(isCoAdmin()) return cap!=='users'; return !!(SB_PERMS&&SB_PERMS[cap]); }
function canViewStudentHouse(){ return hasWriteAccess() || !!(SB_PERMS&&(SB_PERMS.students_house_view||SB_PERMS.student_house_view)); }
function roGuard(){ if(READONLY){ toast('Your access is read-only'); return true; } return false; }
function firstAllowedView(){ if(can('students'))return 'dashboard'; const order=['dashboard','students','verify-students','verified-students','placement','programmes','finance','sms','sms-settings','reports','templates','setup','portal','utilities','users']; for(const v of order){ if(can(VIEW_CAP[v])) return v; } return 'dashboard'; }
function buildNavSelect(){
  const sel=document.getElementById('navSelect'); if(!sel)return;
  let html=''; let curGroup=null;
  document.querySelectorAll('#nav > .nav-item[data-view], #nav > .nav-group').forEach(node=>{
    if(node.classList.contains('nav-item')){
      if(node.style.display==='none')return;
      html+=`<option value="${node.dataset.view}">${node.textContent.trim()}</option>`;
    } else {
      const label=(node.querySelector('.nav-label')||{}).textContent||'';
      let inner='';
      node.querySelectorAll('.nav-item[data-view], .nav-sub[data-view]').forEach(b=>{
        if(b.style.display==='none')return;
        inner+=`<option value="${b.dataset.view}">${b.textContent.trim()}</option>`;
      });
      if(inner) html+=`<optgroup label="${label}">${inner}</optgroup>`;
    }
  });
  sel.innerHTML=html;
}
function applyPermissions(){
  document.querySelectorAll('.nav-item[data-view],.nav-sub[data-view]').forEach(n=>{ const cap=VIEW_CAP[n.dataset.view]; n.style.display=can(cap)?'':'none'; });
  const ap=document.getElementById('admParent'); if(ap) ap.style.display=(can('students')||can('verify_students')||can('view_verified_students'))?'':'none';
  const stuHouseHead=document.getElementById('stuHouseHead'); if(stuHouseHead) stuHouseHead.style.display=canViewStudentHouse()?'':'none';
  buildNavSelect();
  // School users are read-only. Owner and co-admin accounts can write.
  READONLY=!hasWriteAccess();
  if(READONLY){
    document.body.classList.add('ro');
    const ab=$('admBadge'); if(ab){ab.style.pointerEvents='none';ab.style.cursor='default';}
    const qt=$('qaToggle'); if(qt&&qt.closest('button')) qt.closest('button').style.display='none';
    // read-only indicator in the top bar
    const tb=document.querySelector('.topbar');
    if(tb&&!document.getElementById('roPill')){ const s=document.createElement('span'); s.id='roPill'; s.textContent='Read-only'; s.style.cssText='margin-left:auto;font-size:11px;font-weight:700;letter-spacing:.4px;color:#fff;background:#7a6a3a;padding:3px 10px;border-radius:999px'; tb.appendChild(s); }
  } else { document.body.classList.remove('ro'); }
}
var pMap={},hMap={},cMap={},pRev={},hRev={},cRev={}; // numeric -> uuid and uuid -> numeric
const val=id=>document.getElementById(id).value;
const fmtT=ts=>{ if(!ts) return '—'; const d=new Date(ts), n=new Date(); const days=Math.floor((n-d)/86400000);
  return days===0?('Today '+d.toTimeString().slice(0,5)):(days===1?'Yesterday':days+'d ago'); };
const SCHOOL_PROFILE_CACHE_KEY='qag_public_school_profile_cache';
function firstText(){
  for(let i=0;i<arguments.length;i++){
    const value=arguments[i];
    if(value!==undefined&&value!==null&&String(value).trim()!=='') return String(value).trim();
  }
  return '';
}
function normalizeSenderId(value){
  return String(value||'').toUpperCase().replace(/[^A-Z0-9 ]/g,'').replace(/\s+/g,' ').trim().slice(0,11);
}
function schoolSenderId(){
  return normalizeSenderId((SB_SCHOOL&&((SB_SCHOOL.school_code)||(SB_SCHOOL.code)))||'');
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
function writeSchoolProfileCache(next){
  try{ localStorage.setItem(SCHOOL_PROFILE_CACHE_KEY,JSON.stringify(next||{})); }catch(e){}
}
function cachePublicSchoolProfile(extra){
  if(!SB_SCHOOL||!SB_SCHOOL.id) return;
  const cache=readSchoolProfileCache();
  const featureFlags={
    allow_passport_photo:SB_CFG&&SB_CFG.allow_passport_photo,
    allow_house_selection:SB_CFG&&SB_CFG.allow_house_selection,
    allow_class_selection:SB_CFG&&SB_CFG.allow_class_selection,
    force_enrolment_upload:SB_CFG&&SB_CFG.force_enrolment_upload
  };
  cache[String(SB_SCHOOL.id)]=Object.assign({},cache[String(SB_SCHOOL.id)]||{},{
    id:SB_SCHOOL.id,
    name:SB_SCHOOL.name||'',
    school_name:SB_SCHOOL.name||'',
    code:SB_SCHOOL.code||'',
    school_code:SB_SCHOOL.school_code||SB_SCHOOL.code||'',
    phone:SB_SCHOOL.phone||'',
    email:SB_SCHOOL.email||'',
    helpdesk:SB_SCHOOL.helpdesk||'',
    helpdesk_line:SB_SCHOOL.helpdesk||'',
    crest_url:SB_SCHOOL.crest_url||'',
    service_charge:SB_CFG&&SB_CFG.service_charge,
    admission_status:SB_CFG&&SB_CFG.admission_status,
    accept_online_payment:SB_CFG&&SB_CFG.accept_online_payment,
    announcement:SB_CFG&&SB_CFG.announcement
  },featureFlags,extra||{});
  writeSchoolProfileCache(cache);
}
function ensureSetupRuntimeFields(){
  const setup=document.getElementById('view-setup');
  if(!setup) return;
  const serviceCharge=setup.querySelector('input[id="s_charge"]')||setup.querySelector('[data-tab="1"] fieldset:nth-of-type(2) input[type="number"]');
  if(serviceCharge&&!serviceCharge.id) serviceCharge.id='s_charge';
}
function cfgBool(key,defaultValue){
  if(!SB_CFG||typeof SB_CFG[key]==='undefined'||SB_CFG[key]===null) return !!defaultValue;
  return SB_CFG[key]===true||SB_CFG[key]==='true'||SB_CFG[key]===1||SB_CFG[key]==='1';
}
function setChecked(id,value){ const el=document.getElementById(id); if(el) el.checked=!!value; }
function fillStudentFeatureToggles(){
  setChecked('s_allow_passport_photo',cfgBool('allow_passport_photo',false));
  setChecked('s_allow_house_selection',cfgBool('allow_house_selection',false));
  setChecked('s_allow_class_selection',cfgBool('allow_class_selection',true));
  setChecked('s_force_enrolment_upload',cfgBool('force_enrolment_upload',true));
}
function fillPortalSetupForm(){
  const cfg=SB_CFG||{};
  const setValue=function(id,value){const el=$(id);if(el)el.value=value==null?'':String(value);};
  setChecked('portal_show_records',cfgBool('show_personal_records',true));
  setChecked('portal_show_undertaking',cfgBool('show_undertaking',true));
  setChecked('portal_show_programme',cfgBool('show_programme_selection',true));
  setValue('portal_records_caption',cfg.personal_records_caption||'PERSONAL RECORDS FORM');
  setValue('portal_undertaking_caption',cfg.undertaking_caption||'UNDERTAKING / MEDICAL FORM');
  setValue('portal_programme_caption',cfg.programme_selection_caption||'PROGRAMME / SUBJECT COMBINATION');
  renderDocLines();
}
function studentFeaturePatch(){
  return {
    allow_passport_photo:!!(document.getElementById('s_allow_passport_photo')&&document.getElementById('s_allow_passport_photo').checked),
    allow_house_selection:!!(document.getElementById('s_allow_house_selection')&&document.getElementById('s_allow_house_selection').checked),
    allow_class_selection:!!(document.getElementById('s_allow_class_selection')&&document.getElementById('s_allow_class_selection').checked),
    force_enrolment_upload:!!(document.getElementById('s_force_enrolment_upload')&&document.getElementById('s_force_enrolment_upload').checked)
  };
}
function setStudentFeatureStatus(message,isError){
  const el=document.getElementById('s_feature_status');
  if(!el)return;
  el.textContent=message;
  el.style.color=isError?'#b42318':'var(--muted)';
}
let studentFeatureSaveTimer=null;
function queueStudentFeatureSave(){
  if(roGuard())return;
  clearTimeout(studentFeatureSaveTimer);
  setStudentFeatureStatus('Saving changes...');
  studentFeatureSaveTimer=setTimeout(function(){ persistStudentFeatureSettings({showToast:true}); },350);
}
async function persistStudentFeatureSettings(options){
  if(roGuard())return false;
  if(!SB_SCHOOL||!SB_SCHOOL.id){setStudentFeatureStatus('School not loaded.',true);return false;}
  clearTimeout(studentFeatureSaveTimer);
  const patch=studentFeaturePatch();
  setStudentFeatureStatus('Saving changes...');
  const result=await invokeFnDetailed('manage-school-settings',{action:'student_features',school_id:SB_SCHOOL.id,patch});
  const saved=result&&result.data&&result.data.config;
  if(result.error||!saved||result.data.ok===false){
    const message=(result&&result.data&&result.data.message)||(result&&result.error&&result.error.message)||'No school configuration row was updated.';
    setStudentFeatureStatus('Could not save: '+message,true);
    toast('Could not save student features: '+message);
    fillStudentFeatureToggles();
    return false;
  }
  if(SB_CFG)Object.assign(SB_CFG,saved);
  fillStudentFeatureToggles();
  cachePublicSchoolProfile(saved);
  setStudentFeatureStatus('Saved. New student logins will use these settings.');
  if(options&&options.showToast)toast('Student features saved');
  return true;
}
function fillSchoolProfileForm(){
  if(!SB_SCHOOL) return;
  const setValue=function(id,value){ const el=document.getElementById(id); if(el) el.value=value||''; };
  setValue('sp_name',SB_SCHOOL.name||'');
  setValue('sp_address',SB_SCHOOL.address||'');
  setValue('sp_phone',SB_SCHOOL.phone||'');
  setValue('sp_email',SB_SCHOOL.email||'');
  setValue('sp_school_code',SB_SCHOOL.school_code||SB_SCHOOL.code||'');
  setValue('sp_headmaster',SB_SCHOOL.headmaster_name||'');
  setValue('sp_headmaster_title',SB_SCHOOL.headmaster_title||'Headmaster');
  setValue('sp_helpdesk',SB_SCHOOL.helpdesk||SB_SCHOOL.phone||'');
  fillStudentFeatureToggles();
}
async function fetchSchoolSmsHistory(schoolId){
  return await invokeFnDetailed('admin-sms-history',{school_id:schoolId});
}
function updateSmsSettingsPreview(){
  const preview=document.getElementById('smsset_test_preview');
  if(preview) preview.textContent='This is a test SMS from '+(SB_SCHOOL&&SB_SCHOOL.name?SB_SCHOOL.name:'your school')+'.';
}
function fillSmsSettingsForm(){
  ensureSetupRuntimeFields();
  const sender=schoolSenderId();
  ['smsSender','smsset_sender'].forEach(function(id){
    const el=document.getElementById(id);
    if(el) el.value=sender||'';
  });
  const enabled=document.getElementById('smsset_enabled');
  if(enabled) enabled.value=(SB_SMS_SETTINGS&&SB_SMS_SETTINGS.sms_enabled===false)?'no':'yes';
  const template=document.getElementById('smsset_template');
  if(template) template.value=(SB_SMS_SETTINGS&&SB_SMS_SETTINGS.submission_message)||DEFAULT_SUBMISSION_SMS_TEMPLATE;
  updateSmsSettingsPreview();
  const setupNote=document.querySelector('#view-setup [data-tab="1"] fieldset:last-of-type .panel');
  if(setupNote){
    setupNote.style.background='rgba(15,42,31,.5)';
    setupNote.style.border='1px solid rgba(52,211,153,.18)';
    setupNote.innerHTML='<div class="portal-emerald-note-title">Manage Sender ID, template, and SMS enablement under SMS Settings.</div><div class="portal-emerald-note-copy">Bulk SMS, automatic submission SMS, and test messages all use the school\'s registered Sender ID.</div>';
  }
}
function loadDefaultSmsTemplate(){
  const el=document.getElementById('smsset_template');
  if(el) el.value=DEFAULT_SUBMISSION_SMS_TEMPLATE;
}

/* ---- AUTH GATE ---- */
let schoolAdminLoginPending=false;
let schoolAdminRecoveryPending=false;
let schoolAdminRecoveryMode=isSchoolAdminRecoveryUrl();
function isSchoolAdminRecoveryUrl(){
  try{
    const query=new URLSearchParams(window.location.search||'');
    const hash=new URLSearchParams(String(window.location.hash||'').replace(/^#/,''));
    return query.get('type')==='recovery'||hash.get('type')==='recovery'||query.has('code');
  }catch(e){ return false; }
}
function schoolAdminRecoveryRedirectUrl(){
  return 'https://www.quickadmissiongh.com';
}
function cleanSchoolAdminRecoveryUrl(){
  try{
    const url=new URL(window.location.href);
    url.search='';
    url.hash='';
    window.history.replaceState({},document.title,url.pathname+url.search+url.hash);
  }catch(e){}
}
function showSchoolAdminAuthView(view){
  const views={login:'adminLoginView',request:'adminRecoveryRequestView',update:'adminRecoveryUpdateView'};
  Object.keys(views).forEach(function(key){
    const el=document.getElementById(views[key]);
    if(el)el.hidden=key!==view;
  });
  const status=document.getElementById('ag_session_status_text');
  if(status)status.textContent=view==='request'?'Password recovery':view==='update'?'Secure password reset':'Secure session ready';
}
function setSchoolAdminRecoveryMessage(id,message,isError){
  const el=document.getElementById(id);
  if(!el)return;
  el.textContent=message||'';
  el.classList.toggle('is-error',!!isError);
  el.style.display=message?'block':'none';
}
function setSchoolAdminLoginNotice(message,isSuccess){
  const el=document.getElementById('ag_err');
  if(!el)return;
  el.textContent=message||'';
  el.classList.toggle('is-success',!!isSuccess);
  el.style.display=message?'block':'none';
}
function openSchoolAdminRecoveryRequest(){
  const email=document.getElementById('ag_email');
  const recoveryEmail=document.getElementById('ag_recovery_email');
  if(recoveryEmail&&email)recoveryEmail.value=email.value.trim();
  setSchoolAdminRecoveryMessage('ag_recovery_msg','',false);
  showSchoolAdminAuthView('request');
  if(recoveryEmail)recoveryEmail.focus();
}
async function requestSchoolAdminPasswordReset(){
  const input=document.getElementById('ag_recovery_email');
  const btn=document.getElementById('ag_recovery_btn');
  if(schoolAdminRecoveryPending||!input||!btn)return;
  const email=input.value.trim();
  if(!email||!input.checkValidity()){
    setSchoolAdminRecoveryMessage('ag_recovery_msg','Enter a valid email address.',true);
    input.focus();
    return;
  }
  schoolAdminRecoveryPending=true;
  btn.disabled=true;
  btn.textContent='SENDING LINK...';
  setSchoolAdminRecoveryMessage('ag_recovery_msg','',false);
  try{
    const result=await sb.auth.resetPasswordForEmail(email,{redirectTo:schoolAdminRecoveryRedirectUrl()});
    if(result.error)throw result.error;
    setSchoolAdminRecoveryMessage('ag_recovery_msg','If this email belongs to an admin account, a reset link has been sent. Check the inbox and spam folder.',false);
  }catch(e){
    setSchoolAdminRecoveryMessage('ag_recovery_msg',(e&&e.message)||'Could not send the reset link. Please try again.',true);
  }finally{
    schoolAdminRecoveryPending=false;
    btn.disabled=false;
    btn.textContent='SEND RESET LINK';
  }
}
async function updateSchoolAdminPassword(){
  const password=document.getElementById('ag_new_pass');
  const confirmPassword=document.getElementById('ag_confirm_pass');
  const btn=document.getElementById('ag_reset_btn');
  if(schoolAdminRecoveryPending||!password||!confirmPassword||!btn)return;
  if(password.value.length<10||!/[a-z]/.test(password.value)||!/[A-Z]/.test(password.value)||!/[0-9]/.test(password.value)||!(/[^A-Za-z0-9]/.test(password.value))){
    setSchoolAdminRecoveryMessage('ag_reset_msg','Use at least 10 characters with upper and lowercase letters, a number and a symbol.',true);
    password.focus();
    return;
  }
  if(password.value!==confirmPassword.value){
    setSchoolAdminRecoveryMessage('ag_reset_msg','The two passwords do not match.',true);
    confirmPassword.focus();
    return;
  }
  schoolAdminRecoveryPending=true;
  btn.disabled=true;
  btn.textContent='UPDATING PASSWORD...';
  setSchoolAdminRecoveryMessage('ag_reset_msg','',false);
  try{
    const sessionResult=await sb.auth.getSession();
    if(sessionResult.error||!sessionResult.data||!sessionResult.data.session)throw new Error('This reset link is invalid or has expired. Request a new link.');
    const result=await sb.auth.updateUser({password:password.value});
    if(result.error)throw result.error;
    setSchoolAdminTabSessionActive(false);
    try{await sb.auth.signOut();}catch(ignore){}
    schoolAdminRecoveryMode=false;
    cleanSchoolAdminRecoveryUrl();
    password.value='';
    confirmPassword.value='';
    showSchoolAdminAuthView('login');
    setSchoolAdminLoginNotice('Password updated successfully. Sign in with your new password.',true);
    const email=document.getElementById('ag_email');
    if(email)email.focus();
  }catch(e){
    setSchoolAdminRecoveryMessage('ag_reset_msg',(e&&e.message)||'Could not update the password. Request a new reset link.',true);
  }finally{
    schoolAdminRecoveryPending=false;
    btn.disabled=false;
    btn.textContent='UPDATE PASSWORD';
  }
}
async function cancelSchoolAdminRecovery(){
  setSchoolAdminTabSessionActive(false);
  try{await sb.auth.signOut();}catch(e){}
  schoolAdminRecoveryMode=false;
  cleanSchoolAdminRecoveryUrl();
  showSchoolAdminAuthView('login');
  setSchoolAdminLoginNotice('',false);
}
(function buildGate(){
  document.body.classList.add('auth-gate-visible');
  document.querySelector('.app').style.display='none';
  const ov=document.getElementById('authGate');
  if(!ov) return;
  const setGateReady=function(){
    const gate=document.getElementById('authGate');
    if(!gate) return;
    document.body.classList.remove('auth-booting');
    gate.classList.remove('is-checking');
    gate.classList.add('is-ready');
  };
  document.getElementById('schoolAdminLoginForm').addEventListener('submit',function(event){
    event.preventDefault();
    adminLogin();
  });
  document.getElementById('ag_forgot_open').addEventListener('click',openSchoolAdminRecoveryRequest);
  document.getElementById('ag_recovery_back').addEventListener('click',function(){showSchoolAdminAuthView('login');});
  document.getElementById('ag_reset_cancel').addEventListener('click',cancelSchoolAdminRecovery);
  document.getElementById('adminRecoveryRequestForm').addEventListener('submit',function(event){event.preventDefault();requestSchoolAdminPasswordReset();});
  document.getElementById('adminPasswordResetForm').addEventListener('submit',function(event){event.preventDefault();updateSchoolAdminPassword();});
  sb.auth.onAuthStateChange(function(event){
    if(event!=='PASSWORD_RECOVERY')return;
    schoolAdminRecoveryMode=true;
    setGateReady();
    showSchoolAdminAuthView('update');
    setSchoolAdminRecoveryMessage('ag_reset_msg','Reset link verified. Enter your new password.',false);
  });
  const bootPromise=schoolAdminRecoveryMode
    ?sb.auth.getSession().then(function(result){
      showSchoolAdminAuthView('update');
      if(result.error||!result.data||!result.data.session){
        setSchoolAdminRecoveryMessage('ag_reset_msg','This reset link is invalid or has expired. Cancel and request a new link.',true);
      }else{
        setSchoolAdminRecoveryMessage('ag_reset_msg','Reset link verified. Enter your new password.',false);
      }
    })
    :bootSession();
  bootPromise.finally(function(){
    setGateReady();
  });
})();

async function enterAdmin(prof,uid){
  await requireMatchingSchoolAdminPortal(prof);
  setSchoolAdminTabSessionActive(true);
  SB_UID=uid; SB_PERMS=(prof.permissions===undefined?null:prof.permissions); SB_HOUSE=(SB_PERMS&&SB_PERMS.house)||null;
  await loadSchoolData(prof);
  const g=document.getElementById('authGate'); if(g)g.remove();
  document.body.classList.remove('auth-booting');
  document.body.classList.remove('auth-gate-visible');
  document.querySelector('.app').style.display='grid';
  applyPermissions();
  go(firstAllowedView());
}
async function bootSession(){
  try{
    if(schoolAdminRecoveryMode)return;
    if(!schoolAdminTabSessionActive()) return;
    const {data}=await sb.auth.getSession();
    const session=data&&data.session;
    if(!session||!session.user){ setSchoolAdminTabSessionActive(false); return; }
    const {data:prof}=await sb.from('profiles').select('full_name,role,school_id,permissions').eq('id',session.user.id).single();
    if(!prof||(prof.role!=='school_admin'&&prof.role!=='super_admin')){ setSchoolAdminTabSessionActive(false); return; }
    await enterAdmin(prof,session.user.id);
  }catch(e){
    setSchoolAdminTabSessionActive(false);
    try{await sb.auth.signOut();}catch(ignore){}
    const err=document.getElementById('ag_err');
    if(err){err.textContent=(e&&e.message)||'Could not verify this school portal.';err.style.display='block';}
  }
}
async function adminLogin(){
  const btn=document.getElementById('ag_btn'), err=document.getElementById('ag_err');
  const gate=document.getElementById('authGate');
  const status=document.getElementById('ag_session_status_text');
  if(schoolAdminLoginPending||!btn||!err||!gate)return;
  const email=val('ag_email').trim();
  const password=val('ag_pass');
  if(!email||!password){
    err.textContent='Enter both email and password.';
    err.style.display='block';
    return;
  }
  schoolAdminLoginPending=true;
  btn.textContent='SIGNING IN...';
  if(status)status.textContent='Signing in securely...';
  btn.disabled=true;
  btn.setAttribute('aria-busy','true');
  err.style.display='none';
  try{
    await new Promise(function(resolve){requestAnimationFrame(resolve);});
    const {data,error}=await sb.auth.signInWithPassword({email,password});
    if(error){
      err.textContent=error.message||'Could not sign in.';
      err.style.display='block';
      return;
    }
    btn.textContent='VERIFYING ACCOUNT...';
    if(status)status.textContent='Verifying your account...';
    const {data:prof,error:profError}=await sb.from('profiles').select('full_name,role,school_id,permissions').eq('id',data.user.id).single();
    if(profError){
      err.textContent=profError.message||'Could not load account profile.';
      err.style.display='block';
      try{await sb.auth.signOut();}catch(ignore){}
      return;
    }
    if(!prof||(prof.role!=='school_admin'&&prof.role!=='super_admin')){
      err.textContent='This account has no school-admin access.';
      err.style.display='block';
      await sb.auth.signOut();
      return;
    }
    try{
      btn.textContent='LOADING DASHBOARD...';
      if(status)status.textContent='Loading your school dashboard...';
      await enterAdmin(prof,data.user.id);
      return;
    }catch(e){
      err.textContent=(e&&e.message)||'Could not load school data.';
      err.style.display='block';
      try{await sb.auth.signOut();}catch(ignore){}
      return;
    }
  }catch(e){
    err.textContent=(e&&e.message)||'Sign-in failed. Check your internet connection and try again.';
    err.style.display='block';
    return;
  }finally{
    if(document.getElementById('authGate')){
      schoolAdminLoginPending=false;
      if(status)status.textContent='Secure session ready';
    }
    if(document.getElementById('ag_btn')){
      btn.textContent='LOGIN →';
      btn.disabled=false;
      btn.removeAttribute('aria-busy');
    }
  }
}

async function loadSchoolData(prof){
  // Resolve THIS admin's school so we never read another school's data.
  // IMPORTANT: never fall back to an arbitrary school — that would show the wrong
  // school's data to an account that isn't linked to one (e.g. a super admin).
  let myId=(prof&&prof.school_id)||null;
  STUDENT_CACHE_STATE={loaded:false,loading:false};
  VERIFICATION_COUNTS.loaded=false; VERIFICATION_COUNTS.submitted=0; VERIFICATION_COUNTS.pending=0; VERIFICATION_COUNTS.actionable=0; VERIFICATION_COUNTS.verified=0;
  if(!myId){
    SB_SCHOOL=null; SB_CFG={};
    const nm=$('brandName'); if(nm) nm.textContent='No school linked';
    const bm=$('brandCrest'); if(bm){bm.removeAttribute('src');bm.style.display='none';}
    const dl=$('brandDefaultLogo'); if(dl) dl.style.display='block';
    const lt=$('brandLogoText'); if(lt) lt.style.display='none';
    toast(prof&&prof.role==='super_admin'
      ? 'Super admins manage schools from the Super Admin portal.'
      : 'This account is not linked to a school — contact your administrator.');
    return;
  }
  const [sch,cfg,structure,stu,plc,pay,sms,log,smsCfg,claims]=await Promise.all([
    sb.from('schools').select('id,name,code,school_code,address,phone,email,headmaster_name,headmaster_title,helpdesk,crest_url,theme_color').eq('id',myId),
    sb.from('school_config').select('academic_year,admission_year,admission_status,reopening_date,reopening_time,service_charge,accept_online_payment,announcement,helpdesk_line,sms_balance,prospectus_url,undertaking_url,subjects_url,letter_template,records_template,req_doc_line1,req_doc_line2,req_doc_line3,req_doc_line4,req_doc_line5,show_personal_records,personal_records_caption,show_undertaking,undertaking_caption,show_programme_selection,programme_selection_caption,allow_passport_photo,allow_house_selection,allow_class_selection,force_enrolment_upload').eq('school_id',myId),
    loadAdminSchoolStructure(myId),
    Promise.resolve({data:[],error:null}),
    sb.from('placement_list').select('id',{count:'exact',head:true}).eq('school_id',myId),
    Promise.resolve({data:[],error:null}),
    Promise.resolve({data:[],error:null}),
    Promise.resolve({data:[],error:null}),
    sb.from('school_sms_templates').select('school_id,submission_message,sms_enabled').eq('school_id',myId),
    sb.from('finance_claims').select('claim_number,students_claimed,created_at,academic_year').eq('school_id',myId),
  ]);
  const setupLoadError=sch.error||cfg.error;
  if(setupLoadError){
    const message='Could not load the school admission configuration: '+(setupLoadError.message||'unknown error');
    toast(message);
    throw new Error(message);
  }
  if(!(cfg.data||[]).length){
    const message='The school admission configuration is missing.';
    toast(message);
    throw new Error(message);
  }
  if(!structure||structure.error||!structure.data||structure.data.ok===false){
    const structureMessage=(structure&&structure.error&&structure.error.message)||(structure&&structure.data&&structure.data.message)||'Could not load programme, class and house data.';
    toast(structureMessage);
    throw new Error(structureMessage);
  }
  const structurePayload=structure.data;
  const progs={data:Array.isArray(structurePayload.programmes)?structurePayload.programmes:[],error:structure&&structure.error};
  const hs={data:Array.isArray(structurePayload.houses)?structurePayload.houses:[],error:structure&&structure.error};
  const cls={data:Array.isArray(structurePayload.classrooms)?structurePayload.classrooms:[],error:structure&&structure.error};
  SB_SCHOOL=(sch.data||[])[0]; SB_CFG=(cfg.data||[])[0]||{};
  if(SB_CFG&&!SB_CFG.helpdesk&&SB_CFG.helpdesk_line) SB_CFG.helpdesk=SB_CFG.helpdesk_line;
  placementTotalCount=Number(plc.count)||0; PLACEMENT_STATE={loaded:false,loading:false,page:1,pageSize:PLACEMENT_PAGE_SIZE,total:0,totalPages:1};
  const summaryResult=await invokeFnDetailed('admin-school-summary',{school_id:myId,refresh:true});
  SB_STUDENT_SUMMARY=(summaryResult.data&&summaryResult.data.summary)||{};
  if(!claims.error&&Array.isArray(claims.data)){
    const cfgYear=financeAcademicYearValue(SB_CFG&&SB_CFG.academic_year);
    const claimRows=(claims.data||[]).filter(function(row){ return financeClaimAcademicYearValue(row.academic_year)===cfgYear; });
    const settled=claimRows.reduce(function(total,row){ return total+(parseInt(row.students_claimed,10)||0); },0);
    const claimCount=claimRows.reduce(function(max,row){ return Math.max(max,parseInt(row.claim_number,10)||0); },0);
    const settledAt=claimRows.reduce(function(latest,row){ const at=row.created_at||''; return at>latest?at:latest; },'');
    Object.assign(SB_CFG,{finance_settled_students:settled,finance_claim_count:claimCount,finance_settled_at:settledAt||null});
  } else {
    Object.assign(SB_CFG,{finance_settled_students:0,finance_claim_count:0,finance_settled_at:null});
  }
  SB_SMS_SETTINGS=(smsCfg.data||[])[0]||{submission_message:DEFAULT_SUBMISSION_SMS_TEMPLATE,sms_enabled:true};
  if(SB_SCHOOL){ const nm=$('brandName'); if(nm) nm.textContent=SB_SCHOOL.name||'School Name'; }
  if(SB_SCHOOL&&SB_SCHOOL.crest_url){ SCHOOL_CREST=SB_SCHOOL.crest_url; const bm=$('brandCrest'); if(bm){bm.src=SCHOOL_CREST;bm.style.display='block';} const dl=$('brandDefaultLogo'); if(dl) dl.style.display='none'; const lt=$('brandLogoText'); if(lt) lt.style.display='none'; const pv=$('s_crest_prev'); if(pv){pv.src=SCHOOL_CREST;pv.style.display='block';} }
  else { const bm=$('brandCrest'); if(bm){bm.removeAttribute('src');bm.style.display='none';} const dl=$('brandDefaultLogo'); if(dl) dl.style.display='block'; const lt=$('brandLogoText'); if(lt) lt.style.display='none'; }
  // House-scoped user: only see that house and its students
  if(SB_HOUSE){ stu.data=(stu.data||[]).filter(s=>s.house_id===SB_HOUSE); hs.data=(hs.data||[]).filter(h=>h.id===SB_HOUSE); }

  const progNameByUuid={},classNameByUuid={},houseNameByUuid={}; pMap={};hMap={};cMap={};pRev={};hRev={};cRev={};
  const plcByIdx={}; (plc.data||[]).forEach(p=>plcByIdx[p.index_number]=p);
  const submittedRawStudents=(stu.data||[]).filter(hasSubmittedPersonalRecord);
  function rawStudentMatchesProgramme(s,p){
    if(!s||!p) return false;
    if(s.programme_id&&String(s.programme_id)===String(p.id)) return true;
    const rec=s.records||{};
    const pl=plcByIdx[s.bece_index]||{};
    const targets=[rec.programme,rec.programme_name,s.programme,s.programme_name,pl.programme].map(programmeMatchText).filter(Boolean);
    const progName=programmeMatchText(p.name), progCode=programmeMatchText(p.code);
    return targets.some(function(text){ return text===progName || text===progCode; });
  }
  const programmeCounts=SB_STUDENT_SUMMARY.programmes||{}, houseCounts=SB_STUDENT_SUMMARY.houses||{}, classCounts=SB_STUDENT_SUMMARY.classes||{};
  programmes=(progs.data||[]).map((p,i)=>{const id=i+1;pMap[id]=p.id;pRev[p.id]=id;progNameByUuid[p.id]=p.name||'';return {id,_id:p.id,code:p.code,name:p.name,subjects:p.subjects||'',cap:p.capacity,enr:Number(programmeCounts[p.id]||0)};});
  houses=(hs.data||[]).map((h,i)=>{const id=i+1;hMap[id]=h.id;hRev[h.id]=id;houseNameByUuid[h.id]=h.name||'';return {id,_id:h.id,name:h.name,color:h.color,motto:h.motto,cap:h.capacity,priority:h.priority||'',gender:h.gender||'',rtype:h.residential_type||'',occ:Number(houseCounts[h.id]||0)};});
  classes=(cls.data||[]).map((c,i)=>{const id=i+1;cMap[id]=c.id;cRev[c.id]=id;classNameByUuid[c.id]=c.name||'';return {id,_id:c.id,name:c.name,code:c.code,cap:c.capacity,subjects:c.subjects||'',progId:c.programme_id?pRev[c.programme_id]:'',occ:Number(classCounts[c.id]||0)};});
  students=(stu.data||[]).map((s,i)=>{ const pl=plcByIdx[s.bece_index]||{}; const rec=s.records||{}; const regAt=s.submitted_at||s.created_at||''; const dt=regAt?new Date(regAt):null; const sms=preferredStudentSms(s,pl);
    return {id:i+1,_id:s.id,index:s.bece_index,name:s.full_name||'(no name)',gender:s.gender||'M',
      progId:pRev[s.programme_id]||null,classId:cRev[s.class_id]||null,houseId:hRev[s.house_id]||null,className:classNameByUuid[s.class_id]||'',houseName:houseNameByUuid[s.house_id]||'',house:houseNameByUuid[s.house_id]||'',houseUuid:s.house_id||'',
      status:s.status,adm:s.permanent_admission_number||s.admission_no||'-',legacyAdm:s.admission_no||'',permAdm:s.permanent_admission_number||'',verificationStatus:s.verification_status||'pending',verifiedAt:s.verified_at||'',verifiedBy:s.verified_by||'',passportPhoto:(rec.passport_photo_url||s.passport_photo_url||''),reg:(regAt||'').slice(0,10),submittedAt:s.submitted_at||'',personalDone:!!s.personal_done,programmeDone:!!s.programme_done,undertakingDone:!!s.undertaking_done,
      time: dt?dt.toTimeString().slice(0,8):'-',
      sms: sms||'-',
      prog: cleanSmsText(progNameByUuid[s.programme_id])||cleanSmsText(pl.programme)||cleanSmsText(rec.programme)||'',
      enrol: rec.enrolment_code||pl.enrolment_code||'-',
      form: s.enrolment_form_url||null,
      dob: pl.dob||'', parent: rec.guardian||rec.father_name||rec.mother_name||s.parent_name||'-',
      res: pl.residential_status||'-', rec: rec,
      pay: s.payment_status||'unpaid', submitted: !!s.submitted_at, loggedIn: !!pl.logged_in};
  });
  const stuByIdx={}; (stu.data||[]).forEach(function(row){ if(row&&row.bece_index!=null) stuByIdx[String(row.bece_index)]=row; });
  students=students.map(function(row){
    const raw=stuByIdx[String(row.index)]||{};
    const rec=(raw&&raw.records)||row.rec||{};
    const regAt=raw.submitted_at||raw.created_at||'';
    const dt=regAt?new Date(regAt):null;
    const pl=plcByIdx[row.index]||{};
    const sms=preferredStudentSms(raw,pl);
    row.reg=(regAt||'').slice(0,10);
    row.time=dt?dt.toTimeString().slice(0,8):'-';
    row.sms=sms||'-';
    row.smsRaw=sms||'';
    row.prog=cleanSmsText(progNameByUuid[raw.programme_id])||row.prog||cleanSmsText(pl.programme)||cleanSmsText(rec.programme)||'';
    row.enrol=rec.enrolment_code||pl.enrolment_code||row.enrol||'-';
    row.parent=rec.guardian||rec.father_name||rec.mother_name||row.parent||'-';
    row.rec=rec;
    return row;
  });
  placement=(plc.data||[]).map(p=>({index:p.index_number,name:p.student_name,gender:p.gender||'',res:p.residential_status||'',prog:p.programme,agg:p.aggregate,jhs:p.jhs_attended||'',dob:p.dob||'',sms:p.sms_contact||'',code:p.enrolment_code,loggedIn:p.logged_in}));
  financePaymentsLoadError='';
  payments=[];
  FINANCE_PAYMENTS_STATE={loaded:false,loading:false,total:0};
  smsHistory=[]; smsDeliveredIndexes=new Set(); SMS_HISTORY_STATE={loaded:false,loading:false};
  activityLog=[]; ACTIVITY_LOG_STATE={loaded:false,loading:false};

  admissionOpen=admissionStatusIsOpen(SB_CFG.admission_status);
  smsBalance=SB_CFG.sms_balance||0;
  await populateYearSelect(SB_CFG.academic_year); syncAdmissionYearFromAcademicYear();
  { const rd=$('s_reopen_date'); if(rd) rd.value=SB_CFG.reopening_date||''; const rt=$('s_reopen_time'); if(rt) rt.value=SB_CFG.reopening_time||''; const ch=$('s_charge'); if(ch) ch.value=(SB_CFG.service_charge!=null?SB_CFG.service_charge:30); const online=$('s_accept_online_payment'); if(online) online.value=cfgBool('accept_online_payment',true)?'yes':'no'; const announcement=$('s_announcement'); if(announcement) announcement.value=SB_CFG.announcement||''; }
  showSchoolDocLink('prospectus',SB_CFG.prospectus_url); showSchoolDocLink('undertaking',SB_CFG.undertaking_url); showSchoolDocLink('subjects',SB_CFG.subjects_url);
  if(SB_CFG.req_doc_line1!==undefined) docLines=[SB_CFG.req_doc_line1,SB_CFG.req_doc_line2,SB_CFG.req_doc_line3,SB_CFG.req_doc_line4,SB_CFG.req_doc_line5].map(x=>x||'');
  fillSchoolProfileForm();
  fillPortalSetupForm();
  fillSmsSettingsForm();
  fillVerifiedFilterOptions();
  await loadVerificationCounts();
  cachePublicSchoolProfile();

  // header identity
  renderAdmissionStatusControls();
  if(prof){
    SB_ADMIN_NAME=prof.full_name||SB_ADMIN_NAME||'Admin';
    const nm=$('sbName'); if(nm) nm.textContent=SB_ADMIN_NAME;
    const rl=$('sbRole'); if(rl) rl.textContent=(prof.role==='super_admin'?'Super Admin':((prof.permissions&&prof.permissions.co_admin)?'School Co-admin':'School Admin'));
    const av=$('sbAvatar'); if(av){ const parts=String(SB_ADMIN_NAME).trim().split(/\s+/); const ini=((parts[0]||'')[0]||'')+((parts[parts.length-1]||'')[0]||''); av.textContent=(ini||'AD').toUpperCase(); }
  }
  fillSelects();
}

let sbStudentSyncChannel=null, sbStudentSyncChannelName='', sbStudentSyncReady=null;
function studentIndexListFromIds(ids){
  return (ids||[]).map(function(id){
    const s=students.find(function(row){ return row.id===id; });
    return s&&s.index;
  }).filter(Boolean);
}
async function ensureStudentSyncChannel(){
  if(!SB_SCHOOL||!SB_SCHOOL.id) return null;
  const name='school:'+SB_SCHOOL.id;
  if(sbStudentSyncChannel&&sbStudentSyncChannelName===name){
    if(sbStudentSyncReady) await sbStudentSyncReady;
    return sbStudentSyncChannel;
  }
  if(sbStudentSyncChannel){ try{sb.removeChannel(sbStudentSyncChannel);}catch(e){} }
  sbStudentSyncChannelName=name;
  sbStudentSyncChannel=sb.channel(name);
  sbStudentSyncReady=new Promise(function(resolve){
    let done=false;
    const finish=function(){ if(done) return; done=true; resolve(); };
    try{
      sbStudentSyncChannel.subscribe(function(status){
        if(status==='SUBSCRIBED'||status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED') finish();
      });
    }catch(e){ finish(); return; }
    setTimeout(finish,1200);
  });
  await sbStudentSyncReady;
  return sbStudentSyncChannel;
}
async function notifyStudentPortalRefresh(reason,details){
  if(!SB_SCHOOL||!SB_SCHOOL.id) return false;
  const payload=Object.assign({reason:reason||'school-update',school_id:SB_SCHOOL.id,scope:'school',ts:Date.now()},details||{});
  if(Array.isArray(payload.indexes)) payload.indexes=payload.indexes.filter(Boolean).map(String);
  if(payload.index!=null) payload.index=String(payload.index);
  try{
    const ch=await ensureStudentSyncChannel();
    if(!ch) return false;
    const res=await ch.send({type:'broadcast',event:'student_portal_refresh',payload});
    return !(res&&res.error);
  }catch(e){
    return false;
  }
}

/* ---- PERSISTING ACTION OVERRIDES ---- */
toggleAdmission=async function(){
  if(roGuard())return;
  if(!SB_SCHOOL||!SB_SCHOOL.id){toast('School not loaded');return;}
  if(admissionStatusSaving)return;
  const nextOpen=!admissionOpen;
  const nextStatus=nextOpen?'OPENED':'CLOSED';
  admissionStatusSaving=true; renderAdmissionStatusControls();
  try{
    const result=await invokeFnDetailed('manage-school-settings',{action:'admission_status',school_id:SB_SCHOOL.id,patch:{admission_status:nextStatus}});
    if(result.error||(result.data&&result.data.ok===false)){
      toast('Could not update admission status: '+((result.data&&result.data.message)||(result.error&&result.error.message)||'error'));
      return;
    }
    const savedConfig=(result.data&&result.data.config)||{};
    const savedStatus=savedConfig.admission_status||nextStatus;
    if(SB_CFG) Object.assign(SB_CFG,savedConfig,{admission_status:savedStatus});
    admissionOpen=admissionStatusIsOpen(savedStatus);
    cachePublicSchoolProfile({admission_status:savedStatus});
    await notifyStudentPortalRefresh('admission-status',{admission_status:savedStatus});
    activityLog.unshift({time:'Just now',action:'Admission '+(admissionOpen?'opened':'closed'),by:(SB_ADMIN_NAME||'Admin')});
    toast('Admission '+(admissionOpen?'opened':'closed'));
  }finally{
    admissionStatusSaving=false; renderAdmissionStatusControls();
  }
};

const SAVED_ACADEMIC_YEARS=new Set();
async function populateYearSelect(current){
  const sel=$('s_acadyear'); if(!sel)return;
  const years=new Set();
  SAVED_ACADEMIC_YEARS.clear();
  const base=new Date().getFullYear()-2;
  for(let y=base;y<=base+9;y++) years.add(y+'/'+(y+1));
  if(current) years.add(current);
  // include any saved (parked) years so they're switchable from the dropdown too
  try{ const {data}=await sb.rpc('list_archived_years',{p_school:SB_SCHOOL.id}); (Array.isArray(data)?data:[]).forEach(r=>{ if(r.academic_year){years.add(r.academic_year);SAVED_ACADEMIC_YEARS.add(r.academic_year);} }); }catch(e){}
  const sorted=[...years].sort();
  sel.innerHTML=sorted.map(y=>`<option value="${y}" ${y===current?'selected':''}>${y}${y===current?' (current)':''}</option>`).join('');
  if(current) sel.value=current;
  sel.onchange=syncAdmissionYearFromAcademicYear;
  syncAdmissionYearFromAcademicYear();
}
function admissionYearFromAcademicYear(value){
  const match=String(value||'').match(/(\d{4})/);
  return match?parseInt(match[1],10):null;
}
function syncAdmissionYearFromAcademicYear(){
  const admissionYear=admissionYearFromAcademicYear(val('s_acadyear'));
  const input=$('s_admyear');
  if(input){input.value=admissionYear||'';input.readOnly=true;}
  return admissionYear;
}
async function saveAcademicConfig(){
  if(roGuard())return;
  if(!SB_SCHOOL){toast('School not loaded');return;}
  ensureSetupRuntimeFields();
  const newYear=(val('s_acadyear')||'').trim();
  const newAdmYear=admissionYearFromAcademicYear(newYear);
  const reopeningDate=(val('s_reopen_date')||'').trim()||null;
  const reopeningTime=(val('s_reopen_time')||'').trim()||null;
  const serviceCharge=(document.getElementById('s_charge')&&document.getElementById('s_charge').value!=='')?parseFloat(document.getElementById('s_charge').value):null;
  const acceptOnlinePayment=(val('s_accept_online_payment')||'yes')==='yes';
  const featurePatch=studentFeaturePatch();
  if(!newYear||!newAdmYear){toast('A valid academic year is required');return;}
  const curYear=(SB_CFG&&SB_CFG.academic_year)||'';
  if(curYear&&(newYear!==curYear||SAVED_ACADEMIC_YEARS.has(newYear))){
    // Academic year changed -> SWAP: park current year's data, load the target year's data (or start empty)
    const msg='Switch academic year from "'+curYear+'" to "'+newYear+'"?\n\n'
      +'Your "'+curYear+'" data (students, placements, payments) will be saved and set aside. '
      +'If "'+newYear+'" has saved data it will be loaded back; otherwise the year starts empty.\n\n'
      +'You can switch back any time — nothing is deleted.\n\nContinue?';
    if(newYear!==curYear&&!confirm(msg))return;
    toast('Switching to '+newYear+'…');
    const {data,error}=await sb.rpc('switch_academic_year',{p_school:SB_SCHOOL.id,p_new_year:newYear});
    if(error){toast('Switch failed: '+error.message);return;}
    if(!data||!data.ok){toast('Switch failed: '+((data&&data.error)||'unknown'));return;}
    const cfgRes=await invokeFnDetailed('manage-school-settings',{action:'academic_config',school_id:SB_SCHOOL.id,patch:{academic_year:newYear,admission_year:newAdmYear,reopening_date:reopeningDate,reopening_time:reopeningTime,service_charge:serviceCharge,accept_online_payment:acceptOnlinePayment}});
    if(cfgRes.error||(cfgRes.data&&cfgRes.data.ok===false)){toast('Could not save configuration: '+((cfgRes.data&&cfgRes.data.message)||(cfgRes.error&&cfgRes.error.message)||'error'));return;}
    if(SB_CFG&&cfgRes.data&&cfgRes.data.config) Object.assign(SB_CFG,cfgRes.data.config);
    await persistStudentFeatureSettings();
    notifyStudentPortalRefresh('academic-year-switch');
    alert('Academic year is now '+newYear+'.\n\n'+(data.restored
      ? 'Loaded saved data for '+newYear+':\n• '+data.students+' students\n• '+data.placements+' placements\n• '+data.payments+' payments'
      : 'This is a new year — starting empty.')
      +(data.recovered_same_year?'\n\nThe parked data for this academic year has been recovered.':'\n\nYour previous year ("'+(data.old_year||curYear)+'") was saved and can be switched back to any time.'));
    await loadSchoolData({full_name:SB_ADMIN_NAME,role:(SB_PERMS==null?'super_admin':'school_admin'),permissions:SB_PERMS,school_id:(SB_SCHOOL&&SB_SCHOOL.id)||null});
    go('dashboard');
    return;
  }
  // No year change — just persist year/admission-year
  const cfgRes=await invokeFnDetailed('manage-school-settings',{action:'academic_config',school_id:SB_SCHOOL.id,patch:{academic_year:newYear,admission_year:newAdmYear,reopening_date:reopeningDate,reopening_time:reopeningTime,service_charge:serviceCharge,accept_online_payment:acceptOnlinePayment}});
  if(cfgRes.error||(cfgRes.data&&cfgRes.data.ok===false)){toast('Could not save: '+((cfgRes.data&&cfgRes.data.message)||(cfgRes.error&&cfgRes.error.message)||'error'));return;}
  if(SB_CFG&&cfgRes.data&&cfgRes.data.config) Object.assign(SB_CFG,cfgRes.data.config);
  if(!await persistStudentFeatureSettings())return;
  if(SB_CFG){Object.assign(SB_CFG,{academic_year:newYear,admission_year:newAdmYear,reopening_date:reopeningDate,reopening_time:reopeningTime,service_charge:serviceCharge,accept_online_payment:acceptOnlinePayment},featurePatch);}
  cachePublicSchoolProfile(Object.assign({service_charge:serviceCharge,accept_online_payment:acceptOnlinePayment},featurePatch));
  notifyStudentPortalRefresh('academic-config');
  toast('Admission configuration saved');
}

/* ===== SCHOOL USERS ===== */
/* ===== DOCUMENT TEMPLATES ===== */
let SCHOOL_CREST='data:image/png;base64,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';
const GES_HEAD='<table style="width:100%;border-collapse:collapse;margin:0 0 6px"><tr><td style="border:none;width:64px;vertical-align:middle">{CREST_TOP}</td><td style="border:none;vertical-align:middle;padding-left:10px"><div style="font-size:16px;font-weight:700;letter-spacing:.35px">{SCHOOL_NAME}</div><div style="font-size:11px">{SCHOOL_ADDRESS}</div></td></tr></table><div style="border-top:1.6px solid #111;margin:4px 0 24px"></div><div style="text-align:center;line-height:1.25;margin-bottom:12px"><div style="font-size:28px;font-weight:700;letter-spacing:.35px">{SCHOOL_NAME}</div><div style="font-size:12px;font-weight:700;margin-top:6px">(GHANA EDUCATION SERVICE)</div></div><table style="width:100%;border-collapse:collapse;margin:0 0 14px"><tr><td style="border:none;vertical-align:top;width:34%;font-size:12px;line-height:1.45"><div style="font-weight:700">{HEADMASTER}</div><div><b>Our Ref. No.</b> ........................</div><div><b>Your Ref. No.</b> ........................</div><div><b>Phone:</b> {SCHOOL_PHONE}</div><div><b>Email:</b> {SCHOOL_EMAIL}</div></td><td style="border:none;vertical-align:top;width:32%;text-align:center">{CREST_CENTER}</td><td style="border:none;vertical-align:top;width:34%;font-size:12px;line-height:1.45;text-align:right"><div style="font-weight:700">{SCHOOL_ADDRESS}</div><div style="margin-top:14px;font-weight:700">{DATE}</div></td></tr></table><div style="border-top:1.2px solid #111;margin:6px 0 18px"></div>';
const DOC_STUDENT_HEAD='<table style="width:100%;border-collapse:collapse;margin:0 0 10px"><tr><td style="border:none;font-size:12.5px"><b>Student:</b> {STUDENT_NAME}</td><td style="border:none;font-size:12.5px"><b>Index No.:</b> {INDEX}</td><td style="border:none;font-size:12.5px"><b>Admission No.:</b> {ADMISSION_NO}</td></tr><tr><td style="border:none;font-size:12.5px"><b>Programme:</b> {PROGRAMME}</td><td style="border:none;font-size:12.5px"><b>Class:</b> {CLASS}</td><td style="border:none;font-size:12.5px"><b>House:</b> {HOUSE}</td></tr></table>';
const TPL_DEFAULT={
 letter:GES_HEAD
  +'<h3 style="text-align:center;text-decoration:underline;margin:12px 0 18px;font-size:17px">ADMISSION &mdash; {ACADEMIC_YEAR} ACADEMIC YEAR</h3>'
  +'<p style="font-size:13.5px;line-height:1.6">I am pleased to inform you that on the basis of your ward&rsquo;s performance at the BECE, Master/Miss <b>{STUDENT_NAME}</b> (Index No. <b>{INDEX}</b>) has been offered admission into <b>{SCHOOL_NAME}</b> as a <b>{RESIDENTIAL}</b> student to pursue the Free SHS Programme. Admission No: <b>{ADMISSION_NO}</b>.</p>'
  +'<ol><li>He/she is allocated to House <b>{HOUSE}</b>.</li>'
  +'<li>The Programme offered him/her is <b>{PROGRAMME}</b>. Parents are to note that after admission students have only two weeks to change their course/Programme if they wish to do so.</li>'
  +'<li>Please find enclosed a copy of the prospectus of the school.</li>'
  +'<li>Fill the enclosed forms and return them without delay to the school&rsquo;s Administration.</li>'
  +'<li>You are required to attach a copy of your ward&rsquo;s Admission Letter, BECE Result Slip, Birth Certificate, Placement Slip, and completed Enrolment Form for submission to the Headmaster.</li>'
  +'<li>Your ward should bring to school four (4) passport-size photographs for his/her personal records.</li>'
  +'<li><b>ALL NEWLY ADMITTED STUDENTS ARE TO REPORT ON {REPORTING_DATE}.</b></li></ol>'
  +'<table style="width:100%;border-collapse:collapse;margin-top:54px"><tr><td style="border:none;vertical-align:bottom;width:68%"><p style="margin:0 0 34px">Yours faithfully,</p><div style="border-top:1.2px solid #111;width:220px;margin-bottom:4px"></div><div><b>{HEADMASTER}</b></div><div>(HEADMASTER)</div></td><td style="border:none;text-align:right;vertical-align:bottom">{QR_CODE}</td></tr></table>',
 records:GES_HEAD
  +'<h3 style="text-align:center;text-decoration:underline;margin:10px 0 12px;font-size:17px">PERSONAL RECORDS FORM &mdash; {ACADEMIC_YEAR}</h3>'
  +'{RECORDS_TABLE}'
  +'<p style="margin-top:18px">Signature: _______________________ &nbsp;&nbsp; Date: _______________</p>'
};
const LEGACY_GES_HEAD='<div style="text-align:center;line-height:1.3">{CREST}<div style="font-size:22px;font-weight:700;letter-spacing:.5px">{SCHOOL_NAME}</div><div style="font-size:12px">(GHANA EDUCATION SERVICE)</div><div style="font-size:12px">{SCHOOL_ADDRESS} &middot; Tel: {SCHOOL_PHONE}</div></div><hr style="border:none;border-top:2px solid #000;margin:8px 0">';
const LEGACY_TPL_DEFAULT={
 letter:LEGACY_GES_HEAD
  +'<table style="width:100%;font-size:12px"><tr><td style="border:none;text-align:left">Our Ref. No: ........................<br>Your Ref. No: ........................</td><td style="border:none;text-align:right">Date: {DATE}</td></tr></table>'
  +'<h3 style="text-align:center;text-decoration:underline;margin:12px 0">ADMISSION &mdash; {ACADEMIC_YEAR} ACADEMIC YEAR</h3>'
  +'<p>I am pleased to inform you that on the basis of your ward&rsquo;s performance at the BECE, Master/Miss <b>{STUDENT_NAME}</b> (Index No. {INDEX}) has been offered admission into <b>{SCHOOL_NAME}</b> as a <b>{RESIDENTIAL}</b> student to pursue the Free SHS Programme. Admission No: <b>{ADMISSION_NO}</b>.</p>'
  +'<ol><li>He/she is allocated to House <b>{HOUSE}</b>.</li>'
  +'<li>The Programme offered him/her is <b>{PROGRAMME}</b>. Parents are to note that after admission students have only two weeks to change their course/Programme if they wish to do so.</li>'
  +'<li>Please find enclosed a copy of the prospectus of the school.</li>'
  +'<li>Fill the enclosed forms and return them without delay to the school&rsquo;s Administration.</li>'
  +'<li>You are required to attach a copy of your ward&rsquo;s Admission Letter, BECE Result Slip, Birth Certificate, Placement Slip, and completed Enrolment Form for submission to the Headmaster.</li>'
  +'<li>Your ward should bring to school four (4) passport-size photographs for his/her personal records.</li>'
  +'<li><b>ALL NEWLY ADMITTED STUDENTS ARE TO REPORT ON {REPORTING_DATE}.</b></li></ol>'
  +'<p>Yours faithfully,</p><p style="margin-top:34px">_______________________<br><b>{HEADMASTER}</b><br>(HEADMASTER)</p>',
 records:LEGACY_GES_HEAD
  +'<h3 style="text-align:center;text-decoration:underline;margin:10px 0">PERSONAL RECORDS FORM &mdash; {ACADEMIC_YEAR}</h3>'
  +'{RECORDS_TABLE}'
  +'<p style="margin-top:18px">Signature: _______________________ &nbsp;&nbsp; Date: _______________</p>'
};
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
function resolveTemplateDraft(kind,tpl){
  // Defaults and legacy upgrades belong only to the initial load. Once a school
  // has saved a custom template, preserve its HTML exactly: normalizing it here
  // would recreate headers and other content the administrator deliberately
  // deleted.
  const raw=String(tpl||'').trim();
  const fallback=kind==='letter'?TPL_DEFAULT.letter:TPL_DEFAULT.records;
  if(!raw) return fallback;
  if(kind==='letter' && raw===LEGACY_TPL_DEFAULT.letter) return TPL_DEFAULT.letter;
  if(kind==='records' && raw===LEGACY_TPL_DEFAULT.records) return TPL_DEFAULT.records;
  return raw;
}
const TPL_VARS=['CREST','CREST_TOP','CREST_CENTER','SCHOOL_NAME','SCHOOL_ADDRESS','SCHOOL_PHONE','SCHOOL_EMAIL','HEADMASTER','ACADEMIC_YEAR','DATE','REPORTING_DATE','REPORTING_TIME','STUDENT_NAME','INDEX','ADMISSION_NO','PROGRAMME','CLASS','HOUSE','GENDER','RESIDENTIAL','AGGREGATE','CONTACT'];
let TPL={letter:'',records:''}, tplCur='letter', tplRange=null, tplLoaded=false, tplBound=false, tplSelectedFloat=null;
const TPL_EMPTY_MARKER='<div data-template-empty="1"></div>';
function tplStoredHTML(html){
  const raw=window.QATemplateSanitizer.sanitize(String(html||'')).trim();
  if(!raw) return TPL_EMPTY_MARKER;
  const probe=document.createElement('div');
  probe.innerHTML=raw;
  const text=String(probe.textContent||'').replace(/\u200B/g,'').trim();
  const visibleObject=probe.querySelector('img,table,hr,svg,canvas,[data-float="1"],.tpl-line-object');
  return (text||visibleObject)?raw:TPL_EMPTY_MARKER;
}
function tplEditorDisplayHTML(html){
  const raw=window.QATemplateSanitizer.sanitize(String(html||'')).trim();
  return raw===TPL_EMPTY_MARKER?'':raw;
}
function tplSelectionRoot(){
  if(tplSelectedFloat && tplSelectedFloat.getAttribute('data-float-type')==='text' && tplSelectedFloat.getAttribute('data-editing')==='1') return tplSelectedFloat;
  return $('tplEditor');
}
function tplToolbarHit(target){
  return !!(target && target.closest && target.closest('.tpl-toolbar, .tpl-fieldbar'));
}
function tplSaveSel(){
  const s=window.getSelection(), root=tplSelectionRoot();
  if(s&&s.rangeCount&&root&&root.contains(s.anchorNode))tplRange=s.getRangeAt(0).cloneRange();
}
function tplRestore(){
  const root=tplSelectionRoot();
  if(root && typeof root.focus==='function') root.focus();
  if(tplRange){
    const s=window.getSelection();
    s.removeAllRanges();
    s.addRange(tplRange);
  }
}
function tplExec(c,v){tplRestore();try{document.execCommand('styleWithCSS',false,true);}catch(e){}document.execCommand(c,false,v===undefined?null:v);tplSaveSel();}
function tplCmd(c){tplExec(c);}
function tplFormat(tag){if(!tag)return;tplExec('formatBlock',tag);}
function tplFont(f){if(!f)return;tplExec('fontName',f);}
function tplSize(s){if(!s)return;tplExec('fontSize',s);}
function tplColor(c){tplExec('foreColor',c);}
function tplHilite(c){tplExec('hiliteColor',c);}
function insertTplVar(tok){tplRestore();document.execCommand('insertText',false,tok);tplSaveSel();}
function uploadSchoolCrest(inp){
  const f=inp.files&&inp.files[0]; if(!f){return;} inp.value='';
  if(f.size>2*1024*1024){toast('Please use a crest under 2 MB');return;}
  const img=new Image();
  img.onload=async function(){
    let w=img.width,h=img.height; const sc=Math.min(260/w,260/h,1); w=Math.round(w*sc); h=Math.round(h*sc);
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const x=c.getContext('2d'); x.drawImage(img,0,0,w,h);
    let uri;
    try{ const d=x.getImageData(0,0,w,h),p=d.data;
      for(let i=0;i<p.length;i+=4){ if(p[i]>232&&p[i+1]>232&&p[i+2]>232) p[i+3]=0; }
      x.putImageData(d,0,0);
      // auto-crop: trim transparent border so the crest fills its box
      let minX=w,minY=h,maxX=-1,maxY=-1;
      for(let yy=0;yy<h;yy++){ for(let xx=0;xx<w;xx++){ if(p[(yy*w+xx)*4+3]>16){ if(xx<minX)minX=xx; if(xx>maxX)maxX=xx; if(yy<minY)minY=yy; if(yy>maxY)maxY=yy; } } }
      if(maxX>=minX&&maxY>=minY){ const pad=2; const cx=Math.max(0,minX-pad),cy=Math.max(0,minY-pad);
        const cw=Math.min(w-cx,maxX-minX+1+2*pad), ch=Math.min(h-cy,maxY-minY+1+2*pad);
        const cc=document.createElement('canvas'); cc.width=cw; cc.height=ch;
        cc.getContext('2d').drawImage(c,cx,cy,cw,ch,0,0,cw,ch); uri=cc.toDataURL('image/png'); }
    }catch(e){}
    if(!uri) uri=c.toDataURL('image/png');
    SCHOOL_CREST=uri;
    const prev=$('s_crest_prev'); if(prev){prev.src=uri;prev.style.display='block';}
    const bm=$('brandCrest'); if(bm){bm.src=uri;bm.style.display='block';} const dl=$('brandDefaultLogo'); if(dl) dl.style.display='none'; const lt=$('brandLogoText'); if(lt) lt.style.display='none';
    if(window.SB_SCHOOL&&SB_SCHOOL.id){
      toast('Saving crest...');
      const result=await invokeFnDetailed('manage-school-settings',{action:'crest',school_id:SB_SCHOOL.id,patch:{data_url:uri}});
      const saved=result&&result.data&&result.data.school;
      if(result.error||!saved||result.data.ok===false){
        toast('Could not save crest: '+((result.data&&result.data.message)||(result.error&&result.error.message)||'error'));
      }else{
        Object.assign(SB_SCHOOL,saved);
        SCHOOL_CREST=saved.crest_url||uri;
        if(prev)prev.src=SCHOOL_CREST;
        if(bm)bm.src=SCHOOL_CREST;
        cachePublicSchoolProfile({crest_url:SCHOOL_CREST});
        notifyStudentPortalRefresh('crest-update');
        toast('Crest uploaded & saved');
      }
    } else toast('Crest set');
    URL.revokeObjectURL(img.src);
  };
  img.onerror=function(){toast('Could not read that image');};
  img.src=URL.createObjectURL(f);
}
function tplInsertHTML(html){ tplRestore(); document.execCommand('insertHTML',false,html); tplSaveSel(); }
function tplInsertCrest(){ tplInsertHTML('<img src="'+SCHOOL_CREST+'" data-float="1" draggable="false" style="position:absolute;left:60%;top:18px;width:90px;height:auto;z-index:9;background:transparent;cursor:move" alt="crest">'); toast('Crest placed — drag it anywhere; double-click to resize.'); }
function tplInsertImage(inp){
  const f=inp.files&&inp.files[0]; inp.value='';
  if(!f)return;
  if(f.size>800*1024){toast('Please use a logo under 800 KB');return;}
  const r=new FileReader();
  r.onload=function(){ tplInsertHTML('<img src="'+r.result+'" style="max-width:140px;height:auto" alt="logo">'); toast('Logo inserted — click it to resize'); };
  r.readAsDataURL(f);
}
function tplTextBoxHTML(content,style){
  return '<div class="tpl-float-object tpl-textbox" data-float="1" data-float-type="text" data-editing="0" contenteditable="false" spellcheck="false" tabindex="0" style="position:absolute;left:12px;top:10px;width:220px;min-height:20px;padding:0 2px;z-index:4;'+(style||'')+'">'+(content||'Text box')+'</div>';
}
function tplLineHTML(style){
  return '<div class="tpl-float-object tpl-line-object" data-float="1" data-float-type="line" contenteditable="false" tabindex="0" style="position:absolute;left:0;top:10px;width:620px;height:18px;z-index:4;cursor:move;'+(style||'')+'"><div class="tpl-line-bar" style="position:absolute;left:0;right:0;top:8px;border-top:2px solid #000"></div></div>';
}
function tplSetTextBoxEditing(el,on){
  if(!el||el.getAttribute('data-float-type')!=='text') return;
  el.setAttribute('data-editing',on?'1':'0');
  el.setAttribute('contenteditable',on?'true':'false');
  el.classList.toggle('is-editing',!!on);
  if(on){
    el.focus();
    const sel=window.getSelection();
    const range=document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    tplSaveSel();
  }else{
    if(document.activeElement===el) $('tplEditor').focus();
    tplSaveSel();
  }
}
function tplClearFloatSelection(){
  if(!tplSelectedFloat) return;
  tplSetTextBoxEditing(tplSelectedFloat,false);
  tplSelectedFloat.classList.remove('is-selected');
  tplSelectedFloat=null;
}
function tplSelectFloat(el){
  if(!el) return;
  if(tplSelectedFloat===el) return;
  tplClearFloatSelection();
  tplSelectedFloat=el;
  el.classList.add('is-selected');
  if(typeof el.focus==='function') el.focus();
}
function tplDeleteSelectedFloat(){
  if(!tplSelectedFloat) return false;
  const el=tplSelectedFloat;
  if(el.getAttribute('data-float-type')==='text' && el.getAttribute('data-editing')==='1') return false;
  const zone=el.closest('.tpl-move-zone');
  tplSelectedFloat=null;
  el.remove();
  if(zone && !zone.querySelector('[data-float="1"],img[data-float="1"]')) zone.remove();
  tplSaveSel();
  toast('Object deleted');
  return true;
}
function tplEditorHTML(){
  const ed=$('tplEditor');
  if(!ed) return '';
  const clone=ed.cloneNode(true);
  clone.querySelectorAll('.is-selected').forEach(function(el){ el.classList.remove('is-selected'); });
  clone.querySelectorAll('.is-editing').forEach(function(el){ el.classList.remove('is-editing'); });
  clone.querySelectorAll('[data-float-type="text"]').forEach(function(el){
    el.setAttribute('data-editing','0');
    el.setAttribute('contenteditable','false');
  });
  return clone.innerHTML;
}
function tplInsertTextBox(){
  const id='tpl_tb_'+Date.now();
  tplInsertHTML(tplTextBoxHTML('Text box','left:14px;top:16px;width:220px;').replace('class="tpl-float-object tpl-textbox"','id="'+id+'" class="tpl-float-object tpl-textbox"'));
  const box=document.getElementById(id);
  if(box){ tplSelectFloat(box); box.focus(); }
  toast('Text box inserted - drag it anywhere, double-click to edit');
}
function tplInsertLine(){
  const id='tpl_ln_'+Date.now();
  tplInsertHTML(tplLineHTML('left:0;top:10px;width:620px;').replace('class="tpl-float-object tpl-line-object"','id="'+id+'" class="tpl-float-object tpl-line-object"'));
  const line=document.getElementById(id);
  if(line) tplSelectFloat(line);
  toast('Line inserted - drag it to position it');
}
function tplMakeLegacyHeaderZone(tbl){
  const zone=document.createElement('div');
  zone.className='tpl-move-zone header-zone';
  zone.setAttribute('contenteditable','false');
  const leftCell=tbl.rows[0].cells[0], rightCell=tbl.rows[0].cells[1];
  const size=tbl.style.fontSize||'12px';
  zone.innerHTML=
    tplTextBoxHTML(leftCell.innerHTML,'left:0;top:0;width:290px;font-size:'+size+';line-height:1.45;')+
    tplTextBoxHTML(rightCell.innerHTML,'left:calc(100% - 176px);top:18px;width:170px;font-size:'+size+';line-height:1.4;text-align:right;');
  tbl.replaceWith(zone);
}
function tplMakeLegacyLineZone(hr){
  const zone=document.createElement('div');
  zone.className='tpl-move-zone';
  zone.setAttribute('contenteditable','false');
  zone.style.minHeight='30px';
  const cs=getComputedStyle(hr);
  const width=Math.max(180,Math.round(hr.getBoundingClientRect().width||620));
  const topWidth=Math.max(1,Math.round(parseFloat(cs.borderTopWidth)||2));
  const color=cs.borderTopColor||'#000';
  zone.innerHTML=tplLineHTML('left:0;top:6px;width:'+width+'px;').replace('border-top:2px solid #000','border-top:'+topWidth+'px solid '+color);
  hr.replaceWith(zone);
}
function tplUpgradeLegacyLayout(ed){
  Array.from(ed.querySelectorAll('table')).forEach(function(tbl){
    if(tbl.closest('.tpl-move-zone')) return;
    if(!tbl.rows||tbl.rows.length!==1||!tbl.rows[0]||tbl.rows[0].cells.length!==2) return;
    const text=(tbl.innerText||'').replace(/\s+/g,' ');
    if(/Our\s*Ref/i.test(text) && /Date:/i.test(text)) tplMakeLegacyHeaderZone(tbl);
  });
  Array.from(ed.querySelectorAll('hr')).forEach(function(hr){
    if(hr.closest('.tpl-move-zone')) return;
    tplMakeLegacyLineZone(hr);
  });
}
function tplPromoteFloatToEditor(el){
  const ed=$('tplEditor');
  if(!el||!ed) return el;
  const zone=el.closest('.tpl-move-zone');
  if(!zone || zone===ed) return el;
  const edRect=ed.getBoundingClientRect();
  const elRect=el.getBoundingClientRect();
  const left=Math.round(elRect.left-edRect.left+ed.scrollLeft);
  const top=Math.round(elRect.top-edRect.top+ed.scrollTop);
  const width=Math.round(elRect.width||el.offsetWidth||0);
  const height=Math.round(elRect.height||el.offsetHeight||0);
  zone.removeChild(el);
  ed.appendChild(el);
  el.style.left=left+'px';
  el.style.top=top+'px';
  el.style.right='auto';
  el.style.bottom='auto';
  if(width && el.getAttribute('data-float-type')!=='image') el.style.width=width+'px';
  if(height && el.getAttribute('data-float-type')==='line') el.style.height=height+'px';
  if(zone && !zone.querySelector('[data-float="1"],img[data-float="1"]')) zone.remove();
  return el;
}
function tplFloatRoot(){
  return $('tplEditor');
}
function tplResizeFloat(el){
  if(!el) return;
  if(el.tagName==='IMG'){
    const cur=parseInt(el.style.width)||el.width||120;
    const w=prompt('Image width in pixels:',cur);
    if(w&&!isNaN(parseInt(w))){el.style.width=parseInt(w)+'px';el.style.height='auto';tplSaveSel();}
    return;
  }
  const type=el.getAttribute('data-float-type');
  if(type==='text'){
    const cur=parseInt(el.style.width)||Math.round(el.getBoundingClientRect().width)||220;
    const w=prompt('Text box width in pixels:',cur);
    if(w&&!isNaN(parseInt(w))){el.style.width=Math.max(80,parseInt(w))+'px';tplSaveSel();}
    return;
  }
  if(type==='line'){
    const cur=parseInt(el.style.width)||Math.round(el.getBoundingClientRect().width)||620;
    const w=prompt('Line width in pixels:',cur);
    if(w&&!isNaN(parseInt(w))) el.style.width=Math.max(80,parseInt(w))+'px';
    const bar=el.querySelector('.tpl-line-bar');
    const curThick=bar?Math.max(1,Math.round(parseFloat((bar.style.borderTopWidth||'2').replace('px',''))||2)):2;
    const thick=prompt('Line thickness in pixels:',curThick);
    if(bar&&thick&&!isNaN(parseInt(thick))) bar.style.borderTopWidth=Math.max(1,parseInt(thick))+'px';
    tplSaveSel();
  }
}
function buildTplVars(){ $('tplVars').innerHTML=TPL_VARS.map(v=>`<button type="button" data-qa-onclick="insertTplVar('{${v}}')">{${v}}</button>`).join('')+(tplCur==='records'?`<button type="button" data-qa-onclick="insertTplVar('{RECORDS_TABLE}')">{RECORDS_TABLE}</button>`:'')+`<button type="button" title="Scannable QR of the student's details" data-qa-onclick="insertTplVar('{QR_CODE}')">{QR_CODE}</button>`; $('tplRecordsHint').hidden=tplCur!=='records'; }
function renderTemplates(){
  if(!tplLoaded){ TPL.letter=resolveTemplateDraft('letter',(SB_CFG&&SB_CFG.letter_template)||''); TPL.records=resolveTemplateDraft('records',(SB_CFG&&SB_CFG.records_template)||''); tplLoaded=true; }
  const ed=$('tplEditor');
  if(!tplBound){ ['keyup','mouseup','input'].forEach(e=>ed.addEventListener(e,tplSaveSel));
    // Keep the editor's selection alive when a ribbon button is clicked
    // (a button's mousedown would otherwise blur the editor and collapse the selection).
    document.querySelectorAll('.tpl-toolbar, .tpl-fieldbar').forEach(bar=>{
      bar.addEventListener('mousedown',function(e){
        tplSaveSel();
        if(e.target.closest('button')) e.preventDefault();
      });
    });
    ed.addEventListener('dblclick',function(e){ const t=e.target.closest ? e.target.closest('[data-float="1"],img') : null; if(!t)return; tplSelectFloat(t); if(t.getAttribute('data-float-type')==='text'){ tplSetTextBoxEditing(t,true); return; } tplResizeFloat(t); });
    let drag=null;
    ed.addEventListener('mousedown',function(e){ let t=e.target.closest ? e.target.closest('[data-float="1"]') : null; if(!t){ tplClearFloatSelection(); return; } t=tplPromoteFloatToEditor(t); tplSelectFloat(t); if(t.getAttribute('data-float-type')==='text' && t.getAttribute('data-editing')==='1') return; e.preventDefault(); const ir=t.getBoundingClientRect(); const root=tplFloatRoot(); drag={el:t,root,offX:e.clientX-ir.left,offY:e.clientY-ir.top}; t.style.opacity='.85'; });
    document.addEventListener('mousemove',function(e){ if(!drag)return; const root=drag.root; const r=root.getBoundingClientRect(); const cs=getComputedStyle(root); const padL=parseFloat(cs.paddingLeft)||0, padT=parseFloat(cs.paddingTop)||0;
      let nl=(e.clientX-drag.offX-r.left)+root.scrollLeft-padL; let nt=(e.clientY-drag.offY-r.top)+root.scrollTop-padT;
      const maxL=Math.max(-padL,(root.clientWidth||root.scrollWidth)-drag.el.offsetWidth-padL); const maxT=Math.max(-padT,(root.clientHeight||root.scrollHeight)-drag.el.offsetHeight-padT);
      nl=Math.max(-padL,Math.min(nl, maxL)); nt=Math.max(-padT,Math.min(nt, maxT));
      drag.el.style.left=Math.round(nl)+'px'; drag.el.style.top=Math.round(nt)+'px'; drag.el.style.right='auto'; });
    document.addEventListener('mouseup',function(){ if(drag){ drag.el.style.opacity=''; drag=null; tplSaveSel(); } });
    document.addEventListener('mousedown',function(e){
      if(!tplSelectedFloat) return;
      if(tplToolbarHit(e.target)) return;
      const edNow=$('tplEditor');
      if(!edNow||!edNow.contains(e.target)) { tplClearFloatSelection(); return; }
      const t=e.target.closest ? e.target.closest('[data-float="1"]') : null;
      if(t===tplSelectedFloat) return;
      if(!t) tplClearFloatSelection();
    });
    tplBound=true; }
  tplClearFloatSelection(); buildTplVars(); ed.innerHTML=tplEditorDisplayHTML(TPL[tplCur]); tplUpgradeLegacyLayout(ed); tplApplyEditorFont();
}
function tplApplyEditorFont(){ const ed=$('tplEditor'); if(ed) ed.style.fontFamily=(tplCur==='records')?"'Times New Roman',Times,serif":'Georgia,serif'; }
function tplTab(which){ TPL[tplCur]=tplStoredHTML(tplEditorHTML()); tplCur=which; tplClearFloatSelection(); $('tplTabLetter').classList.toggle('active',which==='letter'); $('tplTabRecords').classList.toggle('active',which==='records'); buildTplVars(); $('tplEditor').innerHTML=tplEditorDisplayHTML(TPL[tplCur]); tplUpgradeLegacyLayout($('tplEditor')); tplApplyEditorFont(); }
function tplFull(){ const c=$('tplCard'); const on=c.classList.toggle('tpl-fs'); $('tplFullBtn').textContent=on?'⤢ Exit full screen':'⛶ Full screen'; document.body.style.overflow=on?'hidden':''; }
document.addEventListener('keydown',e=>{
  const tplCard=document.getElementById('tplCard');
  const withinTpl=!!(tplCard && tplCard.contains(e.target));
  if((e.key==='Delete'||e.key==='Backspace') && tplSelectedFloat){
    if(!withinTpl) return;
    const typing=tplSelectedFloat.getAttribute('data-float-type')==='text' && tplSelectedFloat.getAttribute('data-editing')==='1';
    if(!typing){ e.preventDefault(); tplDeleteSelectedFloat(); return; }
  }
  if(e.key==='Enter' && tplSelectedFloat && tplSelectedFloat.getAttribute('data-float-type')==='text' && tplSelectedFloat.getAttribute('data-editing')!=='1'){
    if(!withinTpl) return;
    e.preventDefault();
    tplSetTextBoxEditing(tplSelectedFloat,true);
    return;
  }
  if(e.key==='Escape'){
    if(tplSelectedFloat && tplSelectedFloat.getAttribute('data-float-type')==='text' && tplSelectedFloat.getAttribute('data-editing')==='1'){
      e.preventDefault();
      tplSetTextBoxEditing(tplSelectedFloat,false);
      return;
    }
    const c=document.getElementById('tplCard');
    if(c&&c.classList.contains('tpl-fs')) tplFull();
  }
});
async function tplSave(){
  if(roGuard())return;
  TPL[tplCur]=tplStoredHTML(tplEditorHTML());
  const tplRes=await invokeFnDetailed('manage-school-settings',{action:'templates',school_id:SB_SCHOOL.id,patch:{letter_template:TPL.letter,records_template:TPL.records}});
  if(tplRes.error||(tplRes.data&&tplRes.data.ok===false)){toast('Could not save: '+((tplRes.data&&tplRes.data.message)||(tplRes.error&&tplRes.error.message)||'error'));return;}
  const savedCfg=(tplRes.data&&tplRes.data.config)||{};
  if(typeof savedCfg.letter_template==='string') TPL.letter=savedCfg.letter_template;
  if(typeof savedCfg.records_template==='string') TPL.records=savedCfg.records_template;
  if(SB_CFG){SB_CFG.letter_template=TPL.letter;SB_CFG.records_template=TPL.records;}
  notifyStudentPortalRefresh('template-save');
  toast('Template saved · students will see it on their printouts');
}
function tplSampleTable(){
  const RN=['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii'];let n=0;
  const sh='background:#1557B0;color:#fff;font-weight:700;font-size:12px;letter-spacing:.06em;text-transform:uppercase;padding:7px 8px';
  const sec=(L,t)=>{n=0;return '<tr><td class="sec-h" colspan="2" style="'+sh+'">'+L+'. '+t+'</td></tr>';};
  const r=(l,v)=>'<tr><td class="lbl"><span style="color:#999;font-weight:600">'+(RN[n++])+'.</span> '+l+'</td><td>'+v+'</td></tr>';
  return '<table class="records-table">'
    +sec('A','Placement')+r('Full name','AMA MENSAH')+r('Gender','FEMALE')+r('JHS Index No.','100000000026')+r('Programme','General Science')+r('Residential Status','Boarding')+r('Class','Science 1')+r('House','Unity House')+r('Admission No.','AM/GS/2025/0001')
    +sec('B','Enrolment Data')+r('Aggregate of Best Six','06')+r('Raw Score','232')+r('Enrolment Code','ENR123456')+r('JHS Attended','KANESHIE KINGSWAY 2 BASIC')+r('JHS Type','PUBLIC')
    +sec('C','Personal Data')+r('Date of Birth','12 March 2009')+r('Place of Birth','Koforidua')+r('Nationality','Ghanaian')+r('Religion','Christianity')+r('Home Town','Koforidua')+r('Region','Eastern')+r('Interest(s)','Football')
    +sec('D','Parent / Guardian')+r('SMS Contact','024 000 0000')+r('Father’s Name','KWAME MENSAH')+r('Father’s Contact','024 111 1111')+r('Mother’s Name','AKOSUA MENSAH')+r('Mother’s Contact','024 222 2222')
    +'</table>';
}
function tplMultilineHTML(value){
  return escapeHtml(value).replace(/\r\n?|\n/g,'<br>');
}
function tplReportingDate(){
  const raw=String((SB_CFG&&SB_CFG.reopening_date)||'').trim();
  if(!raw)return 'Reporting date not set';
  const match=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date=match
    ? new Date(Number(match[1]),Number(match[2])-1,Number(match[3]))
    : new Date(raw);
  return Number.isNaN(date.getTime())?raw:date.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
}
function tplPreview(){
  TPL[tplCur]=tplStoredHTML(tplEditorHTML());
  const S=(SB_SCHOOL&&SB_SCHOOL.name)||'Senior High School';
  const _cr=(typeof SCHOOL_CREST!=='undefined'&&SCHOOL_CREST)||(SB_SCHOOL&&SB_SCHOOL.crest_url)||'';
  const sample={CREST:_cr?('<img src="'+_cr+'" style="width:90px;height:auto;display:block;margin:0 auto 4px" alt="">'):'',CREST_TOP:_cr?('<img src="'+_cr+'" style="width:54px;height:auto;display:block" alt="">'):'',CREST_CENTER:_cr?('<img src="'+_cr+'" style="width:148px;height:auto;display:block;margin:0 auto" alt="">'):'',SCHOOL_NAME:S,SCHOOL_ADDRESS:tplMultilineHTML((SB_SCHOOL&&SB_SCHOOL.address)||'P.O. Box 1'),SCHOOL_PHONE:(SB_SCHOOL&&SB_SCHOOL.phone)||(SB_CFG&&SB_CFG.helpdesk)||'024 000 0000',SCHOOL_EMAIL:(SB_SCHOOL&&SB_SCHOOL.email)||'admissions@school.edu.gh',HEADMASTER:(SB_SCHOOL&&SB_SCHOOL.headmaster_name)||'The Headmaster',ACADEMIC_YEAR:(SB_CFG&&SB_CFG.academic_year)||'2025/2026',DATE:new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}),REPORTING_DATE:tplReportingDate(),REPORTING_TIME:(SB_CFG&&SB_CFG.reopening_time)||'Reporting time not set',STUDENT_NAME:'AMA MENSAH',INDEX:'100000000026',ADMISSION_NO:'AM/GS/2025/0001',PROGRAMME:'General Science',CLASS:'Science 1',HOUSE:'Unity House',GENDER:'FEMALE',RESIDENTIAL:'Boarding',AGGREGATE:'06',CONTACT:'024 123 4567'};
  let body=TPL[tplCur].replace(/\{RECORDS_TABLE\}/g,tplSampleTable());
  let qurl=''; try{ if(typeof qrcode!=='undefined'){ const q=qrcode(0,'M'); q.addData([sample.SCHOOL_NAME,'Name: '+sample.STUDENT_NAME,'Index: '+sample.INDEX,'Adm No: '+sample.ADMISSION_NO,'Programme: '+sample.PROGRAMME,'House: '+sample.HOUSE,'Residential: '+sample.RESIDENTIAL,'Year: '+sample.ACADEMIC_YEAR].join('\n')); q.make(); const cells=q.getModuleCount(); const cell=Math.max(2,Math.round(108/(cells+8))); qurl=q.createDataURL(cell,cell*4); } }catch(e){}
  body=body.replace(/\{QR_CODE\}/g, qurl?'<img src="'+qurl+'" style="width:108px;height:108px" alt="QR code">':'[QR]').replace(/\{([A-Z_]+)\}/g,(m,k)=>k in sample?sample[k]:m);
  const w=window.open('','_blank'); if(!w){toast('Allow pop-ups to preview');return;}
  const previewFont=(tplCur==='records')?"'Times New Roman',Times,serif":'Georgia,serif';
  const crest=(typeof SCHOOL_CREST!=='undefined'&&SCHOOL_CREST)||(SB_SCHOOL&&SB_SCHOOL.crest_url)||'';
  const wm=crest?'<div class="qa-wm"><img src="'+crest+'" alt=""></div>':'';
  // section-header / row-number styling + compact 2-page layout for the records form
  const recCss='@page{size:A4;margin:12.7mm}.sec-h{background:#1557B0;color:#fff;font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:5px 6px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.rn{color:#999;font-weight:600;margin-right:4px}'
    +(tplCur==='records'?'body{line-height:1.3;max-width:720px}h2{font-size:14px;margin:6px 0}p{margin:4px 0;font-size:12.5px}table{margin:6px 0}td{padding:3px 6px;font-size:12px}@media print{tr{page-break-inside:avoid}}':'');
  w.document.write('<html><head><title>Preview</title><style>body{font-family:'+previewFont+';max-width:740px;margin:30px auto;padding:0 24px;color:#14201c;line-height:1.6}h1{font-size:20px;text-align:center;margin-bottom:2px}.sub{text-align:center;color:#555;font-size:13px;margin-bottom:24px}h2{font-size:16px;border-bottom:2px solid #1557B0;padding-bottom:4px}table{width:100%;border-collapse:collapse;margin:12px 0}td{padding:6px 4px;border-bottom:1px solid #eee;font-size:14px}.lbl{color:#666;width:200px}.qa-wm{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:62%;max-width:520px;z-index:0;pointer-events:none;opacity:.2;-webkit-print-color-adjust:exact;print-color-adjust:exact}.qa-wm img{width:100%;height:auto;display:block}body>*{position:relative;z-index:1}'+recCss+'@media print{.qa-wm{opacity:.2}}</style></head><body>'+wm+'<div style="position:relative">'+body+'</div><p style="margin-top:30px;text-align:center;color:#888;font-size:12px">PREVIEW · sample data</p></body></html>');
  w.document.close();
}

tplPreview=function(){
  TPL[tplCur]=tplStoredHTML(tplEditorHTML());
  const S=(SB_SCHOOL&&SB_SCHOOL.name)||'Senior High School';
  const _cr=(typeof SCHOOL_CREST!=='undefined'&&SCHOOL_CREST)||(SB_SCHOOL&&SB_SCHOOL.crest_url)||'';
  const sample={CREST:_cr?('<img src="'+_cr+'" style="width:90px;height:auto;display:block;margin:0 auto 4px" alt="">'):'',CREST_TOP:_cr?('<img src="'+_cr+'" style="width:54px;height:auto;display:block" alt="">'):'',CREST_CENTER:_cr?('<img src="'+_cr+'" style="width:148px;height:auto;display:block;margin:0 auto" alt="">'):'',SCHOOL_NAME:S,SCHOOL_ADDRESS:tplMultilineHTML((SB_SCHOOL&&SB_SCHOOL.address)||'P.O. Box 1'),SCHOOL_PHONE:(SB_SCHOOL&&SB_SCHOOL.phone)||(SB_CFG&&SB_CFG.helpdesk)||'024 000 0000',SCHOOL_EMAIL:(SB_SCHOOL&&SB_SCHOOL.email)||'admissions@school.edu.gh',HEADMASTER:(SB_SCHOOL&&SB_SCHOOL.headmaster_name)||'The Headmaster',ACADEMIC_YEAR:(SB_CFG&&SB_CFG.academic_year)||'2025/2026',DATE:new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}),REPORTING_DATE:tplReportingDate(),REPORTING_TIME:(SB_CFG&&SB_CFG.reopening_time)||'Reporting time not set',STUDENT_NAME:'AMA MENSAH',INDEX:'100000000026',ADMISSION_NO:'AM/GS/2025/0001',PROGRAMME:'General Science',CLASS:'Science 1',HOUSE:'Unity House',GENDER:'FEMALE',RESIDENTIAL:'Boarding',AGGREGATE:'06',CONTACT:'024 123 4567'};
  let body=TPL[tplCur].replace(/\{RECORDS_TABLE\}/g,tplSampleTable());
  let qurl=''; try{ if(typeof qrcode!=='undefined'){ const q=qrcode(0,'M'); q.addData([sample.SCHOOL_NAME,'Name: '+sample.STUDENT_NAME,'Index: '+sample.INDEX,'Adm No: '+sample.ADMISSION_NO,'Programme: '+sample.PROGRAMME,'House: '+sample.HOUSE,'Residential: '+sample.RESIDENTIAL,'Year: '+sample.ACADEMIC_YEAR].join('\n')); q.make(); const cells=q.getModuleCount(); const cell=Math.max(2,Math.round(108/(cells+8))); qurl=q.createDataURL(cell,cell*4); } }catch(e){}
  body=body.replace(/\{QR_CODE\}/g, qurl?'<img src="'+qurl+'" style="width:108px;height:108px" alt="QR code">':'[QR]').replace(/\{([A-Z_]+)\}/g,(m,k)=>k in sample?sample[k]:m);
  const w=window.open('','_blank'); if(!w){toast('Allow pop-ups to preview');return;}
  const previewFont=(tplCur==='records')?"'Times New Roman',Times,serif":'Georgia,serif';
  const crest=(typeof SCHOOL_CREST!=='undefined'&&SCHOOL_CREST)||(SB_SCHOOL&&SB_SCHOOL.crest_url)||'';
  const wm=crest?'<div class="qa-wm"><img src="'+crest+'" alt=""></div>':'';
  const recCss='@page{size:A4;margin:12.7mm}.sec-h{background:#1557B0;color:#fff;font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:5px 6px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.rn{color:#999;font-weight:600;margin-right:4px}'
    +(tplCur==='records'?'.tpl-editor{line-height:1.3}.tpl-editor h2{font-size:14px;margin:6px 0}.tpl-editor p{margin:4px 0;font-size:12.5px}.tpl-editor table{margin:6px 0}.tpl-editor td{padding:3px 6px;font-size:12px}@media print{tr{page-break-inside:avoid}}':'');
  w.document.write('<html><head><title>Preview</title><style>*{box-sizing:border-box}body{margin:0;background:#e9eef0;color:#14201c;font-family:'+previewFont+'}.tpl-preview-shell{padding:26px;display:flex;justify-content:center}.tpl-editor{position:relative;width:100%;max-width:794px;min-height:560px;background:#fff;box-shadow:0 2px 14px -4px rgba(0,0,0,.25);padding:48px 56px;font-family:'+previewFont+';font-size:14px;line-height:1.6;color:#14201c}.tpl-editor h1{font-size:20px;text-align:center;margin-bottom:2px}.tpl-editor .sub{text-align:center;color:#555;font-size:13px;margin-bottom:24px}.tpl-editor h2{font-size:16px;border-bottom:2px solid #1557B0;padding-bottom:4px}.tpl-editor img{max-width:100%}.tpl-editor table{width:100%;border-collapse:collapse;margin:12px 0}.tpl-editor td{padding:6px 4px;border-bottom:1px solid #eee;font-size:14px}.tpl-editor .lbl{color:#666;width:200px}.tpl-move-zone{position:relative;min-height:54px}.tpl-move-zone.header-zone{min-height:84px}.tpl-float-object{position:absolute;z-index:4}.tpl-textbox{min-width:120px;max-width:100%;white-space:pre-wrap}.tpl-line-object{cursor:default}.qa-wm{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:62%;max-width:520px;z-index:0;pointer-events:none;opacity:.2;-webkit-print-color-adjust:exact;print-color-adjust:exact}.qa-wm img{width:100%;height:auto;display:block}body>*{position:relative;z-index:1}'+recCss+'@media print{body{background:#fff}.tpl-preview-shell{padding:0}.tpl-editor{box-shadow:none;max-width:none;min-height:auto}.qa-wm{opacity:.2}}</style></head><body>'+wm+'<div class="tpl-preview-shell"><div class="tpl-editor">'+body+'</div></div><p style="margin:0 0 30px;text-align:center;color:#888;font-size:12px">PREVIEW · sample data</p></body></html>');
  w.document.close();
}
let schoolUsers=[];
function houseName(uid){ const h=(houses||[]).find(x=>x._id===uid); return h?h.name:'a house'; }
function houseSelectHTML(cur){ return `<select id="u_house"><option value="">All houses (no restriction)</option>`+(houses||[]).map(h=>`<option value="${h._id}" ${cur===h._id?'selected':''}>${escapeHtml(h.name)}</option>`).join('')+`</select>`; }
function isPermCoAdmin(p){ return !!(p&&p.co_admin); }
function permSummary(p){
  if(p==null) return '<span class="pill open">Full access (owner)</span>';
  if(isPermCoAdmin(p)) return '<span class="pill open">Co-admin</span>';
  const on=ALL_CAPS.filter(([k])=>p[k]).map(([k,l])=>l);
  let out=on.length?(on.length>=ALL_CAPS.length?'<span class="pill open">All privileges</span>':on.map(l=>`<span class="pill" style="background:var(--surface-2);color:var(--ink-soft);margin:1px 2px">${l}</span>`).join('')):'<span style="color:var(--muted)">No access yet</span>';
  if(p.house) out+=` <span class="pill" style="background:var(--primary-soft);color:var(--primary);margin:1px 2px">🏠 ${escapeHtml(houseName(p.house))} only</span>`;
  return out;
}
async function renderUsers(){
  const nm=$('usersSchoolName'); if(nm&&SB_SCHOOL)nm.textContent=SB_SCHOOL.name;
  const tb=$('userRows'); if(!tb)return;
  tb.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:16px">Loading…</td></tr>';
  if(!SB_SCHOOL){tb.innerHTML=emptyRow(5,'No school loaded.');return;}
  const {data,error}=await sb.from('profiles').select('id,full_name,email,role,permissions,created_at').eq('school_id',SB_SCHOOL.id).order('created_at');
  if(error){tb.innerHTML=emptyRow(5,'Could not load users.');return;}
  schoolUsers=data||[];
  tb.innerHTML=schoolUsers.length?schoolUsers.map(u=>{
    const me=u.id===SB_UID; const owner=u.permissions==null; const coAdmin=isPermCoAdmin(u.permissions); const locked=owner||coAdmin;
    const acts=me?'<span style="color:var(--muted);font-size:12px">You</span>':
      `<div class="row-actions"><button class="act" data-qa-onclick="openUserPerms('${u.id}')" ${locked?'disabled title="'+(owner?'Owner has full access':'Co-admin access is managed from the owner account')+'"':''}>Privileges</button><button class="act" data-qa-onclick="resetUserPwd('${u.id}')">Reset</button><button class="act danger" data-qa-onclick="deleteUser('${u.id}')">Delete</button></div>`;
    return `<tr><td class="nm">${safeHtml(u.full_name,'&mdash;')}${me?' <span class="pill current-user-badge" title="Current user" aria-label="Current user">Me</span>':''}</td><td class="mono">${safeHtml(u.email,'&mdash;')}</td><td>${permSummary(u.permissions)}</td><td class="mono">${safeHtml((u.created_at||'').slice(0,10))}</td><td>${acts}</td></tr>`;
  }).join(''):emptyRow(5,'No users yet. Add one to let staff sign in.');
}
function toggleUserCreateMode(){
  const mode=val('u_access');
  const staffWrap=$('u_staff_wrap');
  const help=$('u_access_help');
  const isCoAdmin=mode==='co_admin';
  if(staffWrap) staffWrap.style.display=isCoAdmin?'none':'';
  if(help) help.textContent=isCoAdmin
    ? 'Co-admins can manage the school with elevated write access, while owner-only account controls stay with the main school admin.'
    : 'School users only see the areas you tick below, and those areas stay read-only for them.';
}
function permChecks(p){
  const main=`<div class="perm-grid">`+CAPS.map(([k,l])=>`<label class="perm-row"><input type="checkbox" data-perm="${k}" ${p&&p[k]?'checked':''}><span>${l}</span></label>`).join('')+`</div>`;
  const studentExtras=`<div class="perm-subgroup"><div class="perm-subtitle">Admissions -> View Students</div><div class="perm-grid">`+STUDENT_SUBCAPS.map(([k,l])=>`<label class="perm-row"><input type="checkbox" data-perm="${k}" ${p&&p[k]?'checked':''}><span>${l}</span></label>`).join('')+`</div></div>`;
  return main+studentExtras;
}
function collectPerms(scopeId){ const o={}; document.querySelectorAll('#'+scopeId+' input[data-perm]').forEach(c=>{o[c.dataset.perm]=c.checked;}); return o; }
function permToggleAll(on){ document.querySelectorAll('#u_perms input[data-perm]').forEach(c=>c.checked=on); }
function secureTemporaryPassword(length){
  const c='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes=new Uint8Array(Math.max(Number(length)||12,8));
  crypto.getRandomValues(bytes);
  return Array.from(bytes,function(byte){return c[byte%c.length];}).join('');
}
function genPass2(){const el=$('u_pass');if(el)el.value=secureTemporaryPassword(12);}
function openCreateUser(){
  const m=$('modal');
  m.innerHTML=`<div class="modal-head"><div><h2>Add school user</h2><p>Creates a login for ${safeHtml(SB_SCHOOL?SB_SCHOOL.name:'this school')}</p></div><button class="modal-x" data-qa-onclick="closeModal()">×</button></div>
  <div class="modal-body">
    <div class="grid-2"><div class="field"><label>Full name</label><input id="u_name" placeholder="Full name"></div><div class="field"><label>Email</label><input id="u_email" type="email" placeholder="name@email"></div></div>
    <div class="field"><label>Temporary password</label><div style="display:flex;gap:8px"><input id="u_pass" type="text" placeholder="At least 8 characters" style="flex:1"><button class="btn btn-ghost btn-sm" type="button" data-qa-onclick="genPass2()">Generate</button></div><div style="font-size:11.5px;color:var(--muted);margin-top:5px">Share it with the user; they can change it after signing in.</div></div>
    <div class="field"><label>Account access</label><select id="u_access" data-qa-onchange="toggleUserCreateMode()"><option value="staff">School user (read-only)</option><option value="co_admin">Co-admin</option></select><div id="u_access_help" style="font-size:11.5px;color:var(--muted);margin-top:5px">School users only see the areas you tick below, and those areas stay read-only for them.</div></div>
    <div id="u_staff_wrap">
      <div class="field"><label style="display:flex;justify-content:space-between;align-items:center">Privileges <span><button type="button" class="act" data-qa-onclick="permToggleAll(true)">All</button> <button type="button" class="act" data-qa-onclick="permToggleAll(false)">None</button></span></label><div id="u_perms">${permChecks({})}</div><div style="font-size:11.5px;color:var(--muted);margin-top:5px">Only the areas you tick will be visible to this user.</div></div>
      <div class="field"><label>Restrict to one house (optional)</label>${houseSelectHTML('')}<div style="font-size:11.5px;color:var(--muted);margin-top:5px">For a house master: they will only see this house and its students.</div></div>
    </div>
  </div>
  <div class="modal-foot"><button class="btn btn-ghost" data-qa-onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="u_btn" data-qa-onclick="createUser()">Create user</button></div>`;
  $('overlay').classList.add('show','user-account-editor');
  requestAnimationFrame(positionManageStudentEditor);
  toggleUserCreateMode();
}
async function createUser(){
  if(roGuard())return;
  const email=(val('u_email')||'').trim(), name=(val('u_name')||'').trim(), pass=val('u_pass')||'';
  if(!email||!pass){toast('Email and a temporary password are required');return;}
  if(pass.length<8){toast('Password must be at least 8 characters');return;}
  const access=val('u_access')||'staff';
  const permissions=access==='co_admin'?{co_admin:true}:collectPerms('u_perms'); const hv=(val('u_house')||''); if(access!=='co_admin'&&hv) permissions.house=hv;
  const btn=$('u_btn'); if(btn)btn.textContent='Creating…';
  const {data,error}=await invokeFnDetailed('create-school-admin',{email,password:pass,full_name:name,permissions,account_type:access});
  if(btn)btn.textContent='Create user';
  if(error||(data&&data.error)){toast('Could not create: '+((data&&data.message)||(error&&error.message)||'error'));return;}
  closeModal(); renderUsers();
  toast(name+' can now sign in with '+email);
}
function openUserPerms(id){
  const u=schoolUsers.find(x=>x.id===id); if(!u)return;
  if(u.permissions==null){toast('This is the owner account — it has full access.');return;}
  if(isPermCoAdmin(u.permissions)){toast('This co-admin already has full school access.');return;}
  const m=$('modal');
  m.innerHTML=`<div class="modal-head"><div><h2>Privileges</h2><p>${safeHtml(u.full_name||u.email)}</p></div><button class="modal-x" data-qa-onclick="closeModal()">×</button></div>
  <div class="modal-body">
    <div class="field"><label style="display:flex;justify-content:space-between;align-items:center">Allowed areas <span><button type="button" class="act" data-qa-onclick="qaSetAllUserPermissionChecks(true)">All</button> <button type="button" class="act" data-qa-onclick="qaSetAllUserPermissionChecks(false)">None</button></span></label><div id="u_eperms">${permChecks(u.permissions||{})}</div><div style="font-size:11.5px;color:var(--muted);margin-top:5px">These permissions stay read-only for this staff account.</div></div>
    <div class="field"><label>Restrict to one house (optional)</label>${houseSelectHTML(u.permissions&&u.permissions.house||'')}<div style="font-size:11.5px;color:var(--muted);margin-top:5px">House master: they will only see this house and its students.</div></div>
  </div>
  <div class="modal-foot"><button class="btn btn-ghost" data-qa-onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="up_btn" data-qa-onclick="saveUserPerms('${id}')">Save privileges</button></div>`;
  $('overlay').classList.add('show','user-account-editor');
  requestAnimationFrame(positionManageStudentEditor);
}
async function saveUserPerms(id){
  if(roGuard())return;
  const permissions=collectPerms('u_eperms'); const hv=(val('u_house')||''); if(hv) permissions.house=hv;
  const btn=$('up_btn'); if(btn)btn.textContent='Saving…';
  const {data,error}=await invokeFnDetailed('manage-user',{action:'permissions',user_id:id,permissions});
  if(btn)btn.textContent='Save privileges';
  if(error||(data&&data.error)){toast('Could not save: '+((data&&data.message)||(error&&error.message)||'error'));return;}
  closeModal(); renderUsers(); toast('Privileges updated');
}
async function resetUserPwd(id){
  if(roGuard())return;
  const u=schoolUsers.find(x=>x.id===id); if(!u)return;
  const p=secureTemporaryPassword(12);
  if(!confirm('Reset password for '+(u.full_name||u.email)+'?\nNew password: '+p+'\n\nCopy it now — share it with the user.'))return;
  const {data,error}=await invokeFnDetailed('manage-user',{action:'password',user_id:id,password:p});
  if(error||(data&&data.error)){toast('Could not reset: '+((data&&data.message)||(error&&error.message)||'error'));return;}
  toast('Password reset to: '+p);
}
async function deleteUser(id){
  if(roGuard())return;
  const u=schoolUsers.find(x=>x.id===id); if(!u)return;
  if(!confirm('Delete '+(u.full_name||u.email)+'? This removes their login permanently.'))return;
  const {data,error}=await invokeFnDetailed('manage-user',{action:'delete',user_id:id});
  if(error||(data&&data.error)){toast('Could not delete: '+((data&&data.message)||(error&&error.message)||'error'));return;}
  renderUsers(); toast('User deleted');
}

/* legacy duplicate programme/house/class CRUD block removed; active handlers are defined below and route through manage-school-structure */
openProg=function(id){
  if(roGuard())return;
  const p=id?programmes.find(x=>x.id===id):{code:'',name:'',subjects:'',cap:100};
  crudModal(id?'Edit programme':'Add programme',
    `<div class="grid-2"><div class="field"><label>Code</label><input id="c_code" value="${escapeAttr(p.code)}"></div><div class="field"><label>Capacity</label><input id="c_cap" type="number" value="${escapeAttr(p.cap)}"></div></div>
     <div class="field"><label>Programme name</label><input id="c_name" value="${escapeAttr(p.name)}"></div>
     <div class="field"><label>Subjects <span class="hint">— comma separated</span></label><textarea id="c_sub">${escapeHtml(p.subjects)}</textarea></div>`,
    async ()=>{ const code=val('c_code').toUpperCase(),name=val('c_name'); if(!code||!name){toast('Code and name required');return;}
      const patch={code,name,subjects:val('c_sub'),capacity:+val('c_cap')||100};
      const {data,error}=await invokeFnDetailed('manage-school-structure',{action:'programme_save',school_id:SB_SCHOOL.id,id:id?p._id:null,patch});
      if(error||(data&&data.ok===false)){toast('Could not save programme: '+((data&&data.message)||(error&&error.message)||'error'));return;}
      const item=(data&&data.item)||null; if(!item){toast('Programme save returned no record');return;}
      if(id){ p.code=patch.code;p.name=patch.name;p.subjects=patch.subjects;p.cap=patch.capacity; }
      else { const nid=Math.max(0,...programmes.map(x=>x.id))+1; pMap[nid]=item.id; programmes.push({id:nid,_id:item.id,code:item.code,name:item.name,subjects:item.subjects||'',cap:item.capacity||100,enr:0}); }
      notifyStudentPortalRefresh('programme-save');
      closeModal(); renderProg(); fillSelects(); toast('Programme saved'); });
};
openHouse=function(id){
  if(roGuard())return;
  const h=id?houses.find(x=>x.id===id):{name:'',color:'#1557B0',motto:'',cap:100,priority:nextHousePriority(),gender:'',rtype:''};
  const priority=housePriorityValue(h,nextHousePriority());
  const gOpt=v=>((h.gender||'')===v?'selected':''); const rOpt=v=>((h.rtype||'')===v?'selected':'');
  crudModal(id?'Edit house':'Add house',
    `<div class="grid-2"><div class="field"><label>House name</label><input id="c_name" value="${escapeAttr(h.name)}"></div><div class="field"><label>Colour</label><input id="c_color" type="color" value="${escapeAttr(h.color)}"></div></div>
     <div class="grid-2"><div class="field"><label>Gender <span class="hint">— required</span></label><select id="c_gender" required><option value="" ${gOpt('')}>Select gender</option><option value="Male" ${gOpt('Male')}>Male</option><option value="Female" ${gOpt('Female')}>Female</option></select></div><div class="field"><label>Residential type <span class="hint">— required</span></label><select id="c_rtype" required><option value="" ${rOpt('')}>Select residential type</option><option value="Boarding" ${rOpt('Boarding')}>Boarding</option><option value="Day" ${rOpt('Day')}>Day</option></select></div></div>
     <div class="field"><label>Motto</label><input id="c_motto" value="${escapeAttr(h.motto||'')}"></div>
     <div class="grid-2"><div class="field" style="max-width:160px"><label>Priority order</label><input id="c_priority" type="number" min="1" step="1" value="${escapeAttr(priority)}"></div><div class="field" style="max-width:160px"><label>Capacity</label><input id="c_cap" type="number" value="${escapeAttr(h.cap)}"></div></div>`,
    async ()=>{ const name=val('c_name'); if(!name){toast('House name required');return;}
      const gender=val('c_gender'), rtype=val('c_rtype');
      if(!gender){toast('Please select the house gender');$('c_gender')&&$('c_gender').focus();return;}
      if(!rtype){toast('Please select Boarding or Day for this house');$('c_rtype')&&$('c_rtype').focus();return;}
      const priorityVal=Math.max(1,+val('c_priority')||0); if(!priorityVal){toast('Priority order must be 1 or higher');return;}
      const patch={name,color:val('c_color'),motto:val('c_motto'),capacity:+val('c_cap')||100,priority:priorityVal,gender,residential_type:rtype};
      const {data,error}=await invokeFnDetailed('manage-school-structure',{action:'house_save',school_id:SB_SCHOOL.id,id:id?h._id:null,patch});
      if(error||(data&&data.ok===false)){toast('Could not save house: '+((data&&data.message)||(error&&error.message)||'error'));return;}
      const item=(data&&data.item)||null; if(!item){toast('House save returned no record');return;}
      if(id){ h.name=name;h.color=patch.color;h.motto=patch.motto;h.cap=patch.capacity;h.priority=patch.priority;h.gender=patch.gender;h.rtype=patch.residential_type; }
      else { const nid=Math.max(0,...houses.map(x=>x.id))+1; hMap[nid]=item.id; houses.push({id:nid,_id:item.id,name:item.name,color:item.color,motto:item.motto,cap:item.capacity||100,priority:item.priority||priorityVal,occ:0,gender:item.gender||'',rtype:item.residential_type||''}); }
      notifyStudentPortalRefresh('house-save');
      closeModal(); renderHouses(); fillSelects&&fillSelects(); toast('House saved'); });
};
openClass=function(id){
  if(roGuard())return;
  const c=id?classes.find(x=>x.id===id):{name:'',code:'',cap:50,progId:'',subjects:''};
  const pOpts='<option value="">Select programme</option>'+programmes.map(p=>`<option value="${p.id}" ${String(c.progId)===String(p.id)?'selected':''}>${escapeHtml(p.name)}</option>`).join('');
  crudModal(id?'Edit class':'Add class',
    `<div class="grid-2"><div class="field"><label>Class name</label><input id="c_name" value="${escapeAttr(c.name)}"></div><div class="field"><label>Code</label><input id="c_code" value="${escapeAttr(c.code||'')}"></div></div>
     <div class="field"><label>Programme <span class="hint">— required</span></label><select id="c_prog" required>${pOpts}</select></div>
     <div class="field"><label>Subject combination <span class="hint">— comma separated; shown to students when picking this class</span></label><textarea id="c_sub" rows="3" placeholder="e.g. Core Maths, English, Integrated Science, Physics, Chemistry, Biology, Elective Maths">${escapeHtml(c.subjects||'')}</textarea></div>
     <div class="field" style="max-width:160px"><label>Capacity</label><input id="c_cap" type="number" value="${escapeAttr(c.cap)}"></div>`,
    async ()=>{ const name=val('c_name'); if(!name){toast('Class name required');return;}
      const progNum=val('c_prog'); if(!progNum){toast('Please select a programme'); $('c_prog')&&$('c_prog').focus(); return;} const progUuid=progNum?pMap[progNum]:null; const subj=val('c_sub')||null;
      const patch={name,code:val('c_code'),capacity:+val('c_cap')||50,programme_id:progUuid,subjects:subj};
      const {data,error}=await invokeFnDetailed('manage-school-structure',{action:'class_save',school_id:SB_SCHOOL.id,id:id?c._id:null,patch});
      if(error||(data&&data.ok===false)){toast('Could not save class: '+((data&&data.message)||(error&&error.message)||'error'));return;}
      const item=(data&&data.item)||null; if(!item){toast('Class save returned no record');return;}
      if(id){ c.name=name;c.code=patch.code;c.cap=patch.capacity;c.progId=progNum?+progNum:'';c.subjects=subj||''; }
      else { const nid=Math.max(0,...classes.map(x=>x.id))+1; cMap[nid]=item.id; classes.push({id:nid,_id:item.id,name:item.name,code:item.code,cap:item.capacity||50,occ:0,progId:progNum?+progNum:'',subjects:item.subjects||''}); }
      notifyStudentPortalRefresh('class-save');
      closeModal(); renderClasses(); fillSelects&&fillSelects(); toast('Class saved'); });
};
delItem=async function(type,id){
  const map={prog:[programmes,'Programme'],house:[houses,'House'],class:[classes,'Class']};
  const entry=map[type]; if(!entry)return;
  const [arr,label]=entry; const item=arr.find(x=>x.id===id); if(!item)return;
  if(!confirm('Delete '+(item.name||item.code)+'?'))return;
  const {data,error}=await invokeFnDetailed('manage-school-structure',{action:'delete',school_id:SB_SCHOOL.id,type,id:item._id});
  if(error||(data&&data.ok===false)){toast('Could not delete '+label.toLowerCase()+': '+((data&&data.message)||(error&&error.message)||'error'));return;}
  arr.splice(arr.indexOf(item),1);
  notifyStudentPortalRefresh(type+'-delete');
  if(type==='prog')renderProg(); if(type==='house')renderHouses(); if(type==='class')renderClasses();
  fillSelects(); toast(label+' deleted');
};

addPlacement=async function(){
  if(roGuard())return;
  if(!SB_SCHOOL){toast('School not loaded yet');return;}
  // All fields are required
  const i=val('pl_index').trim(), n=val('pl_name').trim(), g=val('pl_gender'),
        res=val('pl_res'), prog=val('pl_prog'), agg=val('pl_agg').trim(),
        dob=val('pl_dob'), sms=val('pl_sms').trim();
  if(!i||!n||!g||!res||!prog||!agg||!dob||!sms){toast('All fields are required');return;}
  const existed=placement.some(x=>x.index===i);
  // Route through import_placement so an existing index is REPLACED across
  // placement list, admission list and student portal.
  const row={index_number:i,student_name:n,gender:g,residential_status:res,
             programme:prog,aggregate:agg,dob:dob,sms_contact:sms};
  const {data,error}=await sb.rpc('import_placement',{p_school:SB_SCHOOL.id,p_rows:[row]});
  if(error){toast('Could not save: '+error.message);return;}
  if(!data||!data.ok){toast('Could not save: '+((data&&data.error)||'unknown'));return;}
  const {data:plcData}=await sb.from('placement_list').select('index_number,student_name,gender,residential_status,programme,aggregate,jhs_attended,dob,sms_contact,enrolment_code,logged_in').eq('school_id',SB_SCHOOL.id).order('index_number',{ascending:true}).range(0,4999);
  placement=(plcData||[]).map(p=>({index:p.index_number,name:p.student_name,gender:p.gender||'',res:p.residential_status||'',prog:p.programme,agg:p.aggregate,jhs:p.jhs_attended||'',dob:p.dob||'',sms:p.sms_contact||'',code:p.enrolment_code,loggedIn:p.logged_in})); placementTotalCount=placement.length; PLACEMENT_STATE.loaded=true;
  ['pl_index','pl_name','pl_gender','pl_res','pl_agg','pl_dob','pl_sms'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  notifyStudentPortalRefresh('placement-save',{index:i});
  renderPlacement(); closePop('manualPop');
  toast(existed?('Student '+i+' updated — information replaced'):'Placement record added');
};

async function logout(){ if(!confirm('Log out of the admin portal?'))return; setSchoolAdminTabSessionActive(false); try{ await sb.auth.signOut(); }catch(e){} location.reload(); }


function qaToggleSchoolAdminPassword(button) {
  const password = document.getElementById('ag_pass');
  if (!password) return;
  password.type = password.type === 'password' ? 'text' : 'password';
  button.textContent = password.type === 'password' ? 'Show' : 'Hide';
}
function qaTplFormatAndReset(select) {
  tplFormat(select.value);
  select.value = '';
}
function qaOpenTplImagePicker() {
  const input = document.getElementById('tplImgInput');
  if (input) input.click();
}
function qaSetDocLineValue(index, value) {
  docLines[index] = value;
}
function qaSetAllUserPermissionChecks(checked) {
  document.querySelectorAll('#u_eperms input[data-perm]').forEach(function (input) {
    input.checked = checked;
  });
}
