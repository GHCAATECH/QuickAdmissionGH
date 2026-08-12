/* ================= SUPABASE INTEGRATION (super admin) ================= */
const SB_URL='https://datxaylostmyroleisdl.supabase.co';
const SB_KEY='sb_publishable_c9WlfiojT_wz4uesb3lYaw_91QoIErh';
function superAuthScope(){
  try{ if(window.parent&&window.parent!==window&&window.parent.name) return window.parent.name; }catch(e){}
  try{ return window.name||'qag_tab_fallback'; }catch(e){ return 'qag_tab_fallback'; }
}
function superAuthKey(k){
  return 'qag_auth_scope::'+superAuthScope()+'::'+k;
}
function clearLegacySuperAuthStorage(){
  try{
    const prefix='qag_auth_scope::'+superAuthScope()+'::';
    for(let i=window.localStorage.length-1;i>=0;i--){
      const k=window.localStorage.key(i);
      if(k&&k.indexOf(prefix)===0&&k.indexOf('qag-super-auth')>-1){
        window.localStorage.removeItem(k);
      }
    }
  }catch(e){}
}
const superAuthStorage={
  getItem:function(k){ try{ return window.sessionStorage.getItem(superAuthKey(k)); }catch(e){ return null; } },
  setItem:function(k,v){ try{ window.sessionStorage.setItem(superAuthKey(k),v); }catch(e){} },
  removeItem:function(k){ try{ window.sessionStorage.removeItem(superAuthKey(k)); }catch(e){} }
};
clearLegacySuperAuthStorage();
const sb=window.supabase&&typeof window.supabase.createClient==='function'
  ?window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'qag-super-auth',storage:superAuthStorage}})
  :null;
const SUPER_AUTH_BOOT_TIMEOUT_MS=8000;
function superAuthTimeout(promise,message,timeoutMs){
  return Promise.race([
    promise,
    new Promise(function(_,reject){
      setTimeout(function(){reject(new Error(message||'The secure session check timed out.'));},timeoutMs||SUPER_AUTH_BOOT_TIMEOUT_MS);
    })
  ]);
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
  if(!tok) return {data:null,error:{message:'Your session expired - please sign in again.'}};
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
const sval=id=>document.getElementById(id).value;
const sa_init=n=>{const w=(n||'').replace(/[^A-Za-z ]/g,'').split(' ').filter(Boolean);return ((w[0]&&w[0][0]||'S')+(w[1]&&w[1][0]||(w[0]&&w[0][1])||'C')).toUpperCase();};
const sa_cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;
const sa_time=ts=>{ if(!ts)return '-'; const d=new Date(ts),n=new Date(),m=Math.floor((n-d)/60000);
  return m<1?'just now':m<60?m+' min ago':m<1440?Math.floor(m/60)+' hr ago':Math.floor(m/1440)+'d ago'; };
const normalizeSchoolCodeDraft=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9 ]/g,'').replace(/\s+/g,' ').replace(/^\s+/,'').slice(0,11);
const normalizeSchoolCodeInput=v=>normalizeSchoolCodeDraft(v).trim();
const schoolSenderCode=s=>normalizeSchoolCodeInput((s&&((s.schoolCode||s.school_code||s.code)))||'');
const schoolAdminCodeHandle=code=>normalizeSchoolCodeInput(code).replace(/\s+/g,'_').toLowerCase();
const RESERVED_SCHOOL_SUBDOMAINS=new Set(['www','admin','api','mail','ftp','support','staging','app','dashboard','cdn','static','assets','auth','login','portal','superadmin','super-admin','school-admin']);
const normalizeSchoolSubdomain=v=>String(v||'').toLowerCase().replace(/[^a-z0-9-]/g,'').replace(/^-+/,'').slice(0,63);
const schoolPortalUrl=s=>s&&s.subdomain?'https://'+s.subdomain+'.quickadmissiongh.com/':'';
function schoolSubdomainExists(subdomain,excludeId){
  const normalized=normalizeSchoolSubdomain(subdomain);
  return !!normalized&&schools.some(s=>String(s._id||s.id)!==String(excludeId||'')&&normalizeSchoolSubdomain(s.subdomain)===normalized);
}
function schoolSubdomainErrorMessage(subdomain){
  const normalized=normalizeSchoolSubdomain(subdomain);
  if(!normalized)return 'Portal subdomain is required.';
  if(!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized))return 'Use letters, numbers, or hyphens, without a hyphen at either end.';
  if(RESERVED_SCHOOL_SUBDOMAINS.has(normalized))return 'That portal subdomain is reserved. Choose another one.';
  return '';
}
function bindSchoolSubdomainInput(inputId,codeInputId){
  const input=document.getElementById(inputId);
  if(!input)return;
  const codeInput=codeInputId?document.getElementById(codeInputId):null;
  const suggest=function(){
    if(!input.value&&codeInput)input.value=normalizeSchoolSubdomain(codeInput.value);
  };
  input.addEventListener('input',function(){input.value=normalizeSchoolSubdomain(input.value);});
  input.addEventListener('blur',function(){suggest();input.value=normalizeSchoolSubdomain(input.value);});
  if(codeInput)codeInput.addEventListener('blur',suggest);
  suggest();
}
function schoolCodeExists(code,excludeId){
  const normalized=normalizeSchoolCodeInput(code);
  if(!normalized) return false;
  return schools.some(s=>String(s._id||s.id)!==String(excludeId||'') && schoolSenderCode(s)===normalized);
}
function bindSchoolCodeInput(inputId,usernameId){
  const input=document.getElementById(inputId);
  if(!input) return;
  const sync=function(finalize){
    const next=finalize?normalizeSchoolCodeInput(input.value):normalizeSchoolCodeDraft(input.value);
    if(input.value!==next) input.value=next;
    const un=usernameId?document.getElementById(usernameId):null;
    if(un){
      const handle=schoolAdminCodeHandle(next);
      un.value=handle?handle+'_admin':'';
    }
  };
  input.addEventListener('input',()=>sync(false));
  input.addEventListener('blur',()=>sync(true));
  sync(true);
}
function schoolCodeErrorMessage(code){
  const normalized=normalizeSchoolCodeInput(code);
  if(!normalized) return 'School Code / SMS Sender ID is required.';
  if(!/^[A-Z0-9]+(?: [A-Z0-9]+)*$/.test(normalized)) return 'Use only letters, numbers, and spaces, up to 11 characters.';
  return '';
}
function saNormalizePhone(value){
  const digits=String(value||'').replace(/\D/g,'');
  if(!digits) return '';
  if(digits.startsWith('233') && digits.length===12) return digits;
  if(digits.startsWith('0') && digits.length===10) return '233'+digits.slice(1);
  if(digits.length===9) return '233'+digits;
  return digits;
}
function saStudentSms(row){
  const rec=(row&&row.records&&typeof row.records==='object')?row.records:{};
  return saNormalizePhone((rec&&rec.sms_contact)||row.parent_phone||row.smsRaw||row.sms||'');
}
function smsTargets(){
  const t=$('smsTarget').value; const g=$('smsGroup').value;
  let pool=students.filter(s=>!!saStudentSms(s));
  if(t!=='all') pool=pool.filter(s=>String(s.schoolId)===String(t));
  if(g!=='all') pool=pool.filter(s=>String(s.status)===String(g));
  return pool;
}

