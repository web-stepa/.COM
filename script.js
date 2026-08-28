/* =========================================================
   KONFIGURASI DAN STATE APLIKASI
   ========================================================= */
const API_URL = "https://script.google.com/macros/s/AKfycbxYeIYi85RfKBRPuey7v7Z7c9aJ3Iw6MSx9iAmsDuOYsHOEad6jJY2cvvu3aQYvB5q_Dw/exec";

let currentUser = null;
let data = { anggota: [], kas: [], absensi: [] };
let xlsxPromise = null;

/* =========================================================
   HELPER UTAMA & UTILITY
   ========================================================= */
const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const rupiah = v => "Rp" + (Number(v) || 0).toLocaleString("id-ID");
const pengurus = () => String(currentUser?.role || "").toLowerCase() === "pengurus";

function auth() {
    return {
        username: currentUser?.username || "",
        password: currentUser?.password || ""
    };
}

function toast(msg) {
    const t = $("toast");
    if (t) {
        t.textContent = msg;
        t.classList.add("show");
        clearTimeout(window.__toast);
        window.__toast = setTimeout(() => t.classList.remove("show"), 3000);
    } else {
        alert(msg);
    }
}

function openModal(id) { $(id)?.classList.add("show"); }
function closeModal(id) { $(id)?.classList.remove("show"); }

/* =========================================================
   KOMUNIKASI API (JSONP INTERFACE)
   ========================================================= */
function api(action, params = {}) {
    return new Promise((resolve, reject) => {
        const cb = "stepa_" + Date.now() + "_" + Math.random().toString(36).slice(2);
        const s = document.createElement("script");
        const q = new URLSearchParams({ action, callback: cb, ...params });
        
        s.src = API_URL + "?" + q.toString();
        let done = false;

        const clean = () => {
            clearTimeout(timer);
            delete window[cb];
            s.remove();
        };

        const timer = setTimeout(() => {
            if (!done) {
                done = true;
                clean();
                reject(new Error("Koneksi ke server timeout."));
            }
        }, 20000);

        window[cb] = r => {
            if (done) return;
            done = true;
            clean();
            r?.success ? resolve(r) : reject(new Error(r?.message || "Permintaan gagal."));
        };

        s.onerror = () => {
            if (!done) {
                done = true;
                clean();
                reject(new Error("Gagal terhubung ke Google Apps Script."));
            }
        };

        document.body.appendChild(s);
    });
}

/* =========================================================
   INISIALISASI & EVENT LISTENERS
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
    setupEvents();
    checkSession();
});

function setupEvents() {
    // Form Login & Auth Event
    $("loginForm")?.addEventListener("submit", login);
    $("logoutBtn")?.addEventListener("click", logout);
    $("showPassword")?.addEventListener("click", () => {
        const p = $("password");
        if (p) p.type = p.type === "password" ? "text" : "password";
    });

    // Action Topbar Buttons
    $("refreshBtn")?.addEventListener("click", loadData);
    $("syncBtn")?.addEventListener("click", loadData);
    $("refreshUsersBtn")?.addEventListener("click", loadUsers);

    // Navigasi Halaman
    document.querySelectorAll(".nav-item").forEach(x => {
        x.addEventListener("click", () => showPage(x.dataset.page));
    });
    document.querySelectorAll("[data-page-btn]").forEach(x => {
        x.addEventListener("click", () => showPage(x.dataset.pageBtn));
    });

    // Form Submissions
    $("addKasBtn")?.addEventListener("click", () => openModal("kasModal"));
    $("kasForm")?.addEventListener("submit", addKas);

    $("addAbsensiBtn")?.addEventListener("click", () => openModal("absensiModal"));
    $("absensiForm")?.addEventListener("submit", addAbsensi);

    $("addUserBtn")?.addEventListener("click", () => openUserModal());
    $("userForm")?.addEventListener("submit", saveUser);

    $("myPasswordForm")?.addEventListener("submit", changeMyPassword);

    // Modal Closers
    document.querySelectorAll(".close-modal").forEach(x => {
        x.addEventListener("click", () => closeModal(x.dataset.close));
    });
}

/* =========================================================
   AUTHENTICATION & SESSION MANAGEMENT
   ========================================================= */
