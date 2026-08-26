/* =====================================================
   STEPA MANAGEMENT - FRONTEND
   Cocok dengan index.html STEPA saat ini
   ===================================================== */

/* ================= KONFIGURASI ================= */

const API_URL = "https://script.google.com/macros/s/AKfycbxYeIYi85RfKBRPuey7v7Z7c9aJ3Iw6MSx9iAmsDuOYsHOEad6jJY2cvvu3aQYvB5q_Dw/exec";

let currentUser = null;

let data = {
    anggota: [],
    kas: [],
    absensi: []
};


/* ================= INISIALISASI ================= */

document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    checkSession();
});


/* ================= API / JSONP ================= */

function callAPI(action, params = {}) {
    return new Promise((resolve, reject) => {

        const callbackName =
            "stepa_cb_" +
            Date.now() +
            "_" +
            Math.floor(Math.random() * 100000);

        const queryParams = new URLSearchParams({
            action: action,
            callback: callbackName,
            ...params
        });

        const script = document.createElement("script");

        script.src =
            API_URL + "?" + queryParams.toString();

        let finished = false;

        const cleanup = () => {
            if (window[callbackName]) {
                delete window[callbackName];
            }

            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        };

        const timeout = setTimeout(() => {
            if (finished) return;

            finished = true;
            cleanup();

            reject(
                new Error(
                    "Waktu koneksi habis. Periksa deployment Google Apps Script."
                )
            );
        }, 15000);

        window[callbackName] = (response) => {
            if (finished) return;

            finished = true;
            clearTimeout(timeout);
            cleanup();

            if (response && response.success) {
                resolve(response);
            } else {
                reject(
                    new Error(
                        response?.message ||
                        "Gagal memproses data."
                    )
                );
            }
        };

        script.onerror = () => {
            if (finished) return;

            finished = true;
            clearTimeout(timeout);
            cleanup();

            reject(
                new Error(
                    "Gagal terhubung ke Google Apps Script."
                )
            );
        };

        document.body.appendChild(script);
    });
}


/* ================= UTILITAS ================= */

function $(id) {
    return document.getElementById(id);
}


function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatRupiah(value) {
    const nominal = Number(value) || 0;

    return "Rp" +
        nominal.toLocaleString("id-ID");
}


function showToast(message) {
    const toast = $("toast");

    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(window.stepaToastTimer);

    window.stepaToastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}


function openModal(id) {
    const modal = $(id);

    if (modal) {
        modal.classList.add("show");
    }
}


function closeModal(id) {
    const modal = $(id);

    if (modal) {
        modal.classList.remove("show");
    }
}


/* ================= SESSION / LOGIN ================= */

function checkSession() {

    const saved =
        localStorage.getItem("stepa_user");

    if (!saved) {
        showLoginPage();
        return;
    }

    try {

        currentUser =
            JSON.parse(saved);

        if (
            !currentUser ||
            !currentUser.username
        ) {
            throw new Error("Session tidak valid.");
        }

        showMainApp();

    } catch (error) {

        localStorage.removeItem("stepa_user");

        currentUser = null;

        showLoginPage();
    }
}


function showLoginPage() {

    const loginPage = $("loginPage");
    const appPage = $("appPage");

    if (loginPage) {
        loginPage.style.display = "flex";
    }

    if (appPage) {
        appPage.classList.add("hidden");
        appPage.style.display = "none";
    }
}


function showMainApp() {

    const loginPage = $("loginPage");
    const appPage = $("appPage");

    if (loginPage) {
        loginPage.style.display = "none";
    }

    if (appPage) {
        appPage.classList.remove("hidden");
        appPage.style.display = "";
    }

    updateUserInfo();
    setupUserRoleUI();
    showPage("dashboard");

    loadAllData();
}


function updateUserInfo() {

    if (!currentUser) return;

    const nama =
        currentUser.nama ||
        currentUser.username ||
        "Pengguna";

    const role =
        currentUser.role ||
        "Anggota";

    if ($("userName")) {
        $("userName").textContent = nama;
    }

    if ($("userRole")) {
        $("userRole").textContent = role;
    }

    if ($("userAvatar")) {
        $("userAvatar").textContent =
            nama.charAt(0).toUpperCase();
    }
}


function setupUserRoleUI() {

    const role =
        String(
            currentUser?.role || ""
        ).toLowerCase();

    const isPengurus =
        role === "pengurus";

    document
        .querySelectorAll(".pengurus-only")
        .forEach((element) => {

            element.style.display =
                isPengurus ? "" : "none";

        });
}


