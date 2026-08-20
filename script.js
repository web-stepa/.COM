/* ================= KONFIGURASI ================= */

// URL Google Apps Script Web App Anda
const API_URL = "https://script.google.com/macros/s/AKfycbxBa2DZVgsvAr_gMrJ6JeJK6t54_FaFKNzRy6e7YM2ese1VXow6t1xVF27E1-2yWzUqRw/exec";

// Variabel Global Data
let currentUser = null;
let data = {
    anggota: [],
    kas: [],
    absensi: []
};


/* ================= INISIALISASI APLIKASI ================= */

document.addEventListener("DOMContentLoaded", () => {
    checkSession();
    setupEventListeners();
});


/* ================= HELPER & UTILITIES ================= */

// Fungsi Panggilan API ke Google Apps Script (JSONP)
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
            document.body.removeChild(script);
            
            if (response && response.success) {
                resolve(response);
            } else {
                reject(new Error(response ? response.message : "Terjadi kesalahan pada server."));
            }
        };

        script.onerror = function() {
            delete window[callbackName];
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
            reject(new Error("Gagal terhubung ke Google Apps Script. Periksa koneksi internet Anda."));
        };

        document.body.appendChild(script);
    });
}

// Notifikasi Toast
function showToast(message) {
    const toast = document.getElementById("toast");
    if (toast) {
        toast.textContent = message;
        toast.classList.add("show");
        setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    } else {
        alert(message);
    }
}

// Pengelolaan Modal
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add("show");
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove("show");
}


/* ================= SESSION & AUTHENTICATION ================= */

function checkSession() {
    const savedUser = localStorage.getItem("stepa_user");
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
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
    
    // Set Nama & Role User
    document.getElementById("userDisplayName").textContent = currentUser.nama;
    document.getElementById("userRoleBadge").textContent = currentUser.role;

    setupUserRoleUI();
    loadAllData();
}

function setupUserRoleUI() {
    const isPengurus = currentUser && currentUser.role.toLowerCase() === "pengurus";
    const pengurusElements = document.querySelectorAll(".pengurus-only");
    
    pengurusElements.forEach(el => {
        el.style.display = isPengurus ? "" : "none";
    });
}


/* ================= SETUP EVENT LISTENERS ================= */

function setupEventListeners() {
    // Form Login
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }

    // Tombol Logout
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", handleLogout);
    }

    // Tombol Sinkronisasi / Refresh
    const syncBtn = document.getElementById("syncBtn");
    if (syncBtn) {
        syncBtn.addEventListener("click", syncData);
    }

    // Navigation Tabs
    const navLinks = document.querySelectorAll(".nav-link");
    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const targetTab = link.getAttribute("data-tab");
            
            navLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");

            document.querySelectorAll(".tab-content").forEach(tab => {
                tab.style.display = "none";
            });

            const activeTab = document.getElementById(targetTab + "Tab");
            if (activeTab) activeTab.style.display = "block";
        });
    });

    // Close Modal Event Listeners
    document.querySelectorAll(".close-modal").forEach(btn => {
        btn.addEventListener("click", () => {
            const modalId = btn.getAttribute("data-close");
            closeModal(modalId);
        });
    });

    // Modal Anggota Events
    const addAnggotaBtn = document.getElementById("addAnggotaBtn");
    if (addAnggotaBtn) {
        addAnggotaBtn.addEventListener("click", () => openModal("anggotaModal"));
    }

    const anggotaForm = document.getElementById("anggotaForm");
    if (anggotaForm) {
        anggotaForm.addEventListener("submit", handleAddAnggota);
    }

    // Modal Kas Events
    const addKasBtn = document.getElementById("addKasBtn");
    if (addKasBtn) {
        addKasBtn.addEventListener("click", () => openModal("kasModal"));
    }

    const kasForm = document.getElementById("kasForm");
    if (kasForm) {
        kasForm.addEventListener("submit", handleAddKas);
    }

    // Modal Absensi Events
    const addAbsensiBtn = document.getElementById("addAbsensiBtn");
    if (addAbsensiBtn) {
        addAbsensiBtn.addEventListener("click", () => openModal("absensiModal"));
    }

    const absensiForm = document.getElementById("absensiForm");
    if (absensiForm) {
        absensiForm.addEventListener("submit", handleAddAbsensi);
    }
}


/* ================= API HANDLERS ================= */

