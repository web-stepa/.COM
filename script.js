const API_URL="https://script.google.com/macros/s/AKfycbxYeIYi85RfKBRPuey7v7Z7c9aJ3Iw6MSx9iAmsDuOYsHOEad6jJY2cvvu3aQYvB5q_Dw/exec";
let currentUser=null,data={anggota:[],kas:[],absensi:[]},xlsxPromise=null;
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const rupiah=v=>"Rp"+(Number(v)||0).toLocaleString("id-ID");
const pengurus=()=>String(currentUser?.role||"").toLowerCase()==="pengurus";
const toast=m=>{const t=$("toast");if(t){t.textContent=m;t.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove("show"),3000)}else alert(m)};
function auth(){return{username:currentUser?.username||"",password:currentUser?.password||""}}
function api(action,params={}){return new Promise((resolve,reject)=>{const cb="stepa_"+Date.now()+"_"+Math.random().toString(36).slice(2);const s=document.createElement("script"),q=new URLSearchParams({action,callback:cb,...params});s.src=API_URL+"?"+q.toString();let done=false;const clean=()=>{clearTimeout(timer);delete window[cb];s.remove()};const timer=setTimeout(()=>{if(!done){done=true;clean();reject(new Error("Koneksi ke server timeout."))}},20000);window[cb]=r=>{if(done)return;done=true;clean();r?.success?resolve(r):reject(new Error(r?.message||"Permintaan gagal."))};s.onerror=()=>{if(!done){done=true;clean();reject(new Error("Gagal terhubung ke Google Apps Script."))}};document.body.appendChild(s)})}