/* ================= NAVIGASI ================= */

function showPage(pageName) {

    const pages = [
        "dashboard",
        "kas",
        "absensi",
        "anggota"
    ];

    if (!pages.includes(pageName)) {
        pageName = "dashboard";
    }

    document
        .querySelectorAll(".page")
        .forEach((page) => {
            page.classList.remove("active-page");
        });

    const targetPage =
        $(pageName + "Page");

    if (targetPage) {
        targetPage.classList.add("active-page");
    }

    document
        .querySelectorAll(".nav-item")
        .forEach((item) => {

            item.classList.toggle(
                "active",
                item.dataset.page === pageName
            );

        });

    const titles = {
        dashboard: {
            title: "Dashboard",
            subtitle: "Ringkasan kegiatan STEPA"
        },

        kas: {
            title: "Kas STEPA",
            subtitle: "Kelola pemasukan dan pengeluaran kas"
        },

        absensi: {
            title: "Absensi",
            subtitle: "Catat kehadiran calon anggota STEPA"
        },

        anggota: {
            title: "Calon Anggota",
            subtitle: "Data calon anggota STEPA"
        }
    };

    const info =
        titles[pageName];

    if ($("pageTitle")) {
        $("pageTitle").textContent =
            info.title;
    }

    if ($("pageSubtitle")) {
        $("pageSubtitle").textContent =
            info.subtitle;
    }


    // Pastikan data sudah tersedia
    if (pageName === "dashboard") {
        renderDashboard();
    }

    if (pageName === "kas") {
        renderKas();
    }

    if (pageName === "absensi") {
        renderAbsensi();
        populateAbsensiNames();
    }

    if (pageName === "anggota") {
        renderAnggota();
    }
}


/* ================= EVENT LISTENERS ================= */

function setupEventListeners() {

    /* LOGIN */

    const loginForm =
        $("loginForm");

    if (loginForm) {
        loginForm.addEventListener(
            "submit",
            handleLogin
        );
    }


    /* SHOW PASSWORD */

    const showPassword =
        $("showPassword");

    if (showPassword) {

        showPassword.addEventListener(
            "click",
            () => {

                const password =
                    $("password");

                if (!password) return;

                if (
                    password.type === "password"
                ) {

                    password.type = "text";

                    showPassword.textContent =
                        "🙈";

                } else {

                    password.type = "password";

                    showPassword.textContent =
                        "👁";

                }
            }
        );
    }


    /* LOGOUT */

    const logoutBtn =
        $("logoutBtn");

    if (logoutBtn) {

        logoutBtn.addEventListener(
            "click",
            handleLogout
        );
    }


    /* NAVIGASI SIDEBAR */

    document
        .querySelectorAll(".nav-item")
        .forEach((button) => {

            button.addEventListener(
                "click",
                () => {

                    const page =
                        button.dataset.page;

                    showPage(page);
                }
            );
        });


    /* BUTTON "LIHAT SEMUA" */

    document
        .querySelectorAll("[data-page-btn]")
        .forEach((button) => {

            button.addEventListener(
                "click",
                () => {

                    showPage(
                        button.dataset.pageBtn
                    );
                }
            );
        });


    /* REFRESH */

    const refreshBtn =
        $("refreshBtn");

    if (refreshBtn) {

        refreshBtn.addEventListener(
            "click",
            async () => {

                await loadAllData();

                showToast(
                    "Data berhasil diperbarui."
                );
            }
        );
    }


    /* SINKRONISASI */

    const syncBtn =
        $("syncBtn");

    if (syncBtn) {

        syncBtn.addEventListener(
            "click",
            syncData
        );
    }


    /* MODAL CLOSE */

    document
        .querySelectorAll(".close-modal")
        .forEach((button) => {

            button.addEventListener(
                "click",
                () => {

                    closeModal(
                        button.dataset.close
                    );

                }
            );
        });


    /* CLOSE MODAL KETIKA KLIK LUAR */

    document
        .querySelectorAll(".modal")
        .forEach((modal) => {

            modal.addEventListener(
                "click",
                (event) => {

                    if (
                        event.target === modal
                    ) {
                        modal.classList.remove(
                            "show"
                        );
                    }

                }
            );
        });


    /* KAS */

    const kasForm =
        $("kasForm");

    if (kasForm) {

        kasForm.addEventListener(
            "submit",
            handleAddKas
        );
    }


    const addKasBtn =
        $("addKasBtn");

    if (addKasBtn) {

        addKasBtn.addEventListener(
            "click",
            () => {

                if (!isPengurus()) {
                    showToast(
                        "Hanya pengurus yang dapat menginput kas."
                    );
                    return;
                }

                openModal("kasModal");
            }
        );
    }


    /* ABSENSI */

    const absensiForm =
        $("absensiForm");

    if (absensiForm) {

        absensiForm.addEventListener(
            "submit",
            handleAddAbsensi
        );
    }


    const addAbsensiBtn =
        $("addAbsensiBtn");

    if (addAbsensiBtn) {

        addAbsensiBtn.addEventListener(
            "click",
            () => {

                if (!isPengurus()) {
                    showToast(
                        "Hanya pengurus yang dapat menginput absensi."
                    );
                    return;
                }

                populateAbsensiNames();
                openModal("absensiModal");
            }
        );
    }
}


