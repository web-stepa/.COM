/* STEPA script.js - USER MANAGEMENT + UPLOAD EXCEL/CSV
   Ganti script.js lama dengan file ini.
*/
const API_URL="https://script.google.com/macros/s/AKfycbxYeIYi85RfKBRPuey7v7Z7c9aJ3Iw6MSx9iAmsDuOYsHOEad6jJY2cvvu3aQYvB5q_Dw/exec";
const LOCAL_ANGGOTA_KEY="stepa_uploaded_anggota_v1";
let currentUser=null,data={anggota:[],kas:[],absensi:[]},xlsxPromise=null;

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const rupiah=v=>"Rp"+(Number(v)||0).toLocaleString("id-ID");
const pengurus=()=>String(currentUser?.role||"").toLowerCase()==="pengurus";
const toast=m=>{const t=$("toast");if(t){t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),3000)}else alert(m)};
function modal(id,open=true){const x=$(id);if(x)x.classList.toggle("show",open)}
function auth(){return{username:currentUser.username,password:currentUser.password||""}}

function api(action,params={}){
 return new Promise((resolve,reject)=>{
  const cb="steppa_"+Date.now()+"_"+Math.random().toString(36).slice(2);
  const s=document.createElement("script"),q=new URLSearchParams({action,callback:cb,...params});
  s.src=API_URL+"?"+q;let done=false;
  const clean=()=>{clearTimeout(tm);delete window[cb];s.remove()};
  const tm=setTimeout(()=>{if(!done){done=true;clean();reject(new Error("API timeout."))}},15000);
  window[cb]=r=>{if(done)return;done=true;clean();r?.success?resolve(r):reject(new Error(r?.message||"Permintaan gagal."))};
  s.onerror=()=>{if(!done){done=true;clean();reject(new Error("Gagal terhubung ke Apps Script."))}};
  document.body.appendChild(s);
 })
}

document.addEventListener("DOMContentLoaded",()=>{
 const f=$("loginForm");if(f)f.addEventListener("submit",login);
 const l=$("logoutBtn");if(l)l.addEventListener("click",logout);
 const sp=$("showPassword");if(sp)sp.onclick=()=>{const p=$("password");p.type=p.type==="password"?"text":"password"};
 document.querySelectorAll(".nav-item").forEach(x=>x.onclick=()=>showPage(x.dataset.page));
 checkSession();
});

function checkSession(){
 try{const x=JSON.parse(localStorage.getItem("stepa_user")||"null");if(!x?.username)throw 0;currentUser=x;showApp()}catch(e){showLogin()}
}
function showLogin(){
 const l=$("loginPage"),a=$("appPage");
 if(l){l.classList.remove("hidden");l.style.display="flex"}
 if(a){a.classList.add("hidden");a.style.display="none"}
}
function showApp(){
 const l=$("loginPage"),a=$("appPage");
 if(l){l.classList.add("hidden");l.style.display="none"}
 if(a){a.classList.remove("hidden");a.style.display="flex"}
 info();injectAccount();showPage("dashboard");loadData()
}
function info(){if($("userName"))$("userName").textContent=currentUser.nama;if($("userRole"))$("userRole").textContent=currentUser.role;if($("userAvatar"))$("userAvatar").textContent=(currentUser.nama||"U")[0].toUpperCase()}
function logout(){currentUser=null;localStorage.removeItem("stepa_user");showLogin()}

async function login(e){
 e.preventDefault();const u=$("username")?.value.trim(),p=$("password")?.value;
 if(!u||!p)return toast("Username dan password wajib diisi.");
 try{
  const r=await api("login",{username:u,password:p});
  currentUser={...r.data,password:p};localStorage.setItem("stepa_user",JSON.stringify(currentUser));showApp();toast("Login berhasil.");
 }catch(err){if($("loginMessage"))$("loginMessage").textContent=err.message}
}
async function loadData(){
 try{const r=await api("allData",auth());data=r.data||{};data.anggota=[...(data.anggota||[]),...localAnggota()].filter((x,i,a)=>a.findIndex(y=>(y.id&&x.id?y.id===x.id:y.nama===x.nama&&y.kelas===x.kelas))===i);renderAll()}
 catch(e){if(!currentUser.password)return;toast(e.message)}
}