document.addEventListener("DOMContentLoaded",()=>{setupEvents();checkSession()});
function setupEvents(){
 $("loginForm")?.addEventListener("submit",login);$("logoutBtn")?.addEventListener("click",logout);$("refreshBtn")?.addEventListener("click",loadData);$("syncBtn")?.addEventListener("click",loadData);
 $("showPassword")?.addEventListener("click",()=>{const p=$("password");if(p)p.type=p.type==="password"?"text":"password"});
 document.querySelectorAll(".nav-item").forEach(x=>x.addEventListener("click",()=>showPage(x.dataset.page)));
 document.querySelectorAll("[data-page-btn]").forEach(x=>x.addEventListener("click",()=>showPage(x.dataset.pageBtn)));
 $("addKasBtn")?.addEventListener("click",()=>openModal("kasModal"));$("kasForm")?.addEventListener("submit",addKas);
 $("addAbsensiBtn")?.addEventListener("click",()=>openModal("absensiModal"));$("absensiForm")?.addEventListener("submit",addAbsensi);
 document.querySelectorAll(".close-modal").forEach(x=>x.addEventListener("click",()=>closeModal(x.dataset.close)));
}
function checkSession(){try{const x=JSON.parse(localStorage.getItem("stepa_user")||"null");if(!x?.username)throw 0;currentUser=x;showApp()}catch{showLogin()}}
function showLogin(){if($("loginPage"))$("loginPage").style.display="flex";if($("appPage")){ $("appPage").classList.add("hidden");$("appPage").style.display="none"}}
function showApp(){if($("loginPage"))$("loginPage").style.display="none";if($("appPage")){ $("appPage").classList.remove("hidden");$("appPage").style.display="flex"}info();setupRole();showPage("dashboard");loadData()}
function info(){if($("userName"))$("userName").textContent=currentUser.nama||currentUser.username;if($("userRole"))$("userRole").textContent=currentUser.role||"Anggota";if($("userAvatar"))$("userAvatar").textContent=(currentUser.nama||currentUser.username||"U")[0].toUpperCase()}
function setupRole(){document.querySelectorAll(".pengurus-only").forEach(x=>x.style.display=pengurus()?"":"none")}
async function login(e){e.preventDefault();const u=$("username")?.value.trim(),p=$("password")?.value||"";if(!u||!p)return toast("Username dan password wajib diisi.");try{const r=await api("login",{username:u,password:p});currentUser={...r.data,password:p};localStorage.setItem("stepa_user",JSON.stringify(currentUser));showApp();toast("Login berhasil.")}catch(err){if($("loginMessage"))$("loginMessage").textContent=err.message;else toast(err.message)}}
function logout(){currentUser=null;localStorage.removeItem("stepa_user");showLogin()}
function showPage(n){const pages=["dashboard","kas","absensi","anggota"];if(!pages.includes(n))n="dashboard";document.querySelectorAll(".page").forEach(x=>x.classList.remove("active-page"));$(n+"Page")?.classList.add("active-page");document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===n));const title={dashboard:["Dashboard","Ringkasan kegiatan STEPA"],kas:["Kas STEPA","Kelola pemasukan dan pengeluaran kas"],absensi:["Absensi","Catat kehadiran calon anggota STEPA"],anggota:["Calon Anggota","Data calon anggota STEPA"]}[n];if($("pageTitle"))$("pageTitle").textContent=title[0];if($("pageSubtitle"))$("pageSubtitle").textContent=title[1];if(n==="anggota")setTimeout(setupUpload,0)}
async function loadData(){if(!currentUser)return;try{const r=await api("allData",auth());data={anggota:r.data?.anggota||[],kas:r.data?.kas||[],absensi:r.data?.absensi||[]};renderAll()}catch(e){toast("Gagal memuat data: "+e.message)}}
async function addKas(e){e.preventDefault();if(!pengurus())return toast("Hanya Pengurus yang dapat menambah kas.");try{await api("addKas",{...auth(),jenis:$("kasJenis").value,keterangan:$("kasKeterangan").value.trim(),nominal:$("kasNominal").value});closeModal("kasModal");e.target.reset();await loadData();toast("Transaksi kas berhasil disimpan.")}catch(x){toast(x.message)}}
async function addAbsensi(e){e.preventDefault();if(!pengurus())return toast("Hanya Pengurus yang dapat mengisi absensi.");try{await api("addAbsensi",{...auth(),tanggal:$("absensiTanggal").value,nama:$("absensiNama").value,status:$("absensiStatus").value,keterangan:$("absensiKeterangan").value.trim()});closeModal("absensiModal");e.target.reset();await loadData();toast("Absensi berhasil disimpan.")}catch(x){toast(x.message)}}
function setupUpload(){const t=$("anggotaTable");if(!t||$("uploadAnggotaBtn"))return;const c=t.closest(".table-container"),w=c?.parentElement;if(!w)return;const b=document.createElement("button");b.id="uploadAnggotaBtn";b.className="primary-btn pengurus-only";b.type="button";b.textContent="📁 Upload Excel / CSV";b.style.marginBottom="12px";b.onclick=()=>$("anggotaFileInput").click();w.insertBefore(b,c);const i=document.createElement("input");i.id="anggotaFileInput";i.type="file";i.accept=".xlsx,.xls,.csv";i.hidden=true;i.onchange=uploadFile;document.body.appendChild(i);setupRole()}
function loadXLSX(){if(window.XLSX)return Promise.resolve(window.XLSX);if(xlsxPromise)return xlsxPromise;xlsxPromise=new Promise((ok,no)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";s.onload=()=>ok(window.XLSX);s.onerror=()=>no(new Error("Library Excel gagal dimuat."));document.head.appendChild(s)});return xlsxPromise}
function csv(text){const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean);if(lines.length<2)return[];const d=lines[0].includes(";")?";":",";const h=lines.shift().split(d).map(x=>x.trim().toLowerCase());return lines.map(line=>{const a=line.split(d),o={};h.forEach((k,i)=>o[k]=a[i]||"");return o})}
function norm(x){const r={};Object.keys(x).forEach(k=>r[k.trim().toLowerCase().replace(/\s+/g,"")]=x[k]);return{nama:String(r.nama||r.name||"").trim(),kelas:String(r.kelas||r.class||"-").trim(),hp:String(r.hp||r.nohp||r.telepon||"-").trim(),status:String(r.status||"Aktif").trim()}}
async function uploadFile(e){const f=e.target.files?.[0];if(!f)return;if(!pengurus()){toast("Hanya Pengurus yang dapat upload.");e.target.value="";return}const b=$("uploadAnggotaBtn");try{let rows;if(f.name.toLowerCase().endsWith(".csv"))rows=csv(await f.text());else{const X=await loadXLSX();const wb=X.read(await f.arrayBuffer(),{type:"array"});rows=X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""})}const a=rows.map(norm).filter(x=>x.nama);if(!a.length)throw new Error("Kolom 'nama' tidak ditemukan atau data kosong.");let ok=0,bad=0;for(let i=0;i<a.length;i++){if(b){b.disabled=true;b.textContent=`⏳ Upload ${i+1}/${a.length}...`}try{await api("addAnggota",{...auth(),nama:a[i].nama,kelas:a[i].kelas,hp:a[i].hp,status:a[i].status});ok++}catch(err){console.error(err);bad++}}await loadData();toast(`${ok} anggota berhasil masuk ke Google Sheets${bad?`, ${bad} gagal`:""}.`)}catch(x){alert("Upload gagal:\n\n"+x.message)}finally{e.target.value="";if(b){b.disabled=false;b.textContent="📁 Upload Excel / CSV"}}}
function renderAll(){renderDashboard();renderAnggota();renderKas();renderAbsensi();populateNames();setupRole();setupUpload()}
function renderDashboard(){let masuk=0,keluar=0;(data.kas||[]).forEach(x=>{const n=Number(x.nominal)||0,j=String(x.jenis||"").toLowerCase();if(j.includes("masuk"))masuk+=n;if(j.includes("keluar"))keluar+=n});if($("statAnggota"))$("statAnggota").textContent=data.anggota?.length||0;if($("statMasuk"))$("statMasuk").textContent=rupiah(masuk);if($("statKeluar"))$("statKeluar").textContent=rupiah(keluar);if($("statSaldo"))$("statSaldo").textContent=rupiah(masuk-keluar);if($("dashboardAbsensi"))$("dashboardAbsensi").innerHTML=(data.absensi||[]).slice(-5).reverse().map(x=>`<tr><td>${esc(x.tanggal)}</td><td>${esc(x.nama)}</td><td>${esc(x.status)}</td></tr>`).join("")||`<tr><td colspan="3">Belum ada data absensi.</td></tr>`;if($("dashboardKas"))$("dashboardKas").innerHTML=(data.kas||[]).slice(-5).reverse().map(x=>`<tr><td>${esc(x.tanggal)}</td><td>${esc(x.keterangan)}</td><td>${rupiah(x.nominal)}</td></tr>`).join("")||`<tr><td colspan="3">Belum ada transaksi kas.</td></tr>`}
function renderAnggota(){const t=$("anggotaTable");if(t)t.innerHTML=data.anggota?.length?data.anggota.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.nama)}</td><td>${esc(x.kelas)}</td><td>${esc(x.hp)}</td><td>${esc(x.status)}</td></tr>`).join(""):`<tr><td colspan="5">Belum ada calon anggota.</td></tr>`}
function renderKas(){const t=$("kasTable");if(t)t.innerHTML=data.kas?.length?data.kas.map(x=>`<tr><td>${esc(x.tanggal)}</td><td>${esc(x.jenis)}</td><td>${esc(x.keterangan)}</td><td>${rupiah(x.nominal)}</td><td class="pengurus-only">-</td></tr>`).join(""):`<tr><td colspan="5">Belum ada catatan kas.</td></tr>`}
function renderAbsensi(){const t=$("absensiTable");if(t)t.innerHTML=data.absensi?.length?data.absensi.map(x=>`<tr><td>${esc(x.tanggal)}</td><td>${esc(x.nama)}</td><td>${esc(x.status)}</td><td>${esc(x.keterangan||"-")}</td><td class="pengurus-only">-</td></tr>`).join(""):`<tr><td colspan="5">Belum ada catatan absensi.</td></tr>`}
function populateNames(){const s=$("absensiNama");if(!s)return;s.innerHTML='<option value="">-- Pilih Anggota --</option>';(data.anggota||[]).forEach(x=>{const o=document.createElement("option");o.value=x.nama;o.textContent=`${x.nama} (${x.kelas||"-"})`;s.appendChild(o)})}
function openModal(id){$(id)?.classList.add("show")}function closeModal(id){$(id)?.classList.remove("show")}
window.showPage=showPage;window.openModal=openModal;window.closeModal=closeModal;window.loadData=loadData;
/* =========================================================
   MANAJEMEN AKUN
   ========================================================= */

function accountAuthParams() {
    return {
        username: currentUser?.username || "",
        password: currentUser?.password || ""
    };
}

async function loadUsers() {
    const table = $("usersTable");
    if (!table || !isPengurus()) return;

    if (!currentUser?.password) {
        table.innerHTML = `
            <tr>
                <td colspan="6" class="empty">
                    Silakan logout lalu login kembali untuk mengelola akun.
                </td>
            </tr>`;
        return;
    }

    table.innerHTML = `
        <tr>
            <td colspan="6" class="empty">⏳ Memuat akun...</td>
        </tr>`;

    try {
        const response = await callAPI("listUsers", accountAuthParams());
        const users = Array.isArray(response.data) ? response.data : [];

        if (!users.length) {
            table.innerHTML = `
                <tr>
                    <td colspan="6" class="empty">Belum ada akun.</td>
                </tr>`;
            return;
        }

        table.innerHTML = "";

        users.forEach((user, index) => {
            const tr = document.createElement("tr");

            const statusClass = user.aktif
                ? "account-status-active"
                : "account-status-off";

            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${escapeHTML(user.username)}</td>
                <td>${escapeHTML(user.nama)}</td>
                <td>${escapeHTML(user.role)}</td>
                <td class="${statusClass}">
                    ${user.aktif ? "Aktif" : "Nonaktif"}
                </td>
                <td>
                    <div class="account-action">
                        <button class="account-edit" type="button">✏️ Edit</button>
                        ${
                            String(user.username).toLowerCase() !==
                            String(currentUser.username).toLowerCase()
                            ? `<button class="account-delete" type="button">🗑️ Hapus</button>`
                            : ""
                        }
                    </div>
                </td>
            `;

            tr.querySelector(".account-edit")
                .addEventListener("click", () => openUserModal(user));

            const deleteBtn = tr.querySelector(".account-delete");
            if (deleteBtn) {
                deleteBtn.addEventListener("click", () => deleteUserAccount(user.username));
            }

            table.appendChild(tr);
        });

    } catch (error) {
        table.innerHTML = `
            <tr>
                <td colspan="6" class="empty">
                    Gagal memuat akun: ${escapeHTML(error.message)}
                </td>
            </tr>`;
        showToast(error.message);
    }
}