/* ================= ROLE ================= */

function isPengurus() {

    return String(
        currentUser?.role || ""
    ).toLowerCase() === "pengurus";
}


/* ================= LOGIN API ================= */

async function handleLogin(event) {

    event.preventDefault();

    const username =
        $("username")?.value.trim();

    const password =
        $("password")?.value.trim();

    const message =
        $("loginMessage");


    if (!username || !password) {

        if (message) {
            message.textContent =
                "Username dan password wajib diisi.";
        }

        return;
    }


    if (message) {
        message.textContent =
            "Sedang masuk...";
    }


    try {

        const response =
            await callAPI(
                "login",
                {
                    username: username,
                    password: password
                }
            );


        if (
            !response ||
            !response.success ||
            !response.data
        ) {
            throw new Error(
                response?.message ||
                "Login gagal."
            );
        }


        currentUser =
            response.data;


        localStorage.setItem(
            "stepa_user",
            JSON.stringify(currentUser)
        );


        if (message) {
            message.textContent = "";
        }


        showMainApp();


        showToast(
            "Login berhasil! Selamat datang " +
            (currentUser.nama ||
                currentUser.username)
        );


    } catch (error) {

        if (message) {
            message.textContent =
                "Login gagal: " +
                error.message;
        }

        console.error(
            "STEPA LOGIN ERROR:",
            error
        );
    }
}


/* ================= LOGOUT ================= */

function handleLogout() {

    localStorage.removeItem(
        "stepa_user"
    );

    currentUser = null;

    data = {
        anggota: [],
        kas: [],
        absensi: []
    };


    if ($("loginForm")) {
        $("loginForm").reset();
    }

    if ($("loginMessage")) {
        $("loginMessage").textContent = "";
    }


    showLoginPage();

    showToast(
        "Berhasil keluar dari akun."
    );
}


/* ================= LOAD DATA ================= */

async function loadAllData() {

    if (!currentUser) return;

    try {

        const response =
            await callAPI("allData");


        data =
            response.data || {
                anggota: [],
                kas: [],
                absensi: []
            };


        // Pastikan setiap array tersedia
        data.anggota =
            Array.isArray(data.anggota)
                ? data.anggota
                : [];

        data.kas =
            Array.isArray(data.kas)
                ? data.kas
                : [];

        data.absensi =
            Array.isArray(data.absensi)
                ? data.absensi
                : [];


        renderAll();


    } catch (error) {

        console.error(
            "LOAD DATA ERROR:",
            error
        );

        showToast(
            "Gagal memuat data: " +
            error.message
        );
    }
}


/* ================= SINKRONISASI ================= */

async function syncData() {

    if (!isPengurus()) {
        showToast(
            "Hanya pengurus yang dapat melakukan sinkronisasi."
        );
        return;
    }

    const button =
        $("syncBtn");

    if (button) {
        button.disabled = true;
        button.textContent =
            "⏳ Menyinkronkan...";
    }


    try {

        await loadAllData();

        showToast(
            "Data berhasil disinkronkan."
        );

    } finally {

        if (button) {
            button.disabled = false;
            button.textContent =
                "🔄 Sinkronisasi";
        }
    }
}


/* ================= ANGGOTA ================= */