/* ---- AUTH GATE ---- */
let superAdminLoginPending=false;
let superAdminRecoveryPending=false;
let superAdminRecoveryMode=isSuperAdminRecoveryUrl();
function isSuperAdminRecoveryUrl(){
  try{
    const query=new URLSearchParams(window.location.search||'');
    const hash=new URLSearchParams(String(window.location.hash||'').replace(/^#/,''));
    return query.get('type')==='recovery'||hash.get('type')==='recovery'||query.has('code');
  }catch(e){ return false; }
}
function superAdminRecoveryRedirectUrl(){
  try{
    const url=new URL(window.location.href);
    if(url.protocol!=='http:'&&url.protocol!=='https:')return 'https://www.quickadmissiongh.com/admin/super-admin';
    url.search='';
    url.hash='';
    url.pathname=url.pathname.replace(/\.html$/i,'');
    return url.toString();
  }catch(e){ return 'https://www.quickadmissiongh.com/admin/super-admin'; }
}
function cleanSuperAdminRecoveryUrl(){
  try{
    const url=new URL(window.location.href);
    url.search='';
    url.hash='';
    window.history.replaceState({},document.title,url.pathname+url.search+url.hash);
  }catch(e){}
}
function showSuperAdminAuthView(view){
  const views={login:'adminLoginView',request:'adminRecoveryRequestView',update:'adminRecoveryUpdateView'};
  Object.keys(views).forEach(function(key){
    const el=document.getElementById(views[key]);
    if(el)el.hidden=key!==view;
  });
  const status=document.getElementById('ag_session_status_text');
  if(status)status.textContent=view==='request'?'Password recovery':view==='update'?'Secure password reset':'Secure session ready';
}
function setSuperAdminRecoveryMessage(id,message,isError){
  const el=document.getElementById(id);
  if(!el)return;
  el.textContent=message||'';
  el.classList.toggle('is-error',!!isError);
  el.style.display=message?'block':'none';
}
function setSuperAdminLoginNotice(message,isSuccess){
  const el=document.getElementById('ag_err');
  if(!el)return;
  el.textContent=message||'';
  el.classList.toggle('is-success',!!isSuccess);
  el.style.display=message?'block':'none';
}
function openSuperAdminRecoveryRequest(){
  const email=document.getElementById('ag_email');
  const recoveryEmail=document.getElementById('ag_recovery_email');
  if(recoveryEmail&&email)recoveryEmail.value=email.value.trim();
  setSuperAdminRecoveryMessage('ag_recovery_msg','',false);
  showSuperAdminAuthView('request');
  if(recoveryEmail)recoveryEmail.focus();
}
async function requestSuperAdminPasswordReset(){
  const input=document.getElementById('ag_recovery_email');
  const btn=document.getElementById('ag_recovery_btn');
  if(superAdminRecoveryPending||!input||!btn)return;
  const email=input.value.trim();
  if(!email||!input.checkValidity()){
    setSuperAdminRecoveryMessage('ag_recovery_msg','Enter a valid email address.',true);
    input.focus();
    return;
  }
  if(!sb){
    setSuperAdminRecoveryMessage('ag_recovery_msg','The secure login service did not load. Check your connection and reload the page.',true);
    return;
  }
  superAdminRecoveryPending=true;
  btn.disabled=true;
  btn.textContent='SENDING LINK...';
  setSuperAdminRecoveryMessage('ag_recovery_msg','',false);
  try{
    const result=await superAuthTimeout(
      sb.auth.resetPasswordForEmail(email,{redirectTo:superAdminRecoveryRedirectUrl()}),
      'Sending the reset link timed out. Check your connection and try again.'
    );
    if(result.error)throw result.error;
    setSuperAdminRecoveryMessage('ag_recovery_msg','If this email belongs to a super-admin account, a reset link has been sent. Check the inbox and spam folder.',false);
  }catch(e){
    setSuperAdminRecoveryMessage('ag_recovery_msg',(e&&e.message)||'Could not send the reset link. Please try again.',true);
  }finally{
    superAdminRecoveryPending=false;
    btn.disabled=false;
    btn.textContent='SEND RESET LINK';
  }
}
async function updateSuperAdminPassword(){
  const password=document.getElementById('ag_new_pass');
  const confirmPassword=document.getElementById('ag_confirm_pass');
  const btn=document.getElementById('ag_reset_btn');
  if(superAdminRecoveryPending||!password||!confirmPassword||!btn)return;
  if(password.value.length<10||!/[a-z]/.test(password.value)||!/[A-Z]/.test(password.value)||!/[0-9]/.test(password.value)||!(/[^A-Za-z0-9]/.test(password.value))){
    setSuperAdminRecoveryMessage('ag_reset_msg','Use at least 10 characters with upper and lowercase letters, a number and a symbol.',true);
    password.focus();
    return;
  }
  if(password.value!==confirmPassword.value){
    setSuperAdminRecoveryMessage('ag_reset_msg','The two passwords do not match.',true);
    confirmPassword.focus();
    return;
  }
  if(!sb){
    setSuperAdminRecoveryMessage('ag_reset_msg','The secure login service did not load. Check your connection and reload the page.',true);
    return;
  }
  superAdminRecoveryPending=true;
  btn.disabled=true;
  btn.textContent='UPDATING PASSWORD...';
  setSuperAdminRecoveryMessage('ag_reset_msg','',false);
  try{
    const sessionResult=await superAuthTimeout(sb.auth.getSession(),'The reset session check timed out.');
    if(sessionResult.error||!sessionResult.data||!sessionResult.data.session)throw new Error('This reset link is invalid or has expired. Request a new link.');
    const result=await superAuthTimeout(sb.auth.updateUser({password:password.value}),'Updating the password timed out. Please try again.');
    if(result.error)throw result.error;
    try{await superAuthTimeout(sb.auth.signOut(),'Session cleanup timed out.',3000);}catch(ignore){}
    superAdminRecoveryMode=false;
    cleanSuperAdminRecoveryUrl();
    password.value='';
    confirmPassword.value='';
    showSuperAdminAuthView('login');
    setSuperAdminLoginNotice('Password updated successfully. Sign in with your new password.',true);
    const email=document.getElementById('ag_email');
    if(email)email.focus();
  }catch(e){
    setSuperAdminRecoveryMessage('ag_reset_msg',(e&&e.message)||'Could not update the password. Request a new reset link.',true);
  }finally{
    superAdminRecoveryPending=false;
    btn.disabled=false;
    btn.textContent='UPDATE PASSWORD';
  }
}
async function cancelSuperAdminRecovery(){
  try{if(sb)await superAuthTimeout(sb.auth.signOut(),'Session cleanup timed out.',3000);}catch(e){}
  superAdminRecoveryMode=false;
  cleanSuperAdminRecoveryUrl();
  showSuperAdminAuthView('login');
  setSuperAdminLoginNotice('',false);
}
function revealSuperAdminLogin(message){
  const gate=document.getElementById('authGate');
  const app=document.querySelector('.app');
  if(!gate)return;
  document.body.classList.remove('auth-booting');
  document.body.classList.add('auth-gate-visible');
  if(app)app.style.display='none';
  gate.style.display='flex';
  const status=document.getElementById('ag_session_status_text');
  if(status)status.textContent=message||'Secure session ready';
}
(function buildGate(){
  document.body.classList.add('auth-gate-visible');
  document.querySelector('.app').style.display='none';
  const ov=document.createElement('div'); ov.id='authGate';
  ov.style.cssText='position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center';
  ov.innerHTML=`<main class="qa-login-shell">
    <section class="qa-brand-panel">
      <div class="qa-brand-top">
        <div class="qa-brand-mark" aria-hidden="true">★</div>
        <h1>Oversee admissions with confidence.</h1>
        <p>Access the platform dashboard securely to manage schools, administrators, finance claims, SMS activity and system-wide reports.</p>
        <div class="qa-security-list">
          <div class="qa-security-item"><span class="qa-security-icon">✓</span>Secure super-admin access</div>
          <div class="qa-security-item"><span class="qa-security-icon">⚙</span>Full platform management</div>
          <div class="qa-security-item"><span class="qa-security-icon">▥</span>Finance and school insights</div>
        </div>
      </div>
      <div class="qa-brand-bottom"><div class="qa-powered"><div class="qa-powered-logo">AB</div><div><small>Powered by</small><br>AXIOMBYTE HUB</div></div></div>
    </section>
    <section class="qa-login-panel">
      <div class="qa-login-card">
        <div class="qa-session-status"><span class="qa-pulse"></span><span id="ag_session_status_text">Secure session ready</span></div>
        <div id="adminLoginView">
          <h2>Super Admin Login</h2>
          <p>Use the email address and password assigned to your platform super-admin account.</p>
          <form id="superAdminLoginForm">
            <div class="qa-field">
              <label for="ag_email">Email address</label>
              <div class="qa-input-wrap"><span class="qa-input-icon">&#9993;</span><input type="email" id="ag_email" class="qa-form-control" placeholder="you@admin.gh" autocomplete="username" required></div>
            </div>
            <div class="qa-field">
              <label for="ag_pass">Password</label>
              <div class="qa-input-wrap"><span class="qa-input-icon">&#9679;</span><input type="password" id="ag_pass" class="qa-form-control" placeholder="Enter your password" autocomplete="current-password" required><button type="button" class="qa-toggle-password" id="ag_toggle">Show</button></div>
            </div>
            <div class="qa-forgot-row"><button type="button" class="qa-text-action" id="ag_forgot_open">Forgot password?</button></div>
            <div id="ag_err" style="display:none;color:#B23A3A;font-size:12.5px;font-weight:700;margin-bottom:10px"></div>
            <button type="submit" class="qa-login-btn" id="ag_btn">LOGIN &rarr;</button>
          </form>
          <div class="qa-access-note"><strong>Need access?</strong>Contact the platform owner to create or reconnect your super-admin login.</div>
        </div>
        <div id="adminRecoveryRequestView" hidden>
          <h2>Reset password</h2>
          <p>Enter your super-admin email address. We will send a secure password reset link to it.</p>
          <form id="adminRecoveryRequestForm" novalidate>
            <div class="qa-field">
              <label for="ag_recovery_email">Email address</label>
              <div class="qa-input-wrap"><span class="qa-input-icon">&#9993;</span><input type="email" id="ag_recovery_email" class="qa-form-control" placeholder="you@admin.gh" autocomplete="email" required></div>
            </div>
            <div id="ag_recovery_msg" class="qa-recovery-message" role="status" aria-live="polite"></div>
            <button type="submit" class="qa-login-btn" id="ag_recovery_btn">SEND RESET LINK</button>
          </form>
          <button type="button" class="qa-text-action qa-recovery-back" id="ag_recovery_back">&larr; Back to login</button>
        </div>
        <div id="adminRecoveryUpdateView" hidden>
          <h2>Choose a new password</h2>
          <p>Use at least 10 characters, including upper and lowercase letters, a number and a symbol.</p>
          <form id="adminPasswordResetForm" novalidate>
            <div class="qa-field">
              <label for="ag_new_pass">New password</label>
              <div class="qa-input-wrap"><span class="qa-input-icon">&#9679;</span><input type="password" id="ag_new_pass" class="qa-form-control" placeholder="At least 10 characters" autocomplete="new-password" minlength="10" required></div>
            </div>
            <div class="qa-field">
              <label for="ag_confirm_pass">Confirm new password</label>
              <div class="qa-input-wrap"><span class="qa-input-icon">&#9679;</span><input type="password" id="ag_confirm_pass" class="qa-form-control" placeholder="Repeat the new password" autocomplete="new-password" minlength="10" required></div>
            </div>
            <div id="ag_reset_msg" class="qa-recovery-message" role="status" aria-live="polite"></div>
            <button type="submit" class="qa-login-btn" id="ag_reset_btn">UPDATE PASSWORD</button>
          </form>
          <button type="button" class="qa-text-action qa-recovery-back" id="ag_reset_cancel">Cancel and return to login</button>
        </div>
        <a href="../index.html" class="qa-back-link">← Return to admission portal</a>
      </div>
    </section>
  </main>`;
  document.body.appendChild(ov);
  document.getElementById('superAdminLoginForm').addEventListener('submit',function(e){e.preventDefault();superLogin();});
  document.getElementById('ag_toggle').addEventListener('click',function(){const p=document.getElementById('ag_pass');if(!p)return;p.type=p.type==='password'?'text':'password';this.textContent=p.type==='password'?'Show':'Hide';});
  document.getElementById('ag_forgot_open').addEventListener('click',openSuperAdminRecoveryRequest);
  document.getElementById('ag_recovery_back').addEventListener('click',function(){showSuperAdminAuthView('login');});
  document.getElementById('ag_reset_cancel').addEventListener('click',cancelSuperAdminRecovery);
  document.getElementById('adminRecoveryRequestForm').addEventListener('submit',function(e){e.preventDefault();requestSuperAdminPasswordReset();});
  document.getElementById('adminPasswordResetForm').addEventListener('submit',function(e){e.preventDefault();updateSuperAdminPassword();});
  if(sb)sb.auth.onAuthStateChange(function(event){
    if(event!=='PASSWORD_RECOVERY')return;
    superAdminRecoveryMode=true;
    revealSuperAdminLogin('Secure password reset');
    showSuperAdminAuthView('update');
    setSuperAdminRecoveryMessage('ag_reset_msg','Reset link verified. Enter your new password.',false);
  });
  const bootWatchdog=setTimeout(function(){
    revealSuperAdminLogin('Session check took too long. You can sign in below.');
  },SUPER_AUTH_BOOT_TIMEOUT_MS+250);
  const bootPromise=superAdminRecoveryMode
    ?(sb?superAuthTimeout(sb.auth.getSession(),'The reset session check timed out.'):Promise.reject(new Error('The secure login service did not load.'))).then(function(result){
      revealSuperAdminLogin('Secure password reset');
      showSuperAdminAuthView('update');
      if(result.error||!result.data||!result.data.session){
        setSuperAdminRecoveryMessage('ag_reset_msg','This reset link is invalid or has expired. Cancel and request a new link.',true);
      }else{
        setSuperAdminRecoveryMessage('ag_reset_msg','Reset link verified. Enter your new password.',false);
      }
      return true;
    })
    :bootSuperSession();
  bootPromise.then(function(restored){
    if(!restored)revealSuperAdminLogin();
  }).catch(function(error){
    revealSuperAdminLogin((error&&error.message)||'Secure session check failed. You can sign in below.');
  }).finally(function(){clearTimeout(bootWatchdog);});
})();

async function enterSuper(uid){
  SA_UID=uid;
  await superAuthTimeout(loadSA(),'The dashboard took too long to load. Please try signing in again.',20000);
  const g=document.getElementById('authGate'); if(g)g.remove();
  document.body.classList.remove('auth-booting');
  document.body.classList.remove('auth-gate-visible');
  document.querySelector('.app').style.display='grid';
  go('dashboard');
}
async function bootSuperSession(){
  if(superAdminRecoveryMode)return false;
  if(!sb)throw new Error('The secure login service did not load. Check your connection and reload the page.');
  const sessionResult=await superAuthTimeout(sb.auth.getSession(),'The secure session check timed out. You can sign in below.');
  const session=sessionResult&&sessionResult.data&&sessionResult.data.session;
  if(!session||!session.user)return false;
  const profileResult=await superAuthTimeout(
    sb.from('profiles').select('role,full_name').eq('id',session.user.id).single(),
    'The account verification check timed out. You can sign in below.'
  );
  const prof=profileResult&&profileResult.data;
  if(profileResult&&profileResult.error)throw profileResult.error;
  if(!prof||prof.role!=='super_admin')return false;
  await enterSuper(session.user.id);
  return true;
}
async function superLogin(){
  const btn=document.getElementById('ag_btn'),err=document.getElementById('ag_err');
  const status=document.getElementById('ag_session_status_text');
  if(superAdminLoginPending||!btn||!err)return;
  const email=sval('ag_email').trim();
  const password=sval('ag_pass');
  if(!email||!password){err.textContent='Enter both email and password.';err.style.display='block';return;}
  if(!sb){err.textContent='The secure login service did not load. Check your connection and reload the page.';err.style.display='block';return;}
  superAdminLoginPending=true;
  btn.textContent='SIGNING IN...';
  if(status)status.textContent='Signing in securely...';
  btn.disabled=true;
  btn.setAttribute('aria-busy','true');
  err.style.display='none';
  try{
    await new Promise(function(resolve){requestAnimationFrame(resolve);});
    const loginResult=await superAuthTimeout(
      sb.auth.signInWithPassword({email,password}),
      'Sign-in timed out. Check your connection and try again.'
    );
    const data=loginResult&&loginResult.data;
    const error=loginResult&&loginResult.error;
    if(error){err.textContent=error.message||'Could not sign in.';err.style.display='block';return;}
    btn.textContent='VERIFYING ACCOUNT...';
    if(status)status.textContent='Verifying your account...';
    const profileResult=await superAuthTimeout(
      sb.from('profiles').select('role,full_name').eq('id',data.user.id).single(),
      'Account verification timed out. Please try again.'
    );
    const prof=profileResult&&profileResult.data;
    const profileError=profileResult&&profileResult.error;
    if(profileError){err.textContent=profileError.message||'Could not load account profile.';err.style.display='block';try{await superAuthTimeout(sb.auth.signOut(),'Session cleanup timed out.',3000);}catch(ignore){}return;}
    if(!prof||prof.role!=='super_admin'){
      err.textContent='This account is not a super admin.';
      err.style.display='block';
      try{await superAuthTimeout(sb.auth.signOut(),'Session cleanup timed out.',3000);}catch(ignore){}
      return;
    }
    btn.textContent='LOADING DASHBOARD...';
    if(status)status.textContent='Loading the platform dashboard...';
    await enterSuper(data.user.id);
  }catch(e){
    err.textContent=(e&&e.message)||'Sign-in failed. Check your internet connection and try again.';
    err.style.display='block';
    try{await superAuthTimeout(sb.auth.signOut(),'Session cleanup timed out.',3000);}catch(ignore){}
  }finally{
    if(document.getElementById('authGate')){
      superAdminLoginPending=false;
      if(status)status.textContent='Secure session ready';
      btn.textContent='LOGIN →';
      btn.disabled=false;
      btn.removeAttribute('aria-busy');
    }
  }
}
async function logout(){ if(!confirm('Log out of the Super Admin portal?'))return; try{ await sb.auth.signOut(); }catch(e){} location.reload(); }

async function fetchPlatformSmsHistory(){
  let res=await sb.from('sms_logs').select('school_id,recipient_group,recipients,message,status,sent_at').is('external_id',null).order('sent_at',{ascending:false}).range(0,499);
  if(res&&res.error){
    res=await sb.from('sms_log').select('school_id,recipient_group,recipients,message,status,sent_at').order('sent_at',{ascending:false}).range(0,499);
  }
  return res;
}

async function loadSA(){
  const [sch,cfg,prof,stu,pay,sms,log,progs,plc,tmpl,claims,summary]=await Promise.all([
    sb.from('schools').select('id,name,code,school_code,subdomain,status,subscription_plan,subscription_expiry,email,phone,headmaster_title,created_at').order('created_at'),
    sb.from('school_config').select('school_id,admission_status,service_charge,accept_online_payment,academic_year'),
    sb.from('profiles').select('id,full_name,email,school_id,role,permissions'),
    sb.from('students').select('id,school_id,bece_index,full_name,programme_id,status,created_at,parent_phone,records,submitted_at,personal_done,programme_done,undertaking_done,admission_no'),
    sb.from('payments').select('student_id,amount_pesewas,channel,status,reference,school_id,paid_at,created_at,payer_name, students(full_name,bece_index)'),
    fetchPlatformSmsHistory(),
    sb.from('activity_log').select('school_id,action,created_at').order('created_at',{ascending:false}).range(0,499),
    sb.from('programmes').select('id,name'),
    sb.from('placement_list').select('school_id,index_number,sms_contact'),
    sb.from('school_sms_templates').select('school_id,sms_enabled'),
    sb.from('finance_claims').select('school_id,claim_number,students_claimed,created_at,academic_year'),
    invokeFnDetailed('super-admin-summary',{refresh:true}),
  ]);
  SA_DASH_SUMMARY=(summary.data&&summary.data.summary)||{};
  const summarySchoolCounts=SA_DASH_SUMMARY.school_students||{};
  const cfgBy={}; (cfg.data||[]).forEach(c=>cfgBy[c.school_id]=c);
  const claimBy={};
  if(!claims.error&&Array.isArray(claims.data)){
    (claims.data||[]).forEach(function(row){
      const sid=row.school_id;
      if(!sid) return;
      const cfgYear=financeAcademicYearValue((cfgBy[sid]||{}).academic_year||'');
      const claimYear=financeClaimAcademicYearValue(row.academic_year||'');
      if(!claimYear||claimYear!==cfgYear) return;
      const item=claimBy[sid]||(claimBy[sid]={settled:0,count:0,settledAt:''});
      item.settled+=(parseInt(row.students_claimed,10)||0);
      item.count=Math.max(item.count,parseInt(row.claim_number,10)||0);
      if((row.created_at||'')>item.settledAt) item.settledAt=row.created_at||'';
    });
  }
  const tplBy={}; (tmpl.data||[]).forEach(t=>tplBy[t.school_id]=t);
  const plcSmsBy={}; const plcCountBy={}; (plc.data||[]).forEach(function(row){ plcSmsBy[String(row.school_id)+'::'+String(row.index_number)]=row.sms_contact||''; plcCountBy[row.school_id]=(plcCountBy[row.school_id]||0)+1; });
  const adminBy={}; (prof.data||[]).forEach(p=>{ if(p.role==='school_admin'&&p.school_id) adminBy[p.school_id]=p.full_name; });
  const schNameById={}; (sch.data||[]).forEach(s=>schNameById[s.id]=s.name);
  admins=(prof.data||[]).map(p=>({uid:p.id,name:p.full_name||'-',email:p.email||'-',role:p.role,coAdmin:!!(p.permissions&&p.permissions.co_admin),
    school:p.role==='super_admin'?'All schools':(schNameById[p.school_id]||'-')}));
  const pName={}; (progs.data||[]).forEach(p=>pName[p.id]=p.name);
  const sRev={};
  schools=(sch.data||[]).map((s,i)=>{ const id=i+1; sRev[s.id]=id; const c=cfgBy[s.id]||{};
    const schoolCode=normalizeSchoolCodeInput(s.school_code||s.code||'');
    const smsCfg=tplBy[s.id]||{};
    return {id,_id:s.id,code:s.code,school_code:schoolCode,schoolCode:schoolCode,subdomain:normalizeSchoolSubdomain(s.subdomain),name:s.name,short:sa_init(s.name),admin:adminBy[s.id]||'-',
      plan:sa_cap(s.subscription_plan||'standard'),students:Number(summarySchoolCounts[s.id]||(stu.data||[]).filter(x=>x.school_id===s.id).length),placements:plcCountBy[s.id]||0,
      admission:c.admission_status||'CLOSED',status:s.status,charge:Number(c.service_charge||0),
      acceptOnlinePayment:c.accept_online_payment!==false,
      financeSettledStudents:settledStudentCount((claimBy[s.id]&&claimBy[s.id].settled)||0),
      financeSettledAt:(claimBy[s.id]&&claimBy[s.id].settledAt)||'',
      financeClaimCount:financeClaimCountValue((claimBy[s.id]&&claimBy[s.id].count)||0),
      academicYear:c.academic_year||'',
      headmasterTitle:s.headmaster_title||'Head of School',
      expiry:s.subscription_expiry||'-',email:s.email||'',phone:s.phone||'',smsEnabled:smsCfg.sms_enabled!==false,color:i%crestColors.length}; });
  nextSchoolId=schools.length+1;
  students=(stu.data||[]).map(function(s){
    const placementSms=plcSmsBy[String(s.school_id)+'::'+String(s.bece_index)]||'';
    const smsRaw=saNormalizePhone((((s.records&&typeof s.records==='object')?s.records.sms_contact:'')||s.parent_phone||placementSms||''));
    return {_id:s.id,name:s.full_name||'(no name)',index:s.bece_index,schoolId:sRev[s.school_id],schoolUuid:s.school_id,
      programme:pName[s.programme_id]||'-',status:s.status,reg:(s.created_at||'').slice(0,10),
      parent_phone:s.parent_phone||'',records:s.records||{},sms:smsRaw||'-',smsRaw:smsRaw||'',submitted:!!s.submitted_at,submittedAt:s.submitted_at||'',personalDone:!!s.personal_done,programmeDone:!!s.programme_done,undertakingDone:!!s.undertaking_done,adm:s.admission_no||'-'};
  });
  window._todayReg=students.filter(s=>s.reg===new Date().toISOString().slice(0,10)).length;
  financePaymentsLoadError=pay.error?(pay.error.message||'Could not load payments.'):'';
  if(financePaymentsLoadError) console.error('Payment load failed:',financePaymentsLoadError);
  payments=(pay.data||[]).map(p=>({studentId:p.student_id,index:(p.students&&p.students.bece_index)||'-',date:(p.paid_at||p.created_at||'').slice(0,10),student:(p.students&&p.students.full_name)||p.payer_name||'-',schoolId:sRev[p.school_id],amount:(p.amount_pesewas||0)/100,method:sa_cap(p.channel),status:p.status,txn:p.reference||'-'}));
  smsHistory=(sms.data||[]).map(s=>({date:(s.sent_at||'').slice(0,10),school:sRev[s.school_id],group:s.recipient_group,recip:s.recipients,msg:s.message,status:s.status}));
  activity=(log.data||[]).map(l=>({type:'sys',school:sRev[l.school_id],text:l.action,time:sa_time(l.created_at)}));
  smsBalance=(cfg.data||[]).reduce((a,c)=>a+(c.sms_balance||0),0);
  renderAll();
}

/* ---- PERSISTING OVERRIDES ---- */
toggleAdmission=async function(id){
  const s=sById(id); if(!s)return;
  const nextStatus=saAdmissionIsOpen(s.admission)?'CLOSED':'OPENED';
  const result=await invokeFnDetailed('manage-school-settings',{action:'admission_status',school_id:s._id,patch:{admission_status:nextStatus}});
  if(result.error||(result.data&&result.data.ok===false)){
    toast('Could not update admission status: '+((result.data&&result.data.message)||(result.error&&result.error.message)||'error'));
    return;
  }
  s.admission=(result.data&&result.data.config&&result.data.config.admission_status)||nextStatus;
  SA_DASH_SUMMARY.open_admissions=schools.filter(function(row){return saAdmissionIsOpen(row.admission);}).length;
  activity.unshift({type:'sys',school:id,text:'Admission '+s.admission.toLowerCase()+' by Super Admin',time:'just now'});
  renderSchools(); renderDashTable(); renderFeed(); renderStats();
  toast(s.name+': admission '+s.admission);
};
suspendSchool=async function(id){
  const s=sById(id); if(!s)return;
  const nextStatus=s.status==='suspended'?'active':'suspended';
  const {data,error}=await invokeFnDetailed('manage-school',{action:'status',school_id:s._id,patch:{status:nextStatus}});
  if(error||(data&&data.ok===false)){toast('Could not update school status: '+((data&&data.message)||(error&&error.message)||'error'));return;}
  s.status=nextStatus;
  closeModal(); renderSchools(); renderStats(); renderDashTable();
  toast(s.name+' '+(s.status==='suspended'?'suspended':'reactivated'));
};
deleteSchool=async function(id){
  const s=sById(id); if(!confirm('Delete '+s.name+'? This removes the school and all its data.'))return;
  const {data,error}=await invokeFnDetailed('manage-school',{action:'delete',school_id:s._id});
  if(error||(data&&data.ok===false)){toast('Could not delete: '+((data&&data.message)||(error&&error.message)||'error'));return;}
  closeModal(); await loadSA(); go('schools');
  const pending=Array.isArray(data&&data.auth_cleanup_pending)?data.auth_cleanup_pending.length:0;
  toast(s.name+' deleted'+(pending?' (some inactive login records require cleanup)':''));
};
saveAdminEdit=async function(uid){
  const a=admins.find(x=>x.uid===uid); if(!a)return;
  const name=(sval('ea_name')||'').trim(); const pass=sval('ea_pass')||'';
  if(!name){toast('Name is required');return;}
  const btn=$('ea_btn'); if(btn)btn.textContent='Saving...';
  const {error}=await sb.from('profiles').update({full_name:name}).eq('id',uid);
  if(error){ if(btn)btn.textContent='Save changes'; toast('Could not save: '+error.message); return; }
  if(pass){
    if(pass.length<8){ if(btn)btn.textContent='Save changes'; toast('Password must be at least 8 characters'); return; }
    const {data,error:pe}=await invokeFnDetailed('manage-user',{action:'password',user_id:uid,password:pass});
    if(pe||(data&&data.error)){ if(btn)btn.textContent='Save changes'; toast('Name saved, but password change failed: '+((data&&data.message)||(pe&&pe.message)||'error')); await loadSA(); go('admins'); return; }
  }
  closeModal(); await loadSA(); go('admins'); toast(name+' updated');
};
deleteAdmin=async function(uid){
  const a=admins.find(x=>x.uid===uid); if(!a)return;
  if(uid===SA_UID){toast('You cannot delete your own account.');return;}
  if(!confirm('Delete admin '+a.name+' ('+a.email+')? They lose access immediately. This cannot be undone.'))return;
  const {data,error}=await invokeFnDetailed('manage-user',{action:'delete',user_id:uid});
  if(error||(data&&data.error)){toast('Could not delete: '+((data&&data.message)||(error&&error.message)||'error'));return;}
  await loadSA(); go('admins'); toast(a.name+' removed');
};
resetAdminPwd=async function(uid){
  const a=admins.find(x=>x.uid===uid); if(!a)return;
  if(uid===SA_UID){toast('Reset your own password from Supabase, not here.');return;}
  const pass=genStr(10);
  if(!confirm('Reset password for '+a.name+'?\n\nNew temporary password:\n'+pass+'\n\nClick OK to set it.'))return;
  const {data,error}=await invokeFnDetailed('manage-user',{action:'password',user_id:uid,password:pass});
  if(error||(data&&data.error)){toast('Could not reset: '+((data&&data.message)||(error&&error.message)||'error'));return;}
  alert('New password for '+a.email+':\n\n'+pass+'\n\nShare it with them; they can change it after signing in.');
  toast('Password reset for '+a.name);
};
saveSchoolEdit=async function(id){
  const s=sById(id); if(!s)return;
  const name=(sval('e_name')||'').trim();
  const schoolCode=normalizeSchoolCodeInput(sval('e_school_code'));
  const subdomain=normalizeSchoolSubdomain(sval('e_subdomain'));
  const codeErr=schoolCodeErrorMessage(schoolCode);
  const subdomainErr=schoolSubdomainErrorMessage(subdomain);
  if(!name){toast('School name is required');return;}
  if(codeErr){toast(codeErr);return;}
  if(subdomainErr){toast(subdomainErr);return;}
  if(schoolCodeExists(schoolCode,s._id)){toast('That School Code / SMS Sender ID is already in use.');return;}
  if(schoolSubdomainExists(subdomain,s._id)){toast('That school portal subdomain is already in use.');return;}
  const btn=$('e_btn'); if(btn)btn.textContent='Saving...';
  const patch={
    name,school_code:schoolCode,subdomain,phone:sval('e_phone'),email:sval('e_email'),
    subscription_plan:(sval('e_plan')||'Standard').toLowerCase(),subscription_expiry:sval('e_expiry')||null,status:sval('e_status'),
    service_charge:parseFloat(sval('e_charge'))||0,admission_status:sval('e_admission'),accept_online_payment:sval('e_online')!=='no'
  };
  const {data,error}=await invokeFnDetailed('manage-school',{action:'update',school_id:s._id,patch});
  if(btn)btn.textContent='Save changes';
  if(error||(data&&data.ok===false)){
    const message=(data&&data.message)||(error&&error.message)||'Could not save the school.';
    toast((/school_code|duplicate|already in use/i.test(message)?'That School Code / SMS Sender ID already exists.':'Could not save: '+message));
    return;
  }
  closeModal(); await loadSA(); go('schools'); toast(name+' updated');
};
createSchool=async function(){
  const schoolCode=normalizeSchoolCodeInput(sval('f_code')), name=sval('f_name').trim();
  const subdomain=normalizeSchoolSubdomain(sval('f_subdomain')||schoolCode);
  const codeErr=schoolCodeErrorMessage(schoolCode);
  const subdomainErr=schoolSubdomainErrorMessage(subdomain);
  if(!name){toast('School name is required');return;}
  if(codeErr){toast(codeErr);return;}
  if(subdomainErr){toast(subdomainErr);return;}
  if(schoolCodeExists(schoolCode)){toast('That School Code / SMS Sender ID is already in use.');return;}
  if(schoolSubdomainExists(subdomain)){toast('That school portal subdomain is already in use.');return;}
  const adminEmail=(sval('f_aemail')||'').trim(),adminPassword=sval('f_apass')||'',adminName=(sval('f_admin')||'').trim();
  if(!adminName||!adminEmail){toast('Primary admin name and email are required.');return;}
  if(adminPassword.length<8){toast('Temporary password must be at least 8 characters.');return;}
  const patch={
    school_code:schoolCode,subdomain,name,phone:sval('f_phone'),email:sval('f_email'),
    subscription_plan:(sval('f_plan')||'Standard').toLowerCase(),subscription_expiry:sval('f_expiry')||null,status:'active',
    service_charge:parseFloat(sval('f_charge'))||30,admission_status:sval('f_admission'),accept_online_payment:sval('f_online')!=='no',
    admin_name:adminName,admin_email:adminEmail,admin_password:adminPassword
  };
  const {data,error}=await invokeFnDetailed('manage-school',{action:'create',patch});
  if(error||(data&&data.ok===false)){
    const message=(data&&data.message)||(error&&error.message)||'Could not create the school.';
    toast('Could not create: '+message);
    return;
  }
  closeModal(); await loadSA(); go('schools');
  toast(name+' and its primary admin login were created');
};
createAdmin=async function(){
  const s=sById(parseInt(sval('a_school')));
  const email=(sval('a_email')||'').trim(), name=(sval('a_name')||'').trim(), pass=sval('a_pass')||'';
  if(!s){toast('Pick a school first');return;}
  if(!email||!pass){toast('Email and a temporary password are required');return;}
  if(pass.length<8){toast('Password must be at least 8 characters');return;}
  const btn=$('a_btn'); if(btn)btn.textContent='Creating...';
  const {data,error}=await invokeFnDetailed('create-school-admin',{email,password:pass,full_name:name,school_id:s._id});
  if(btn)btn.textContent='Create admin';
  if(error||(data&&data.error)){toast('Could not create: '+((data&&data.message)||(error&&error.message)||'error'));return;}
  closeModal(); await loadSA(); go('admins');
  toast(name+' can now sign in with '+email);
};
sendBulkSms=async function(){
  const body=(document.getElementById('smsBody').value||'').trim(); if(!body){toast('Type a message first');return;}
  const targets=smsTargets();
  const n=targets.length;
  if(!n){toast('No students with a valid SMS contact match this selection.');return;}
  const t=document.getElementById('smsTarget').value;
  const group=document.getElementById('smsGroup').selectedOptions[0].text.replace(' students','');
  const btn=document.querySelector('#view-sms .btn.btn-primary');
  if(btn){ btn.disabled=true; btn.textContent='Sending...'; }
  try{
    const grouped=new Map();
    targets.forEach(function(student){
      const school=sById(student.schoolId);
      if(!school||!school._id) return;
      const key=String(school._id);
      if(!grouped.has(key)) grouped.set(key,{school:school,messages:[]});
      grouped.get(key).messages.push({to:saStudentSms(student),body:body,student_id:student._id||null,student_index:student.index||null});
    });
    let sent=0, failed=0, partial=false;
    let skipped=0;
    for(const entry of grouped.values()){
      const school=entry.school;
      const res=await invokeFnDetailed('send-sms',{
        mode:'bulk',
        school_id:school._id,
        group:group,
        template:body,
        template_name:'super-admin-broadcast',
        messages:entry.messages
      });
      const data=res&&res.data;
      const err=res&&res.error;
      if(err||(data&&data.error)){
        failed+=entry.messages.length;
        smsHistory.unshift({date:new Date().toISOString().slice(0,10),school:school.id,group,recip:entry.messages.length,msg:body,status:'failed'});
        continue;
      }
      sent+=Number(data&&data.sent||0);
      failed+=Number(data&&data.failed||0);
      skipped+=Number(data&&data.skipped||0);
      if(data&&data.status==='pending') partial=true;
      if(Number(data&&data.sent||0) || Number(data&&data.failed||0)){
        smsHistory.unshift({date:new Date().toISOString().slice(0,10),school:school.id,group,recip:Number(data&&data.sent||0)+Number(data&&data.failed||0),msg:body,status:(data&&data.status)||'sent'});
      }
    }
    if(sent||failed){
      document.getElementById('smsBody').value='';
      renderSms(); renderStats();
    }
    if(skipped&&!sent&&!failed) toast('All matching students already received this SMS.');
    else if(failed&&sent) toast('Broadcast finished: '+sent+' sent, '+failed+' failed'+(skipped?(', '+skipped+' skipped (already sent)'):'')+'.');
    else if(failed&&!sent) toast('Broadcast could not be delivered. Check sender IDs, SMS settings, or provider response.'+(skipped?(' '+skipped+' already-sent student(s) were skipped.'):''));        
    else if(skipped) toast((partial?'Broadcast queued / partial for ':'Broadcast sent to ')+sent+' recipient(s); '+skipped+' already-sent student(s) skipped.');
    else toast((partial?'Broadcast queued / partial for ':'Broadcast sent to ')+sent+' recipient(s).');
    if(sent||failed){
      await loadSA();
      go('sms');
    }
  }finally{
    if(btn){
      btn.disabled=false;
      btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Send to <span id="smsRecip">-</span> recipients';
      updateSmsCount();
    }
  }
};


function qaSetGeneratedAdminEditPassword() {
  const input = document.getElementById('ea_pass');
  if (input) input.value = genStr(10);
}
