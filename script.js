/* ================= KONFIGURASI ================= */

// URL Apps Script Web App Terbaru
const API_URL = "https://script.google.com/macros/s/AKfycbxBAHyviSvcV5jIjA4s3kCWk85hwxlYcoDd6Mlo5WjkVBlcgR2MGz5wItAilVDDsiCc6w/exec";

// Global Data
let currentUser = null;
let data = { anggota: [], kas: [], absensi: [] };


/* ================= INISIALISASI ================= */

document.addEventListener("DOMContentLoaded", () => {
    checkSession();
    setupEventListeners();
});


/* ================= UTILS & API ================= */

function callAPI(action, params = {}) {
    return new Promise((resolve, reject) => {
        const callbackName = "jsonp_cb_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
        
        const queryParams = new URLSearchParams({
            action: action,
            callback: callbackName,
            ...params
        });

        const script = document.createElement("script");
        script.src = `${API_URL}?${queryParams.toString()}`;

        window[callbackName] = function(response) {
            delete window[callbackName];
            if (document.body.contains(script)) document.body.removeChild(script);
            
            if (response && response.success) resolve(response);
            else reject(new Error(response ? response.message : "Gagal memproses data."));
        };

        script.onerror = function() {
            delete window[callbackName];
            if (document.body.contains(script)) document.body.removeChild(script);
            reject(new Error("Gagal terhubung ke Google Apps Script."));
        };

        document.body.appendChild(script);
    });
}

function showToast(message) {
    const toast = document.getElementById("toast");
    if (toast) {
        toast.textContent = message;
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 3000);
    } else {
        alert(message);
    }
}

function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("show");
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("show");
}


/* ================= AUTENTIKASI ================= */

function checkSession() {
    const saved = localStorage.getItem("stepa_user");
    if (saved) {
        currentUser = JSON.parse(saved);
        showMainApp();
    } else {
        showLoginPage();
    }
}

function showLoginPage() {
    document.getElementById("loginSection").style.display = "flex";
    document.getElementById("appSection").style.display = "none";
}

function showMainApp() {
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("appSection").style.display = "block";
    
    document.getElementById("userDisplayName").textContent = currentUser.nama;
    document.getElementById("userRoleBadge").textContent = currentUser.role;

    setupUserRoleUI();
    loadAllData();
}

function setupUserRoleUI() {
    const isPengurus = currentUser && currentUser.role.toLowerCase() === "pengurus";
    document.querySelectorAll(".pengurus-only").forEach(el => {
        el.style.display = isPengurus ? "" : "none";
    });
}


/* ================= EVENT LISTENERS ================= */

function setupEventListeners() {
    // Login & Logout
    const loginForm = document.getElementById("loginForm");
    if (loginForm) loginForm.addEventListener("submit", handleLogin);

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

    // Sinkronisasi
    const syncBtn = document.getElementById("syncBtn");
    if (syncBtn) syncBtn.addEventListener("click", syncData);

    // Navigation Tabs
    document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const target = link.getAttribute("data-tab");
            
            document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
            link.classList.add("active");

            document.querySelectorAll(".tab-content").forEach(tab => tab.style.display = "none");
            const activeTab = document.getElementById(target + "Tab");
            if (activeTab) activeTab.style.display = "block";
        });
    });

    // Close Modals
    document.querySelectorAll(".close-modal").forEach(btn => {
        btn.addEventListener("click", () => closeModal(btn.getAttribute("data-close")));
    });

    // Modal Anggota
    const addAnggotaBtn = document.getElementById("addAnggotaBtn");
    if (addAnggotaBtn) addAnggotaBtn.addEventListener("click", () => openModal("anggotaModal"));

    const anggotaForm = document.getElementById("anggotaForm");
    if (anggotaForm) anggotaForm.addEventListener("submit", handleAddAnggota);

    // Modal Kas
    const addKasBtn = document.getElementById("addKasBtn");
    if (addKasBtn) addKasBtn.addEventListener("click", () => openModal("kasModal"));

    const kasForm = document.getElementById("kasForm");
    if (kasForm) kasForm.addEventListener("submit", handleAddKas);

    // Modal Absensi
    const addAbsensiBtn = document.getElementById("addAbsensiBtn");
    if (addAbsensiBtn) addAbsensiBtn.addEventListener("click", () => openModal("absensiModal"));

    const absensiForm = document.getElementById("absensiForm");
    if (absensiForm) absensiForm.addEventListener("submit", handleAddAbsensi);
}