function renderAnggota() {

    const table =
        $("anggotaTable");

    if (!table) return;


    table.innerHTML = "";


    if (
        !data.anggota ||
        data.anggota.length === 0
    ) {

        table.innerHTML =
            `<tr>
                <td colspan="5" class="empty">
                    Belum ada calon anggota.
                </td>
            </tr>`;

        return;
    }


    data.anggota.forEach(
        (item, index) => {

            const status =
                item.status || "Aktif";

            const badgeClass =
                String(status).toLowerCase() ===
                "aktif"
                    ? "hadir"
                    : "alpa";


            const row =
                document.createElement("tr");


            row.innerHTML = `
                <td>${index + 1}</td>

                <td>
                    ${escapeHTML(item.nama || "-")}
                </td>

                <td>
                    ${escapeHTML(item.kelas || "-")}
                </td>

                <td>
                    ${escapeHTML(item.hp || "-")}
                </td>

                <td>
                    <span class="badge ${badgeClass}">
                        ${escapeHTML(status)}
                    </span>
                </td>
            `;


            table.appendChild(row);
        }
    );
}


/* ================= KAS ================= */

function normalizeKasJenis(jenis) {

    const value =
        String(jenis || "")
            .trim()
            .toLowerCase();


    if (
        value === "pemasukan" ||
        value === "masuk"
    ) {
        return "Masuk";
    }


    if (
        value === "pengeluaran" ||
        value === "keluar"
    ) {
        return "Keluar";
    }


    return jenis || "";
}


function renderKas() {

    const table =
        $("kasTable");

    if (!table) return;


    table.innerHTML = "";


    let totalMasuk = 0;
    let totalKeluar = 0;


    if (
        !data.kas ||
        data.kas.length === 0
    ) {

        table.innerHTML =
            `<tr>
                <td colspan="5" class="empty">
                    Belum ada catatan kas.
                </td>
            </tr>`;

    } else {

        data.kas.forEach(
            (item) => {

                const jenis =
                    normalizeKasJenis(
                        item.jenis
                    );

                const nominal =
                    Number(item.nominal) || 0;


                if (jenis === "Masuk") {
                    totalMasuk += nominal;
                }

                if (jenis === "Keluar") {
                    totalKeluar += nominal;
                }


                const badgeClass =
                    jenis === "Masuk"
                        ? "hadir"
                        : "alpa";


                const row =
                    document.createElement("tr");


                row.innerHTML = `
                    <td>
                        ${escapeHTML(item.tanggal || "-")}
                    </td>

                    <td>
                        <span class="badge ${badgeClass}">
                            ${escapeHTML(
                                jenis || "-"
                            )}
                        </span>
                    </td>

                    <td>
                        ${escapeHTML(
                            item.keterangan || "-"
                        )}
                    </td>

                    <td>
                        ${formatRupiah(nominal)}
                    </td>

                    <td class="pengurus-only">
                        ${
                            isPengurus()
                                ? `
                                <button
                                    class="delete-btn"
                                    onclick="deleteKas('${escapeHTML(item.id)}')"
                                >
                                    Hapus
                                </button>
                                `
                                : ""
                        }
                    </td>
                `;


                table.appendChild(row);
            }
        );
    }


    const saldo =
        totalMasuk - totalKeluar;


    // Summary halaman kas
    if ($("kasMasuk")) {
        $("kasMasuk").textContent =
            formatRupiah(totalMasuk);
    }

    if ($("kasKeluar")) {
        $("kasKeluar").textContent =
            formatRupiah(totalKeluar);
    }

    if ($("kasSaldo")) {
        $("kasSaldo").textContent =
            formatRupiah(saldo);
    }


    // Summary dashboard
    if ($("statMasuk")) {
        $("statMasuk").textContent =
            formatRupiah(totalMasuk);
    }

    if ($("statKeluar")) {
        $("statKeluar").textContent =
            formatRupiah(totalKeluar);
    }

    if ($("statSaldo")) {
        $("statSaldo").textContent =
            formatRupiah(saldo);
    }


    setupUserRoleUI();
}


/* ================= ABSENSI ================= */