function openUserModal(user = null) {
    if (!isPengurus()) return;

    const title = $("userModalTitle");
    const oldUsername = $("editOldUsername");
    const username = $("accountUsername");
    const password = $("accountPassword");
    const nama = $("accountNama");
    const role = $("accountRole");
    const aktif = $("accountAktif");
    const hint = $("passwordHint");

    if (!title || !oldUsername || !username || !password || !nama || !role || !aktif) {
        showToast("Form Manajemen Akun tidak ditemukan.");
        return;
    }

    if (user) {
        title.textContent = "Edit Akun";
        oldUsername.value = user.username || "";
        username.value = user.username || "";
        password.value = "";
        password.required = false;
        nama.value = user.nama || "";
        role.value = user.role || "Anggota";
        aktif.value = user.aktif ? "TRUE" : "FALSE";
        hint.textContent = "Kosongkan password jika tidak ingin mengubahnya.";
    } else {
        title.textContent = "Tambah Akun";
        oldUsername.value = "";
        username.value = "";
        password.value = "";
        password.required = true;
        nama.value = "";
        role.value = "Anggota";
        aktif.value = "TRUE";
        hint.textContent = "Minimal 4 karakter.";
    }

    openModal("userModal");
}

async function saveUser(event) {
    event.preventDefault();

    if (!isPengurus()) {
        showToast("Akses hanya untuk Pengurus.");
        return;
    }

    const oldUsername = $("editOldUsername").value.trim();
    const username = $("accountUsername").value.trim();
    const password = $("accountPassword").value;
    const nama = $("accountNama").value.trim();
    const role = $("accountRole").value;
    const aktif = $("accountAktif").value;

    if (!username || !nama) {
        showToast("Username dan nama wajib diisi.");
        return;
    }

    if (!oldUsername && password.length < 4) {
        showToast("Password minimal 4 karakter.");
        return;
    }

    if (oldUsername && password && password.length < 4) {
        showToast("Password minimal 4 karakter.");
        return;
    }

    try {
        const action = oldUsername ? "updateUser" : "addUser";

        await callAPI(action, {
            ...accountAuthParams(),
            oldUsername: oldUsername,
            username: username,
            password: password,
            nama: nama,
            role: role,
            aktif: aktif
        });

        if (
            oldUsername &&
            oldUsername.toLowerCase() === currentUser.username.toLowerCase()
        ) {
            currentUser.username = username;
            currentUser.nama = nama;
            currentUser.role = role;

            if (password) {
                currentUser.password = password;
            }

            localStorage.setItem(
                "stepa_user",
                JSON.stringify(currentUser)
            );

            updateUserInfo();
            setupUserRoleUI();
        }

        closeModal("userModal");
        event.target.reset();

        await loadUsers();

        showToast(
            oldUsername
                ? "Akun berhasil diperbarui."
                : "Akun berhasil dibuat."
        );

    } catch (error) {
        showToast("Gagal: " + error.message);
    }
}