function checkSession() {
    try {
        const x = JSON.parse(localStorage.getItem("stepa_user") || "null");
        if (!x?.username) throw 0;
        currentUser = x;
        showApp();
    } catch {
        showLogin();
    }
}

function showLogin() {
    if ($("loginPage")) $("loginPage").style.display = "flex";
    if ($("appPage")) {
        $("appPage").classList.add("hidden");
        $("appPage").style.display = "none";
    }
}

function showApp() {
    if ($("loginPage")) $("loginPage").style.display = "none";
    if ($("appPage")) {
        $("appPage").classList.remove("hidden");
        $("appPage").style.display = "flex";
    }
    updateUserInfo();
    setupRole();
    showPage("dashboard");
    loadData();
}

function updateUserInfo() {
    if ($("userName")) $("userName").textContent = currentUser.nama || currentUser.username;
    if ($("userRole")) $("userRole").textContent = currentUser.role || "Anggota";
    if ($("userAvatar")) $("userAvatar").textContent = (currentUser.nama || currentUser.username || "U")[0].toUpperCase();
}

function setupRole() {
    document.querySelectorAll(".pengurus-only").forEach(x => {
        x.style.display = pengurus() ? "" : "none";
    });
}

async function login(e) {
    e.preventDefault();
    const u = $("username")?.value.trim();
    const p = $("password")?.value || "";

    if (!u || !p) return toast("Username dan password wajib diisi.");

    try {
        const r = await api("login", { username: u, password: p });
        currentUser = { ...r.data, password: p };
        localStorage.setItem("stepa_user", JSON.stringify(currentUser));
        showApp();
        toast("Login berhasil.");
    } catch (err) {
        if ($("loginMessage")) $("loginMessage").textContent = err.message;
        else toast(err.message);
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem("stepa_user");
    showLogin();
}

/* =========================================================
   NAVIGASI HALAMAN
   ========================================================= */
function showPage(n) {
    const pages = ["dashboard", "kas", "absensi", "anggota", "akun"];
    if (!pages.includes(n)) n = "dashboard";

    document.querySelectorAll(".page").forEach(x => x.classList.remove("active-page"));
    $(n + "Page")?.classList.add("active-page");

    document.querySelectorAll(".nav-item").forEach(x => {
        x.classList.toggle("active", x.dataset.page === n);
    });

    const titleMap = {
        dashboard: ["Dashboard", "Ringkasan kegiatan STEPA"],
        kas: ["Kas STEPA", "Kelola pemasukan dan pengeluaran kas"],
        absensi: ["Absensi", "Catat kehadiran calon anggota STEPA"],
        anggota: ["Calon Anggota", "Data calon anggota STEPA"],
        akun: ["Manajemen Akun", "Kelola username, password, nama, role, dan status akun STEPA"]
    };

    if ($("pageTitle")) $("pageTitle").textContent = titleMap[n][0];
    if ($("pageSubtitle")) $("pageSubtitle").textContent = titleMap[n][1];

    if (n === "anggota") setTimeout(setupUpload, 0);
    if (n === "akun") loadUsers();
}

/* =========================================================
   DATA RENDER & LOADERS
   ========================================================= */
async function loadData() {
    if (!currentUser) return;
    try {
        const r = await api("allData", auth());
        data = {
            anggota: r.data?.anggota || [],
            kas: r.data?.kas || [],
            absensi: r.data?.absensi || []
        };
        renderAll();
    } catch (e) {
        toast("Gagal memuat data: " + e.message);
    }
}

function renderAll() {
    renderDashboard();
    renderAnggota();
    renderKas();
    renderAbsensi();
    populateNames();
    setupRole();
    setupUpload();
}

function renderDashboard() {
    let masuk = 0, keluar = 0;
    (data.kas || []).forEach(x => {
        const n = Number(x.nominal) || 0;
        const j = String(x.jenis || "").toLowerCase();
        if (j.includes("masuk")) masuk += n;
        if (j.includes("keluar")) keluar += n;
    });

    const saldo = masuk - keluar;

    if ($("statAnggota")) $("statAnggota").textContent = data.anggota?.length || 0;
    if ($("statMasuk")) $("statMasuk").textContent = rupiah(masuk);
    if ($("statKeluar")) $("statKeluar").textContent = rupiah(keluar);
    if ($("statSaldo")) $("statSaldo").textContent = rupiah(saldo);

    // Sync juga ke summary kas page
    if ($("kasMasuk")) $("kasMasuk").textContent = rupiah(masuk);
    if ($("kasKeluar")) $("kasKeluar").textContent = rupiah(keluar);
    if ($("kasSaldo")) $("kasSaldo").textContent = rupiah(saldo);

    if ($("dashboardAbsensi")) {
        $("dashboardAbsensi").innerHTML = (data.absensi || []).slice(-5).reverse().map(x => `
            <tr>
                <td>${esc(x.tanggal)}</td>
                <td>${esc(x.nama)}</td>
                <td>${esc(x.status)}</td>
            </tr>
        `).join("") || `<tr><td colspan="3">Belum ada data absensi.</td></tr>`;
    }

    if ($("dashboardKas")) {
        $("dashboardKas").innerHTML = (data.kas || []).slice(-5).reverse().map(x => `
            <tr>
                <td>${esc(x.tanggal)}</td>
                <td>${esc(x.keterangan)}</td>
                <td>${rupiah(x.nominal)}</td>
            </tr>
        `).join("") || `<tr><td colspan="3">Belum ada transaksi kas.</td></tr>`;
    }
}

/* =========================================================
   RENDER & HAPUS ANGGOTA
   ========================================================= */
function renderAnggota() {
    const t = $("anggotaTable");
    if (!t) return;

    if (!data.anggota?.length) {
        t.innerHTML = `<tr><td colspan="6">Belum ada calon anggota.</td></tr>`;
        return;
    }

    t.innerHTML = data.anggota.map((x, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${esc(x.nama)}</td>
            <td>${esc(x.kelas)}</td>
            <td>${esc(x.hp)}</td>
            <td>${esc(x.status)}</td>
            <td class="pengurus-only">
                <button class="small-btn danger-btn" type="button" onclick="deleteAnggota(${i})">🗑️ Hapus</button>
            </td>
        </tr>
    `).join("");

    setupRole();
}

function deleteAnggota(index) {
    if (!pengurus()) return toast("Hanya Pengurus yang dapat menghapus data.");

    const targetNama = data.anggota[index]?.nama;
    if (!confirm(`Apakah kamu yakin ingin menghapus data "${targetNama}"?`)) return;

    data.anggota.splice(index, 1);

    const localAnggota = JSON.parse(localStorage.getItem("stepa_local_anggota") || "[]");
    const updatedLocal = localAnggota.filter(x => x.nama !== targetNama);
    localStorage.setItem("stepa_local_anggota", JSON.stringify(updatedLocal));

    renderAnggota();
    populateNames();
    if ($("statAnggota")) $("statAnggota").textContent = data.anggota.length;

    toast(`Data "${targetNama}" berhasil dihapus.`);
}

/* =========================================================
   RENDER & HAPUS KAS
   ========================================================= */
function renderKas() {
    const table = document.getElementById("kasTable");
    if (!table) return;

    table.innerHTML = "";

    let totalMasuk = 0;
    let totalKeluar = 0;

    if (!data.kas || data.kas.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="6" class="empty">
                    Belum ada catatan kas.
                </td>
            </tr>
        `;
    } else {
        data.kas.forEach((item, index) => {

            const nominal = Number(item.nominal) || 0;
            const jenis = String(item.jenis || "").trim().toLowerCase();

            if (
                jenis === "masuk" ||
                jenis === "pemasukan"
            ) {
                totalMasuk += nominal;
            } else if (
                jenis === "keluar" ||
                jenis === "pengeluaran"
            ) {
                totalKeluar += nominal;
            }

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${index + 1}</td>

                <td>${item.tanggal || "-"}</td>

                <td>
                    <span class="badge ${
                        jenis === "masuk" ||
                        jenis === "pemasukan"
                            ? "hadir"
                            : "alpa"
                    }">
                        ${item.jenis || "-"}
                    </span>
                </td>

                <td>${item.keterangan || "-"}</td>

                <td>
                    Rp ${nominal.toLocaleString("id-ID")}
                </td>

                <td class="pengurus-only">
                    <button
                        class="delete-btn"
                        onclick="deleteKas('${item.id}')"
                    >
                        Hapus
                    </button>
                </td>
            `;

            table.appendChild(tr);
        });
    }

    const saldo = totalMasuk - totalKeluar;

    // SESUAI DENGAN ID DI index.html
    const kasMasuk = document.getElementById("kasMasuk");
    const kasKeluar = document.getElementById("kasKeluar");
    const kasSaldo = document.getElementById("kasSaldo");

    if (kasMasuk) {
        kasMasuk.textContent =
            "Rp " + totalMasuk.toLocaleString("id-ID");
    }

    if (kasKeluar) {
        kasKeluar.textContent =
            "Rp " + totalKeluar.toLocaleString("id-ID");
    }

    if (kasSaldo) {
        kasSaldo.textContent =
            "Rp " + saldo.toLocaleString("id-ID");
    }

    setupUserRoleUI();
}

function deleteKas(index) {
    if (!pengurus()) return toast("Hanya Pengurus yang dapat menghapus data kas.");

    const item = data.kas[index];
    const ket = item?.keterangan || "transaksi ini";

    if (!confirm(`Apakah kamu yakin ingin menghapus catatan kas "${ket}"?`)) return;

    data.kas.splice(index, 1);

    const localKas = JSON.parse(localStorage.getItem("stepa_local_kas") || "[]");
    const updatedLocal = localKas.filter((_, idx) => idx !== index);
    localStorage.setItem("stepa_local_kas", JSON.stringify(updatedLocal));

    renderKas();
    renderDashboard();

    toast(`Catatan kas "${ket}" berhasil dihapus.`);
}


/* =========================================================
   TRANSAKSI KAS & ABSENSI
   ========================================================= */
async function addKas(e) {
    e.preventDefault();
    if (!pengurus()) return toast("Hanya Pengurus yang dapat menambah kas.");

    try {
        await api("addKas", {
            ...auth(),
            jenis: $("kasJenis").value,
            keterangan: $("kasKeterangan").value.trim(),
            nominal: $("kasNominal").value
        });
        closeModal("kasModal");
        e.target.reset();
        await loadData();
        toast("Transaksi kas berhasil disimpan.");
    } catch (x) {
        toast(x.message);
    }
}

async function addAbsensi(e) {
    e.preventDefault();
    if (!pengurus()) return toast("Hanya Pengurus yang dapat mengisi absensi.");

    try {
        await api("addAbsensi", {
            ...auth(),
            tanggal: $("absensiTanggal").value,
            nama: $("absensiNama").value,
            status: $("absensiStatus").value,
            keterangan: $("absensiKeterangan").value.trim()
        });
        closeModal("absensiModal");
        e.target.reset();
        await loadData();
        toast("Absensi berhasil disimpan.");
    } catch (x) {
        toast(x.message);
    }
}

/* =========================================================
   MANAJEMEN AKUN
   ========================================================= */
async function loadUsers() {
    const table = $("usersTable");
    if (!table || !pengurus()) return;

    if (!currentUser?.password) {
        table.innerHTML = `<tr><td colspan="6" class="empty">Silakan logout lalu login kembali untuk mengelola akun.</td></tr>`;
        return;
    }

    table.innerHTML = `<tr><td colspan="6" class="empty">⏳ Memuat akun...</td></tr>`;

    try {
        const response = await api("listUsers", auth());
        const users = Array.isArray(response.data) ? response.data : [];

        if (!users.length) {
            table.innerHTML = `<tr><td colspan="6" class="empty">Belum ada akun.</td></tr>`;
            return;
        }

        table.innerHTML = "";

        users.forEach((user, index) => {
            const tr = document.createElement("tr");
            const statusClass = user.aktif ? "account-status-active" : "account-status-off";

            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${esc(user.username)}</td>
                <td>${esc(user.nama)}</td>
                <td>${esc(user.role)}</td>
                <td class="${statusClass}">${user.aktif ? "Aktif" : "Nonaktif"}</td>
                <td>
                    <div class="account-action">
                        <button class="account-edit small-btn" type="button">✏️ Edit</button>
                        ${
                            String(user.username).toLowerCase() !== String(currentUser.username).toLowerCase()
                            ? `<button class="account-delete small-btn" type="button">🗑️ Hapus</button>`
                            : ""
                        }
                    </div>
                </td>
            `;

            tr.querySelector(".account-edit").addEventListener("click", () => openUserModal(user));

            const deleteBtn = tr.querySelector(".account-delete");
            if (deleteBtn) {
                deleteBtn.addEventListener("click", () => deleteUserAccount(user.username));
            }

            table.appendChild(tr);
        });

    } catch (error) {
        table.innerHTML = `<tr><td colspan="6" class="empty">Gagal memuat akun: ${esc(error.message)}</td></tr>`;
        toast(error.message);
    }
}

function openUserModal(user = null) {
    if (!pengurus()) return;

    const title = $("userModalTitle");
    const oldUsername = $("editOldUsername");
    const username = $("accountUsername");
    const password = $("accountPassword");
    const nama = $("accountNama");
    const role = $("accountRole");
    const aktif = $("accountAktif");
    const hint = $("passwordHint");

    if (!title || !oldUsername || !username || !password || !nama || !role || !aktif) {
        return toast("Form Manajemen Akun tidak ditemukan.");
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
        if (hint) hint.textContent = "Kosongkan password jika tidak ingin mengubahnya.";
    } else {
        title.textContent = "Tambah Akun";
        oldUsername.value = "";
        username.value = "";
        password.value = "";
        password.required = true;
        nama.value = "";
        role.value = "Anggota";
        aktif.value = "TRUE";
        if (hint) hint.textContent = "Minimal 4 karakter.";
    }

    openModal("userModal");
}

async function saveUser(event) {
    event.preventDefault();
    if (!pengurus()) return toast("Akses hanya untuk Pengurus.");

    const oldUsername = $("editOldUsername").value.trim();
    const username = $("accountUsername").value.trim();
    const password = $("accountPassword").value;
    const nama = $("accountNama").value.trim();
    const role = $("accountRole").value;
    const aktif = $("accountAktif").value;

    if (!username || !nama) return toast("Username dan nama wajib diisi.");
    if (!oldUsername && password.length < 4) return toast("Password minimal 4 karakter.");
    if (oldUsername && password && password.length < 4) return toast("Password minimal 4 karakter.");

    try {
        const action = oldUsername ? "updateUser" : "addUser";

        await api(action, {
            ...auth(),
            oldUsername: oldUsername,
            username: username,
            password: password,
            nama: nama,
            role: role,
            aktif: aktif
        });

        if (oldUsername && oldUsername.toLowerCase() === currentUser.username.toLowerCase()) {
            currentUser.username = username;
            currentUser.nama = nama;
            currentUser.role = role;
            if (password) currentUser.password = password;

            localStorage.setItem("stepa_user", JSON.stringify(currentUser));
            updateUserInfo();
            setupRole();
        }

        closeModal("userModal");
        event.target.reset();
        await loadUsers();
        toast(oldUsername ? "Akun berhasil diperbarui." : "Akun berhasil dibuat.");

    } catch (error) {
        toast("Gagal: " + error.message);
    }
}

async function deleteUserAccount(username) {
    if (!pengurus()) return;

    if (String(username).toLowerCase() === String(currentUser.username).toLowerCase()) {
        return toast("Akun yang sedang digunakan tidak boleh dihapus.");
    }

    if (!confirm(`Hapus akun "${username}"?`)) return;

    try {
        await api("deleteUser", {
            ...auth(),
            username: username,
            requester: currentUser.username
        });

        await loadUsers();
        toast("Akun berhasil dihapus.");

    } catch (error) {
        toast("Gagal menghapus akun: " + error.message);
    }
}

async function changeMyPassword(event) {
    event.preventDefault();

    if (!currentUser?.password) return toast("Silakan logout lalu login kembali.");

    const oldPassword = $("oldPasswordAccount").value;
    const newPassword = $("newPasswordAccount").value;

    if (newPassword.length < 4) return toast("Password baru minimal 4 karakter.");

    try {
        await api("changePassword", {
            username: currentUser.username,
            password: currentUser.password,
            oldPassword: oldPassword,
            newPassword: newPassword
        });

        currentUser.password = newPassword;
        localStorage.setItem("stepa_user", JSON.stringify(currentUser));

        event.target.reset();
        toast("Password berhasil diubah.");

    } catch (error) {
        toast("Gagal mengubah password: " + error.message);
    }
}

/* =========================================================
   LOAD DATA (TERMASUK MEMUAT SIMPANAN LOKAL)
   ========================================================= */
async function loadData() {
    if (!currentUser) return;
    try {
        const r = await api("allData", auth());
        
        // Ambil data dari server
        const serverAnggota = r.data?.anggota || [];
        
        // Ambil data tambahan yang pernah di-upload lokal dari localStorage
        const localAnggota = JSON.parse(localStorage.getItem("stepa_local_anggota") || "[]");

        data = {
            // Gabungkan data server dengan data upload lokal
            anggota: [...serverAnggota, ...localAnggota],
            kas: r.data?.kas || [],
            absensi: r.data?.absensi || []
        };
        
        renderAll();
    } catch (e) {
        toast("Gagal memuat data: " + e.message);
    }
}

/* =========================================================
   UPLOAD EXCEL / CSV INTEGRATION (SIMPAN KE LOCALSTORAGE)
   ========================================================= */
function setupUpload() {
    const t = $("anggotaTable");
    if (!t || $("uploadAnggotaBtn")) return;

    const c = t.closest(".table-container");
    const w = c?.parentElement;
    if (!w) return;

    const b = document.createElement("button");
    b.id = "uploadAnggotaBtn";
    b.className = "primary-btn pengurus-only";
    b.type = "button";
    b.textContent = "📁 Upload Excel / CSV";
    b.style.marginBottom = "12px";
    b.onclick = () => $("anggotaFileInput").click();
    w.insertBefore(b, c);

    const i = document.createElement("input");
    i.id = "anggotaFileInput";
    i.type = "file";
    i.accept = ".xlsx,.xls,.csv";
    i.hidden = true;
    i.onchange = uploadFile;
    document.body.appendChild(i);

    setupRole();
}

function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxPromise) return xlsxPromise;

    xlsxPromise = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
        s.onload = () => resolve(window.XLSX);
        s.onerror = () => reject(new Error("Library Excel gagal dimuat."));
        document.head.appendChild(s);
    });

    return xlsxPromise;
}