function renderAbsensi() {

    const table =
        $("absensiTable");

    if (!table) return;


    table.innerHTML = "";


    if (
        !data.absensi ||
        data.absensi.length === 0
    ) {

        table.innerHTML =
            `<tr>
                <td colspan="5" class="empty">
                    Belum ada catatan absensi.
                </td>
            </tr>`;

        return;
    }


    data.absensi.forEach(
        (item) => {

            let badgeClass =
                "hadir";


            if (
                item.status === "Izin" ||
                item.status === "Sakit"
            ) {
                badgeClass = "izin";
            }


            if (
                item.status === "Alpa"
            ) {
                badgeClass = "alpa";
            }


            const row =
                document.createElement("tr");


            row.innerHTML = `
                <td>
                    ${escapeHTML(
                        item.tanggal || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.nama || "-"
                    )}
                </td>

                <td>
                    <span class="badge ${badgeClass}">
                        ${escapeHTML(
                            item.status || "-"
                        )}
                    </span>
                </td>

                <td>
                    ${escapeHTML(
                        item.keterangan || "-"
                    )}
                </td>

                <td class="pengurus-only">
                    ${
                        isPengurus()
                            ? `
                            <button
                                class="delete-btn"
                                onclick="deleteAbsensi('${escapeHTML(item.id)}')"
                            >
                                Hapus
                            </button>
                            `
                            : ""
                    }
                </td>
            `;


            table.appendChild(row);
        }
    );


    setupUserRoleUI();
}


function populateAbsensiNames() {

    const select =
        $("absensiNama");


    if (!select) return;


    select.innerHTML =
        `<option value="">
            -- Pilih Anggota --
        </option>`;


    if (
        !data.anggota ||
        data.anggota.length === 0
    ) {

        select.innerHTML =
            `<option value="">
                Belum ada calon anggota
            </option>`;

        return;
    }


    data.anggota.forEach(
        (item) => {

            const option =
                document.createElement("option");


            option.value =
                item.nama || "";


            option.textContent =
                `${item.nama || "-"} (${item.kelas || "-"})`;


            select.appendChild(
                option
            );
        }
    );
}


/* ================= DASHBOARD ================= */

function renderDashboard() {

    const totalAnggota =
        data.anggota?.length || 0;


    let totalMasuk = 0;
    let totalKeluar = 0;


    (data.kas || []).forEach(
        (item) => {

            const jenis =
                normalizeKasJenis(
                    item.jenis
                );

            const nominal =
                Number(item.nominal) || 0;


            if (jenis === "Masuk") {
                totalMasuk += nominal;
            }


            if (jenis === "Keluar") {
                totalKeluar += nominal;
            }
        }
    );


    const saldo =
        totalMasuk - totalKeluar;


    if ($("statAnggota")) {
        $("statAnggota").textContent =
            totalAnggota;
    }

    if ($("statMasuk")) {
        $("statMasuk").textContent =
            formatRupiah(totalMasuk);
    }

    if ($("statKeluar")) {
        $("statKeluar").textContent =
            formatRupiah(totalKeluar);
    }

    if ($("statSaldo")) {
        $("statSaldo").textContent =
            formatRupiah(saldo);
    }


    renderDashboardAbsensi();
    renderDashboardKas();
}


function renderDashboardAbsensi() {

    const table =
        $("dashboardAbsensi");

    if (!table) return;


    table.innerHTML = "";


    const items =
        [...(data.absensi || [])]
            .reverse()
            .slice(0, 5);


    if (items.length === 0) {

        table.innerHTML =
            `<tr>
                <td colspan="3" class="empty">
                    Belum ada data absensi.
                </td>
            </tr>`;

        return;
    }


    items.forEach(
        (item) => {

            let badgeClass =
                "hadir";


            if (
                item.status === "Izin" ||
                item.status === "Sakit"
            ) {
                badgeClass = "izin";
            }


            if (
                item.status === "Alpa"
            ) {
                badgeClass = "alpa";
            }


            const row =
                document.createElement("tr");


            row.innerHTML = `
                <td>
                    ${escapeHTML(
                        item.tanggal || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.nama || "-"
                    )}
                </td>

                <td>
                    <span class="badge ${badgeClass}">
                        ${escapeHTML(
                            item.status || "-"
                        )}
                    </span>
                </td>
            `;


            table.appendChild(row);
        }
    );
}


function renderDashboardKas() {

    const table =
        $("dashboardKas");

    if (!table) return;


    table.innerHTML = "";


    const items =
        [...(data.kas || [])]
            .reverse()
            .slice(0, 5);


    if (items.length === 0) {

        table.innerHTML =
            `<tr>
                <td colspan="3" class="empty">
                    Belum ada transaksi kas.
                </td>
            </tr>`;

        return;
    }


    items.forEach(
        (item) => {

            const nominal =
                Number(item.nominal) || 0;


            const row =
                document.createElement("tr");


            row.innerHTML = `
                <td>
                    ${escapeHTML(
                        item.tanggal || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.keterangan || "-"
                    )}
                </td>

                <td>
                    ${formatRupiah(nominal)}
                </td>
            `;


            table.appendChild(row);
        }
    );
}