/* ---------- NAV ---------- */
function showPage(n){
 const pages=["dashboard","kas","absensi","anggota","akun"];if(!pages.includes(n))n="dashboard";
 document.querySelectorAll(".page").forEach(x=>x.classList.remove("active-page"));
 $(n+"Page")?.classList.add("active-page");
 document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===n));
 const title={dashboard:["Dashboard","Ringkasan kegiatan STEPA"],kas:["Kas STEPA","Kelola pemasukan dan pengeluaran kas"],absensi:["Absensi","Catat kehadiran calon anggota STEPA"],anggota:["Calon Anggota","Data calon anggota STEPA"],akun:["Manajemen Akun","Kelola username, password, role, dan status akun"]}[n];
 if($("pageTitle"))$("pageTitle").textContent=title[0];if($("pageSubtitle"))$("pageSubtitle").textContent=title[1];
 if(n==="akun")loadUsers();
}

/* ---------- ACCOUNT MANAGEMENT ---------- */
function injectAccount(){
 if(!pengurus()||$("akunPage"))return;
 const host=$("appPage")||document.body,page=document.createElement("section");page.id="akunPage";page.className="page";
 page.innerHTML=`<div class="account-page">
 <div class="account-hero"><div><div class="account-kicker">PENGURUS</div><h2>Manajemen Akun</h2><p>Kelola username, password, nama, role, dan status akun langsung dari website.</p></div><button id="newAccount" class="primary-btn">＋ Tambah Akun</button></div>
 <div class="account-stats"><div><span>Total Akun</span><strong id="userCount">0</strong></div><div><span>Pengurus</span><strong id="adminCount">0</strong></div><div><span>Anggota</span><strong id="memberCount">0</strong></div></div>
 <div class="panel account-panel"><div class="panel-header"><div><h2>Daftar Akun</h2><p>Akun yang tersimpan di sheet Users.</p></div></div><div id="usersTable" class="account-table-wrap"></div></div>
 <div class="panel password-panel"><div class="panel-header"><div><h2>Ubah Password Saya</h2><p>Ganti password akun yang sedang digunakan.</p></div></div><form id="myPass" class="password-form"><input id="oldPass" type="password" placeholder="Password lama" required><input id="newPass" type="password" placeholder="Password baru (min. 4 karakter)" required><button class="primary-btn">Simpan Password</button></form></div>
 </div>
 <div id="accountModal" class="modal"><div class="modal-card account-modal-card"><div class="modal-header"><div><h2 id="accountTitle">Tambah Akun</h2><p>Isi data akun STEPA.</p></div><button type="button" id="closeAccount" class="modal-close">×</button></div><form id="accountForm" class="account-form"><input type="hidden" id="oldU"><label>Username<input id="accU" autocomplete="off" required></label><label>Password<input id="accP" type="password" autocomplete="new-password" placeholder="Kosongkan jika tidak ingin mengubah"></label><label>Nama<input id="accN" required></label><label>Role<select id="accR"><option>Anggota</option><option>Pengurus</option></select></label><label>Status<select id="accA"><option value="TRUE">Aktif</option><option value="FALSE">Nonaktif</option></select></label><div class="account-form-actions"><button type="button" id="cancelAccount" class="secondary-btn">Batal</button><button class="primary-btn">Simpan Akun</button></div></form></div></div>`;
 host.appendChild(page);
 $("newAccount").onclick=()=>editAccount();
 $("closeAccount").onclick=()=>modal("accountModal",false);$("cancelAccount").onclick=()=>modal("accountModal",false);
 $("accountForm").onsubmit=saveAccount;
 $("myPass").onsubmit=changePass;
 const nav=document.querySelector(".nav-item")?.parentElement;
 if(nav){const b=document.createElement("button");b.className="nav-item pengurus-only";b.dataset.page="akun";b.innerHTML="⚙️ Manajemen Akun";b.onclick=()=>showPage("akun");nav.appendChild(b)}
}
async function loadUsers(){
 if(!pengurus())return;
 try{const r=await api("listUsers",auth());const users=r.data||[];if($("userCount"))$("userCount").textContent=users.length;if($("adminCount"))$("adminCount").textContent=users.filter(u=>String(u.role).toLowerCase()==="pengurus").length;if($("memberCount"))$("memberCount").textContent=users.filter(u=>String(u.role).toLowerCase()==="anggota").length;$("usersTable").innerHTML=users.length?`<table class="users-table"><thead><tr><th>Username</th><th>Nama</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${users.map(u=>`<tr><td><strong>${esc(u.username)}</strong></td><td>${esc(u.nama)}</td><td><span class="role-pill ${String(u.role).toLowerCase()==="pengurus"?"role-admin":"role-member"}">${esc(u.role)}</span></td><td><span class="status-pill ${u.aktif?"status-active":"status-off"}">${u.aktif?"Aktif":"Nonaktif"}</span></td><td class="user-actions"><button class="small-btn" onclick='window.editAccount(${JSON.stringify(u)})'>✏️ Edit</button> ${u.username.toLowerCase()!==currentUser.username.toLowerCase()?`<button class="danger-btn" onclick='window.delAccount("${esc(u.username)}")'>🗑️ Hapus</button>`:"<span class="current-user">Akun saya</span>"}</td></tr>`).join("")}</tbody></table>`:`<div class="empty-state">Belum ada akun.</div>`}
 catch(e){toast(e.message)}
}
function editAccount(u=null){
 $("oldU").value=u?.username||"";$("accU").value=u?.username||"";$("accP").value="";$("accN").value=u?.nama||"";$("accR").value=u?.role||"Anggota";$("accA").value=u?.aktif===false?"FALSE":"TRUE";$("accountTitle").textContent=u?"Edit Akun":"Tambah Akun";modal("accountModal")
}
async function saveAccount(e){
 e.preventDefault();const oldU=$("oldU").value,u=$("accU").value.trim(),p=$("accP").value,n=$("accN").value.trim(),role=$("accR").value,aktif=$("accA").value;
 try{
  const r=await api(oldU?"updateUser":"addUser",{...auth(),oldUsername:oldU,username:u,password:p,nama:n,role,aktif});
  if(oldU&&oldU.toLowerCase()===currentUser.username.toLowerCase()){currentUser.username=u;currentUser.nama=n;currentUser.role=role;if(p)currentUser.password=p;localStorage.setItem("stepa_user",JSON.stringify(currentUser));info()}
  modal("accountModal",false);await loadUsers();toast(r.message)
 }catch(e){toast(e.message)}
}
async function delAccount(u){
 if(!confirm("Hapus akun "+u+"?"))return;
 try{const r=await api("deleteUser",{...auth(),username:u,requester:currentUser.username});await loadUsers();toast(r.message)}catch(e){toast(e.message)}
}
async function changePass(e){
 e.preventDefault();try{const r=await api("changePassword",{username:currentUser.username,password:currentUser.password,oldPassword:$("oldPass").value,newPassword:$("newPass").value});currentUser.password=$("newPass").value;localStorage.setItem("stepa_user",JSON.stringify(currentUser));e.target.reset();toast(r.message)}catch(x){toast(x.message)}
}
window.editAccount=editAccount;window.delAccount=delAccount;