/* ================= API ACTIONS ================= */

async function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById("username").value.trim();
    const p = document.getElementById("password").value.trim();

    try {
        const res = await callAPI("login", { username: u, password: p });
        currentUser = res.data;
        localStorage.setItem("stepa_user", JSON.stringify(currentUser));
        showToast("Login berhasil! Selamat datang " + currentUser.nama);
        showMainApp();
    } catch (err) {
        showToast("Login gagal: " + err.message);
    }
}

function handleLogout() {
    localStorage.removeItem("stepa_user");
    currentUser = null;
    showToast("Berhasil logout.");
    showLoginPage();
}

async function loadAllData() {
    try {
        const res = await callAPI("allData");
        data = res.data;
        renderAll();
    } catch (err) {
        showToast("Gagal memuat data: " + err.message);
    }
}

async function syncData() {
    const btn = document.getElementById("syncBtn");
    if (btn) btn.disabled = true;
    showToast("Menyingkronkan data dari Google Sheets...");

    try {
        await loadAllData();
        showToast("Semua data berhasil disinkronkan!");
    } catch (err) {
        showToast("Sinkronisasi gagal: " + err.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function handleAddAnggota(e) {
    e.preventDefault();
    const nama = document.getElementById("anggotaNama").value.trim();
    const kelas = document.getElementById("anggotaKelas").value.trim();
    const hp = document.getElementById("anggotaHp").value.trim();
    const status = document.getElementById("anggotaStatus").value;

    try {
        await callAPI("addAnggota", { nama, kelas, hp, status, username: currentUser.username });
        closeModal("anggotaModal");
        e.target.reset();
        await loadAllData();
        showToast("Calon anggota berhasil ditambahkan.");
    } catch (err) {
        showToast(err.message);
    }
}

async function deleteAnggota(id) {
    if (!confirm("Apakah Anda yakin ingin menghapus data anggota ini?")) return;
    try {
        await callAPI("deleteAnggota", { id, username: currentUser.username });
        await loadAllData();
        showToast("Data anggota berhasil dihapus.");
    } catch (err) {
        showToast(err.message);
    }
}

async function handleAddKas(e) {
    e.preventDefault();
    const jenis = document.getElementById("kasJenis").value;
    const keterangan = document.getElementById("kasKeterangan").value.trim();
    const nominal = document.getElementById("kasNominal").value;

    try {
        await callAPI("addKas", { jenis, keterangan, nominal, username: currentUser.username });
        closeModal("kasModal");
        e.target.reset();
        await loadAllData();
        showToast("Transaksi kas berhasil disimpan.");
    } catch (err) {
        showToast(err.message);
    }
}

async function deleteKas(id) {
    if (!confirm("Apakah Anda yakin ingin menghapus data kas ini?")) return;
    try {
        await callAPI("deleteKas", { id, username: currentUser.username });
        await loadAllData();
        showToast("Data kas berhasil dihapus.");
    } catch (err) {
        showToast(err.message);
    }
}

async function handleAddAbsensi(e) {
    e.preventDefault();
    const tanggal = document.getElementById("absensiTanggal").value;
    const nama = document.getElementById("absensiNamaSelect").value;
    const status = document.getElementById("absensiStatus").value;
    const keterangan = document.getElementById("absensiKeterangan").value.trim();

    try {
        await callAPI("addAbsensi", { tanggal, nama, status, keterangan, username: currentUser.username });
        closeModal("absensiModal");
        e.target.reset();
        await loadAllData();
        showToast("Absensi berhasil dicatat.");
    } catch (err) {
        showToast(err.message);
    }
}

async function deleteAbsensi(id) {
    if (!confirm("Apakah Anda yakin ingin menghapus data absensi ini?")) return;
    try {
        await callAPI("deleteAbsensi", { id, username: currentUser.username });
        await loadAllData();
        showToast("Data absensi berhasil dihapus.");
    } catch (err) {
        showToast(err.message);
    }
}


/* ================= RENDERING ================= */

function renderAll() {
    renderAnggota();
    renderKas();
    renderAbsensi();
    populateAbsensiNames();
}

function renderAnggota() {
    const table = document.getElementById("anggotaTable");
    if (!table) return;

    table.innerHTML = "";
    if (!data.anggota || !data.anggota.length) {
        table.innerHTML = `<tr><td colspan="6" class="empty">Belum ada calon anggota.</td></tr>`;
        return;
    }

    data.anggota.forEach((item, index) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.nama}</td>
            <td>${item.kelas || "-"}</td>
            <td>${item.hp || "-"}</td>
            <td>
                <span class="badge ${item.status === 'Aktif' ? 'hadir' : 'alpa'}">
                    ${item.status || "Aktif"}
                </span>
            </td>
            <td class="pengurus-only">
                <button class="delete-btn" onclick="deleteAnggota('${item.id}')">Hapus</button>
            </td>
        `;
        table.appendChild(tr);
    });
    setupUserRoleUI();
}

function renderKas() {
    const table = document.getElementById("kasTable");
    if (!table) return;

    table.innerHTML = "";
    let totalMasuk = 0;
    let totalKeluar = 0;

    if (!data.kas || !data.kas.length) {
        table.innerHTML = `<tr><td colspan="6" class="empty">Belum ada catatan kas.</td></tr>`;
    } else {
        data.kas.forEach((item, index) => {
            const nominal = Number(item.nominal) || 0;
            if (item.jenis === "Masuk") totalMasuk += nominal;
            else totalKeluar += nominal;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${item.tanggal || "-"}</td>
                <td><span class="badge ${item.jenis === 'Masuk' ? 'hadir' : 'alpa'}">${item.jenis}</span></td>
                <td>${item.keterangan || "-"}</td>
                <td>Rp ${nominal.toLocaleString("id-ID")}</td>
                <td class="pengurus-only">
                    <button class="delete-btn" onclick="deleteKas('${item.id}')">Hapus</button>
                </td>
            `;
            table.appendChild(tr);
        });
    }

    const saldo = totalMasuk - totalKeluar;
    if (document.getElementById("totalMasuk")) document.getElementById("totalMasuk").textContent = "Rp " + totalMasuk.toLocaleString("id-ID");
    if (document.getElementById("totalKeluar")) document.getElementById("totalKeluar").textContent = "Rp " + totalKeluar.toLocaleString("id-ID");
    if (document.getElementById("sisaSaldo")) document.getElementById("sisaSaldo").textContent = "Rp " + saldo.toLocaleString("id-ID");

    setupUserRoleUI();
}