// LOGIN
async function handleLogin(e) {
    e.preventDefault();
    const usernameInput = document.getElementById("username").value.trim();
    const passwordInput = document.getElementById("password").value.trim();

    try {
        const response = await callAPI("login", {
            username: usernameInput,
            password: passwordInput
        });

        currentUser = response.data;
        localStorage.setItem("stepa_user", JSON.stringify(currentUser));
        showToast("Login berhasil! Selamat datang " + currentUser.nama);
        showMainApp();
    } catch (error) {
        showToast("Login gagal: " + error.message);
    }
}

// LOGOUT
function handleLogout() {
    localStorage.removeItem("stepa_user");
    currentUser = null;
    showToast("Berhasil keluar.");
    showLoginPage();
}

// LOAD & SINKRONISASI ALL DATA
async function loadAllData() {
    try {
        const response = await callAPI("allData");
        data = response.data;
        renderAll();
    } catch (error) {
        showToast("Gagal memuat data: " + error.message);
    }
}

async function syncData() {
    const syncBtn = document.getElementById("syncBtn");
    if (syncBtn) syncBtn.disabled = true;
    showToast("Menyingkronkan data dengan Google Sheets...");

    try {
        await loadAllData();
        showToast("Semua data berhasil disinkronkan!");
    } catch (error) {
        showToast("Sinkronisasi gagal: " + error.message);
    } finally {
        if (syncBtn) syncBtn.disabled = false;
    }
}


/* ================= MANAJEMEN ANGGOTA ================= */

async function handleAddAnggota(e) {
    e.preventDefault();

    const nama = document.getElementById("anggotaNama").value.trim();
    const kelas = document.getElementById("anggotaKelas").value.trim();
    const hp = document.getElementById("anggotaHp").value.trim();
    const status = document.getElementById("anggotaStatus").value;

    if (!nama) {
        showToast("Nama anggota wajib diisi!");
        return;
    }

    try {
        await callAPI("addAnggota", {
            nama: nama,
            kelas: kelas,
            hp: hp,
            status: status,
            username: currentUser.username
        });

        closeModal("anggotaModal");
        e.target.reset();
        await loadAllData();
        showToast("Data calon anggota berhasil ditambahkan.");
    } catch (error) {
        showToast(error.message);
    }
}


/* ================= MANAJEMEN KAS ================= */

async function handleAddKas(e) {
    e.preventDefault();

    const jenis = document.getElementById("kasJenis").value;
    const keterangan = document.getElementById("kasKeterangan").value.trim();
    const nominal = document.getElementById("kasNominal").value;

    try {
        await callAPI("addKas", {
            jenis: jenis,
            keterangan: keterangan,
            nominal: nominal,
            username: currentUser.username
        });

        closeModal("kasModal");
        e.target.reset();
        await loadAllData();
        showToast("Transaksi kas berhasil disimpan.");
    } catch (error) {
        showToast(error.message);
    }
}

async function deleteKas(id) {
    if (!confirm("Apakah Anda yakin ingin menghapus data kas ini?")) return;

    try {
        await callAPI("deleteKas", { id: id, username: currentUser.username });
        await loadAllData();
        showToast("Data kas berhasil dihapus.");
    } catch (error) {
        showToast(error.message);
    }
}


/* ================= MANAJEMEN ABSENSI ================= */

async function handleAddAbsensi(e) {
    e.preventDefault();

    const tanggal = document.getElementById("absensiTanggal").value;
    const nama = document.getElementById("absensiNamaSelect").value;
    const status = document.getElementById("absensiStatus").value;
    const keterangan = document.getElementById("absensiKeterangan").value.trim();

    try {
        await callAPI("addAbsensi", {
            tanggal: tanggal,
            nama: nama,
            status: status,
            keterangan: keterangan,
            username: currentUser.username
        });

        closeModal("absensiModal");
        e.target.reset();
        await loadAllData();
        showToast("Absensi berhasil dicatat.");
    } catch (error) {
        showToast(error.message);
    }
}

async function deleteAbsensi(id) {
    if (!confirm("Apakah Anda yakin ingin menghapus data absensi ini?")) return;

    try {
        await callAPI("deleteAbsensi", { id: id, username: currentUser.username });
        await loadAllData();
        showToast("Data absensi berhasil dihapus.");
    } catch (error) {
        showToast(error.message);
    }
}


/* ================= RENDER TO UI ================= */

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
        table.innerHTML = `<tr><td colspan="5" class="empty">Belum ada data calon anggota.</td></tr>`;
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
        `;
        table.appendChild(tr);
    });
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

    // Update Ringkasan Saldo
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