/* ---------- UPLOAD EXCEL/CSV ---------- */
function localAnggota(){try{return JSON.parse(localStorage.getItem(LOCAL_ANGGOTA_KEY)||"[]")}catch(e){return[]}}
function setupUpload(){
 const t=$("anggotaTable");if(!t||$("uploadAnggota"))return;const p=t.closest(".table-container")||t.parentElement,b=document.createElement("button");
 b.id="uploadAnggota";b.type="button";b.textContent="📁 Upload Excel / CSV";b.style.marginBottom="12px";b.onclick=()=>{$("anggotaFile").click()};p.parentNode.insertBefore(b,p);
 const i=document.createElement("input");i.id="anggotaFile";i.type="file";i.accept=".xlsx,.xls,.csv";i.style.display="none";i.onchange=uploadFile;document.body.appendChild(i)
}
async function xlsx(){
 if(window.XLSX)return window.XLSX;if(xlsxPromise)return xlsxPromise;
 xlsxPromise=new Promise((ok,no)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";s.onload=()=>ok(window.XLSX);s.onerror=()=>no(new Error("Library Excel gagal dimuat"));document.head.appendChild(s)});return xlsxPromise
}
function csv(t){const lines=t.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean),h=lines.shift().split(/[,;]/).map(x=>x.trim().toLowerCase());return lines.map(l=>{const a=l.split(/[,;]/),o={};h.forEach((x,i)=>o[x]=a[i]||"");return o})}
function norm(x){return{id:x.id||("UP-"+Date.now()+"-"+Math.random().toString(36).slice(2,6)),nama:x.nama||x.name||"",kelas:x.kelas||x.class||"-",hp:x.hp||x.nohp||x.telepon||"-",status:x.status||"Aktif"}}
async function uploadFile(e){const f=e.target.files?.[0];if(!f)return;try{let r;if(f.name.toLowerCase().endsWith(".csv"))r=csv(await f.text());else{const X=await xlsx(),w=X.read(await f.arrayBuffer(),{type:"array"});r=X.utils.sheet_to_json(w.Sheets[w.SheetNames[0]],{defval:""})}const a=r.map(norm).filter(x=>x.nama);localStorage.setItem(LOCAL_ANGGOTA_KEY,JSON.stringify([...localAnggota(),...a]));await loadData();toast(a.length+" anggota berhasil diupload")}catch(x){alert("Upload gagal: "+x.message)}e.target.value=""}