function csv(text) {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const delimiter = lines[0].includes(";") ? ";" : ",";
    const headers = lines.shift().split(delimiter).map(x => x.trim().toLowerCase());

    return lines.map(line => {
        const arr = line.split(delimiter);
        const obj = {};
        headers.forEach((k, idx) => {
            if (k) obj[k] = (arr[idx] || "").trim();
        });
        return obj;
    });
}

function norm(item) {
    let namaVal = "";
    let kelasVal = "";
    let hpVal = "";
    let statusVal = "";

    Object.keys(item).forEach(key => {
        const cleanKey = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
        const val = String(item[key] || "").trim();

        if (!val) return;

        if (!namaVal && (
            cleanKey.includes("nama") || 
            cleanKey.includes("name") || 
            cleanKey.includes("siswa") || 
            cleanKey.includes("anggota") || 
            cleanKey.includes("peserta")
        )) {
            namaVal = val;
        }

        if (!kelasVal && (
            cleanKey.includes("kelas") || 
            cleanKey.includes("class") || 
            cleanKey.includes("jurusan") || 
            cleanKey.includes("rombel")
        )) {
            kelasVal = val;
        }

        if (!hpVal && (
            cleanKey.includes("hp") || 
            cleanKey.includes("wa") || 
            cleanKey.includes("telp") || 
            cleanKey.includes("kontak") || 
            cleanKey.includes("phone")
        )) {
            hpVal = val;
        }

        if (!statusVal && cleanKey.includes("status")) {
            statusVal = val;
        }
    });

    if (!namaVal) {
        const values = Object.values(item).map(v => String(v).trim()).filter(Boolean);
        if (values.length > 0) namaVal = values[0];
        if (values.length > 1 && !kelasVal) kelasVal = values[1];
    }

    return {
        nama: namaVal,
        kelas: kelasVal || "-",
        hp: hpVal || "-",
        status: statusVal || "Aktif"
    };
}