function renderAbsensi() {
    const table = document.getElementById("absensiTable");
    if (!table) return;

    table.innerHTML = "";
    if (!data.absensi || !data.absensi.length) {
        table.innerHTML = `<tr><td colspan="6" class="empty">Belum ada catatan absensi.</td></tr>`;
        return;
    }

    data.absensi.forEach((item, index) => {
        let badgeClass = "hadir";
        if (item.status === "Izin" || item.status === "Sakit") badgeClass = "izin";
        else if (item.status === "Alpa") badgeClass = "alpa";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.tanggal || "-"}</td>
            <td>${item.nama}</td>
            <td><span class="badge ${badgeClass}">${item.status}</span></td>
            <td>${item.keterangan || "-"}</td>
            <td class="pengurus-only">
                <button class="delete-btn" onclick="deleteAbsensi('${item.id}')">Hapus</button>
            </td>
        `;
        table.appendChild(tr);
    });

    setupUserRoleUI();
}

function populateAbsensiNames() {
    const select = document.getElementById("absensiNamaSelect");
    if (!select) return;

    select.innerHTML = `<option value="">-- Pilih Anggota --</option>`;
    if (data.anggota && data.anggota.length) {
        data.anggota.forEach(item => {
            const opt = document.createElement("option");
            opt.value = item.nama;
            opt.textContent = `${item.nama} (${item.kelas || '-'})`;
            select.appendChild(opt);
        });
    }
}