/* ================= ADD KAS ================= */

async function handleAddKas(event) {

    event.preventDefault();


    if (!isPengurus()) {

        showToast(
            "Hanya pengurus yang dapat menambah kas."
        );

        return;
    }


    const jenisValue =
        $("kasJenis")?.value;


    const keterangan =
        $("kasKeterangan")?.value.trim();


    const nominal =
        $("kasNominal")?.value;


    if (
        !jenisValue ||
        !keterangan ||
        !nominal
    ) {

        showToast(
            "Semua data transaksi wajib diisi."
        );

        return;
    }


    // HTML memakai Pemasukan/Pengeluaran,
    // backend memakai Masuk/Keluar.
    const jenis =
        normalizeKasJenis(
            jenisValue
        );


    try {

        await callAPI(
            "addKas",
            {
                jenis: jenis,
                keterangan: keterangan,
                nominal: nominal,
                username:
                    currentUser.username
            }
        );


        closeModal(
            "kasModal"
        );


        event.target.reset();


        await loadAllData();


        showToast(
            "Transaksi kas berhasil disimpan."
        );


    } catch (error) {

        showToast(
            "Gagal menyimpan kas: " +
            error.message
        );
    }
}


/* ================= DELETE KAS ================= */

async function deleteKas(id) {

    if (!isPengurus()) {
        showToast(
            "Anda tidak memiliki akses."
        );
        return;
    }


    if (
        !confirm(
            "Apakah Anda yakin ingin menghapus transaksi ini?"
        )
    ) {
        return;
    }


    try {

        await callAPI(
            "deleteKas",
            {
                id: id,
                username:
                    currentUser.username
            }
        );


        await loadAllData();


        showToast(
            "Transaksi berhasil dihapus."
        );


    } catch (error) {

        showToast(
            "Gagal menghapus transaksi: " +
            error.message
        );
    }
}


/* ================= ADD ABSENSI ================= */

async function handleAddAbsensi(event) {

    event.preventDefault();


    if (!isPengurus()) {

        showToast(
            "Hanya pengurus yang dapat menginput absensi."
        );

        return;
    }


    const tanggal =
        $("absensiTanggal")?.value;


    const nama =
        $("absensiNama")?.value;


    const status =
        $("absensiStatus")?.value;


    const keterangan =
        $("absensiKeterangan")?.value.trim();


    if (!tanggal || !nama || !status) {

        showToast(
            "Tanggal, nama, dan status wajib diisi."
        );

        return;
    }


    try {

        await callAPI(
            "addAbsensi",
            {
                tanggal: tanggal,
                nama: nama,
                status: status,
                keterangan:
                    keterangan || "-",
                username:
                    currentUser.username
            }
        );


        closeModal(
            "absensiModal"
        );


        event.target.reset();


        await loadAllData();


        showToast(
            "Absensi berhasil dicatat."
        );


    } catch (error) {

        showToast(
            "Gagal menyimpan absensi: " +
            error.message
        );
    }
}


/* ================= DELETE ABSENSI ================= */

async function deleteAbsensi(id) {

    if (!isPengurus()) {

        showToast(
            "Anda tidak memiliki akses."
        );

        return;
    }


    if (
        !confirm(
            "Apakah Anda yakin ingin menghapus absensi ini?"
        )
    ) {
        return;
    }


    try {

        await callAPI(
            "deleteAbsensi",
            {
                id: id,
                username:
                    currentUser.username
            }
        );


        await loadAllData();


        showToast(
            "Absensi berhasil dihapus."
        );


    } catch (error) {

        showToast(
            "Gagal menghapus absensi: " +
            error.message
        );
    }
}


/* ================= RENDER SEMUA ================= */

function renderAll() {

    renderDashboard();

    renderAnggota();

    renderKas();

    renderAbsensi();

    populateAbsensiNames();

    setupUserRoleUI();
}


/* ================= GLOBAL FUNCTIONS =================
   Fungsi ini sengaja ditempel ke window supaya
   onclick="deleteKas(...)" dan onclick="deleteAbsensi(...)"
   tetap bisa bekerja dari HTML hasil render.
   ===================================================== */

window.deleteKas = deleteKas;
window.deleteAbsensi = deleteAbsensi;
window.showPage = showPage;
window.openModal = openModal;
window.closeModal = closeModal;
window.syncData = syncData;