async function uploadFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!pengurus()) {
        toast("Hanya Pengurus yang dapat upload.");
        e.target.value = "";
        return;
    }

    const b = $("uploadAnggotaBtn");

    try {
        let rows;
        if (f.name.toLowerCase().endsWith(".csv")) {
            rows = csv(await f.text());
        } else {
            const X = await loadXLSX();
            const wb = X.read(await f.arrayBuffer(), { type: "array" });
            rows = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        }

        const dataAnggotaBaru = rows.map(norm).filter(x => x.nama);
        
        if (!dataAnggotaBaru.length) {
            throw new Error("Tidak ada data nama yang bisa dibaca dari file.");
        }

        // 1. Ambil data lokal yang sudah ada sebelumnya
        const existingLocal = JSON.parse(localStorage.getItem("stepa_local_anggota") || "[]");
        
        // 2. Gabungkan data lama + data baru hasil upload
        const updatedLocal = [...existingLocal, ...dataAnggotaBaru];
        
        // 3. Simpan permanen ke localStorage browser
        localStorage.setItem("stepa_local_anggota", JSON.stringify(updatedLocal));

        // 4. Perbarui data di halaman web
        data.anggota = [...(data.anggota || []), ...dataAnggotaBaru];
        renderAnggota();
        populateNames();
        if ($("statAnggota")) $("statAnggota").textContent = data.anggota.length;

        toast(`${dataAnggotaBaru.length} data anggota berhasil disimpan di website.`);

    } catch (x) {
        alert("Upload gagal:\n\n" + x.message);
    } finally {
        e.target.value = "";
        if (b) {
            b.disabled = false;
            b.textContent = "📁 Upload Excel / CSV";
        }
    }
}
/* =========================================================
   GLOBAL SCOPE EXPORTS
   ========================================================= */
window.showPage = showPage;
window.openModal = openModal;
window.closeModal = closeModal;
window.loadData = loadData;
window.deleteKas = deleteKas;