/* ---------- RENDER ---------- */
function renderAll(){
 renderAnggota();renderKas();renderAbsensi();populateNames();setupUpload();
 const t=totals();if($("statAnggota"))$("statAnggota").textContent=data.anggota?.length||0;if($("statMasuk"))$("statMasuk").textContent=rupiah(t.in);if($("statKeluar"))$("statKeluar").textContent=rupiah(t.out);if($("statSaldo"))$("statSaldo").textContent=rupiah(t.in-t.out)
}
function renderAnggota(){const t=$("anggotaTable");if(!t)return;t.innerHTML=data.anggota?.length?data.anggota.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.nama)}</td><td>${esc(x.kelas)}</td><td>${esc(x.hp)}</td><td>${esc(x.status)}</td></tr>`).join(""):`<tr><td colspan="6">Belum ada calon anggota.</td></tr>`}
function totals(){let i=0,o=0;(data.kas||[]).forEach(x=>{const n=Number(x.nominal)||0,j=String(x.jenis||"").toLowerCase();if(j==="masuk"||j==="pemasukan")i+=n;if(j==="keluar"||j==="pengeluaran")o+=n});return{in:i,out:o}}
function renderKas(){const t=$("kasTable");if(t)t.innerHTML=data.kas?.length?data.kas.map(x=>`<tr><td>${esc(x.tanggal)}</td><td>${esc(x.jenis)}</td><td>${esc(x.keterangan)}</td><td>${rupiah(x.nominal)}</td></tr>`).join(""):`<tr><td colspan="5">Belum ada catatan kas.</td></tr>`}
function renderAbsensi(){const t=$("absensiTable");if(t)t.innerHTML=data.absensi?.length?data.absensi.map(x=>`<tr><td>${esc(x.tanggal)}</td><td>${esc(x.nama)}</td><td>${esc(x.status)}</td><td>${esc(x.keterangan)}</td></tr>`).join(""):`<tr><td colspan="5">Belum ada catatan absensi.</td></tr>`}
function populateNames(){const s=$("absensiNama");if(!s)return;s.innerHTML='<option value="">-- Pilih Anggota --</option>';data.anggota?.forEach(x=>{const o=document.createElement("option");o.value=x.nama;o.textContent=x.nama+" ("+x.kelas+")";s.appendChild(o)})}

window.showPage=showPage;window.openModal=id=>modal(id,true);window.closeModal=id=>modal(id,false);