async function deleteUserAccount(username) {
    if (!isPengurus()) return;

    if (
        String(username).toLowerCase() ===
        String(currentUser.username).toLowerCase()
    ) {
        showToast("Akun yang sedang digunakan tidak boleh dihapus.");
        return;
    }

    if (!confirm(`Hapus akun "${username}"?`)) return;

    try {
        await callAPI("deleteUser", {
            ...accountAuthParams(),
            username: username,
            requester: currentUser.username
        });

        await loadUsers();
        showToast("Akun berhasil dihapus.");

    } catch (error) {
        showToast("Gagal menghapus akun: " + error.message);
    }
}

async function changeMyPassword(event) {
    event.preventDefault();

    if (!currentUser?.password) {
        showToast("Silakan logout lalu login kembali.");
        return;
    }

    const oldPassword = $("oldPasswordAccount").value;
    const newPassword = $("newPasswordAccount").value;

    if (newPassword.length < 4) {
        showToast("Password baru minimal 4 karakter.");
        return;
    }

    try {
        await callAPI("changePassword", {
            username: currentUser.username,
            password: currentUser.password,
            oldPassword: oldPassword,
            newPassword: newPassword
        });

        currentUser.password = newPassword;

        localStorage.setItem(
            "stepa_user",
            JSON.stringify(currentUser)
        );

        event.target.reset();
        showToast("Password berhasil diubah.");

    } catch (error) {
        showToast("Gagal mengubah password: " + error.message);
    }
}

