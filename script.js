/* =====================================================
   STEPA MANAGEMENT
   LOGIN + ROLE + KAS + ABSENSI + GOOGLE SHEETS
   ===================================================== */


/* ================= KONFIGURASI ================= */

// GANTI dengan URL Google Apps Script Web App kamu
const API_URL = "https://script.google.com/macros/s/AKfycbxjzopqTCYnCiUigFcmb-GL4m-gPVk_yEO-lWIEgyqacdz0JvEsCd8GP_NhYm0Ry670_w/exec";


/* ================= DATA APLIKASI ================= */

let currentUser = null;

let data = {
    anggota: [],
    kas: [],
    absensi: []
};


/* ================= ELEMENT ================= */

const loginPage = document.getElementById("loginPage");
const appPage = document.getElementById("appPage");

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

const showPassword = document.getElementById("showPassword");

const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");

const toast = document.getElementById("toast");


/* ================= FORMAT RUPIAH ================= */

function rupiah(number) {

    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(Number(number) || 0);

}


/* ================= TOAST ================= */

function showToast(message) {

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);

}


/* ================= API GOOGLE SHEETS ================= */

function callAPI(action, params = {}) {

    return new Promise((resolve, reject) => {

        if (
            !API_URL ||
            API_URL.includes("https://script.google.com/macros/s/AKfycbzdzBIFTdeBC0Z437JFjY0vGSXp1V749IF11vzLlWjw5Y4d4Bd5-580law8aTCrVnN0/exec")
        ) {

            reject(
                new Error(
                    "https://script.google.com/macros/s/AKfycbzdzBIFTdeBC0Z437JFjY0vGSXp1V749IF11vzLlWjw5Y4d4Bd5-580law8aTCrVnN0/exec"
                )
            );

            return;
        }


        const callbackName =
            "stepaCallback_" +
            Date.now() +
            Math.floor(Math.random() * 1000);


        const script =
            document.createElement("script");


        const query = new URLSearchParams({

            action: action,

            callback: callbackName,

            ...params

        });


        window[callbackName] = function(response) {

            delete window[callbackName];

            script.remove();

            if (response.success) {

                resolve(response.data);

            } else {

                reject(
                    new Error(
                        response.message ||
                        "Terjadi kesalahan."
                    )
                );

            }

        };


        script.onerror = function() {

            delete window[callbackName];

            script.remove();

            reject(
                new Error(
                    "Tidak dapat terhubung ke Google Sheets."
                )
            );

        };


        script.src =
            API_URL +
            "?" +
            query.toString();


        document.body.appendChild(script);

    });

}


/* ================= LOGIN ================= */

loginForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        const username =
            usernameInput.value.trim();

        const password =
            passwordInput.value;


        loginMessage.textContent =
            "Memeriksa akun...";


        try {

            const user = await callAPI(
                "login",
                {
                    username: username,
                    password: password
                }
            );


            currentUser = user;

            localStorage.setItem(
                "stepaUser",
                JSON.stringify(user)
            );


            loginPage.classList.add("hidden");
            appPage.classList.remove("hidden");


            setupUser();

            await loadAllData();

            showToast(
                "Selamat datang, " +
                user.nama
            );


        } catch (error) {

            loginMessage.textContent =
                error.message;

        }

    }
);


/* ================= SHOW PASSWORD ================= */

showPassword.addEventListener(
    "click",
    function() {

        if (
            passwordInput.type ===
            "password"
        ) {

            passwordInput.type =
                "text";

            showPassword.textContent =
                "🙈";

        } else {

            passwordInput.type =
                "password";

            showPassword.textContent =
                "👁";

        }

    }
);


/* ================= USER ================= */

function setupUser() {

    if (!currentUser) return;


    document.getElementById(
        "userName"
    ).textContent =
        currentUser.nama;


    document.getElementById(
        "userRole"
    ).textContent =
        currentUser.role;


    document.getElementById(
        "userAvatar"
    ).textContent =
        currentUser.nama
            .charAt(0)
            .toUpperCase();


    const pengurus =
        currentUser.role
            .toLowerCase() ===
        "pengurus";


    document
        .querySelectorAll(
            ".pengurus-only"
        )
        .forEach(element => {

            element.style.display =
                pengurus
                    ? ""
                    : "none";

        });

}


/* ================= LOGOUT ================= */

logoutBtn.addEventListener(
    "click",
    function() {

        localStorage.removeItem(
            "stepaUser"
        );

        currentUser = null;

        appPage.classList.add(
            "hidden"
        );

        loginPage.classList.remove(
            "hidden"
        );

        loginForm.reset();

    }
);


/* ================= NAVIGASI ================= */

document
    .querySelectorAll(".nav-item")
    .forEach(button => {

        button.addEventListener(
            "click",
            function() {

                openPage(
                    button.dataset.page
                );

            }
        );

    });


document
    .querySelectorAll(
        "[data-page-btn]"
    )
    .forEach(button => {

        button.addEventListener(
            "click",
            function() {

                openPage(
                    button.dataset.pageBtn
                );

            }
        );

    });


function openPage(page) {

    document
        .querySelectorAll(".page")
        .forEach(section => {

            section.classList.remove(
                "active-page"
            );

        });


    const target =
        document.getElementById(
            page + "Page"
        );


    if (target) {

        target.classList.add(
            "active-page"
        );

    }


    document
        .querySelectorAll(".nav-item")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.page ===
                page
            );

        });


    const titles = {

        dashboard: [
            "Dashboard",
            "Ringkasan kegiatan STEPA"
        ],

        kas: [
            "Kas STEPA",
            "Pemasukan dan pengeluaran"
        ],

        absensi: [
            "Absensi",
            "Absensi calon anggota STEPA"
        ],

        anggota: [
            "Calon Anggota",
            "Data calon anggota STEPA"
        ]

    };


    if (titles[page]) {

        document.getElementById(
            "pageTitle"
        ).textContent =
            titles[page][0];


        document.getElementById(
            "pageSubtitle"
        ).textContent =
            titles[page][1];

    }

}


/* ================= LOAD DATA ================= */

async function loadAllData() {

    try {

        const result =
            await callAPI("allData");


        data.anggota =
            result.anggota || [];

        data.kas =
            result.kas || [];

        data.absensi =
            result.absensi || [];


        renderAll();


    } catch (error) {

        showToast(
            error.message
        );

    }

}


/* ================= RENDER ================= */

function renderAll() {

    renderDashboard();

    renderKas();

    renderAbsensi();

    renderAnggota();

    updateStats();

    populateAbsensiNames();

}


/* ================= STATS ================= */

function updateStats() {

    const masuk =
        data.kas
            .filter(
                item =>
                    item.jenis ===
                    "Pemasukan"
            )
            .reduce(
                (total, item) =>
                    total +
                    Number(item.nominal),
                0
            );


    const keluar =
        data.kas
            .filter(
                item =>
                    item.jenis ===
                    "Pengeluaran"
            )
            .reduce(
                (total, item) =>
                    total +
                    Number(item.nominal),
                0
            );


    const saldo =
        masuk - keluar;


    document.getElementById(
        "statAnggota"
    ).textContent =
        data.anggota.length;


    document.getElementById(
        "statMasuk"
    ).textContent =
        rupiah(masuk);


    document.getElementById(
        "statKeluar"
    ).textContent =
        rupiah(keluar);


    document.getElementById(
        "statSaldo"
    ).textContent =
        rupiah(saldo);


    document.getElementById(
        "kasMasuk"
    ).textContent =
        rupiah(masuk);


    document.getElementById(
        "kasKeluar"
    ).textContent =
        rupiah(keluar);


    document.getElementById(
        "kasSaldo"
    ).textContent =
        rupiah(saldo);

}


/* ================= RENDER KAS ================= */

function renderKas() {

    const table =
        document.getElementById(
            "kasTable"
        );


    table.innerHTML = "";


    if (!data.kas.length) {

        table.innerHTML = `
            <tr>
                <td colspan="5" class="empty">
                    Belum ada transaksi.
                </td>
            </tr>
        `;

        return;

    }


    data.kas.forEach(item => {

        const tr =
            document.createElement("tr");


        const className =
            item.jenis ===
            "Pemasukan"
                ? "income"
                : "expense";


        tr.innerHTML = `

            <td>${item.tanggal}</td>

            <td>
                <span class="badge ${
                    item.jenis ===
                    "Pemasukan"
                        ? "hadir"
                        : "alpa"
                }">
                    ${item.jenis}
                </span>
            </td>

            <td>${item.keterangan}</td>

            <td class="${className}">
                ${
                    item.jenis ===
                    "Pemasukan"
                        ? "+"
                        : "-"
                }
                ${rupiah(item.nominal)}
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


    setupUser();

}


/* ================= RENDER ABSENSI ================= */

function renderAbsensi() {

    const table =
        document.getElementById(
            "absensiTable"
        );


    table.innerHTML = "";


    if (!data.absensi.length) {

        table.innerHTML = `
            <tr>
                <td colspan="5" class="empty">
                    Belum ada data absensi.
                </td>
            </tr>
        `;

        return;

    }


    data.absensi.forEach(item => {

        const tr =
            document.createElement("tr");


        const statusClass =
            item.status
                .toLowerCase();


        tr.innerHTML = `

            <td>${item.tanggal}</td>

            <td>${item.nama}</td>

            <td>
                <span class="badge ${statusClass}">
                    ${item.status}
                </span>
            </td>

            <td>
                ${item.keterangan || "-"}
            </td>

            <td class="pengurus-only">

                <button
                    class="delete-btn"
                    onclick="deleteAbsensi('${item.id}')"
                >
                    Hapus
                </button>

            </td>

        `;


        table.appendChild(tr);

    });


    setupUser();

}


/* ================= RENDER ANGGOTA ================= */

function renderAnggota() {

    const table =
        document.getElementById(
            "anggotaTable"
        );


    table.innerHTML = "";


    if (!data.anggota.length) {

        table.innerHTML = `
            <tr>
                <td colspan="5" class="empty">
                    Belum ada calon anggota.
                </td>
            </tr>
        `;

        return;

    }


    data.anggota.forEach(
        (item, index) => {

            const tr =
                document.createElement(
                    "tr"
                );


            tr.innerHTML = `

                <td>${index + 1}</td>

                <td>${item.nama}</td>

                <td>${item.kelas || "-"}</td>

                <td>${item.hp || "-"}</td>

                <td>
                    <span class="badge hadir">
                        ${item.status || "Aktif"}
                    </span>
                </td>

            `;


            table.appendChild(tr);

        }
    );

}


/* ================= DASHBOARD ABSENSI ================= */

function renderDashboard() {

    const absensiTable =
        document.getElementById(
            "dashboardAbsensi"
        );


    absensiTable.innerHTML = "";


    data.absensi
        .slice(-5)
        .reverse()
        .forEach(item => {

            const tr =
                document.createElement(
                    "tr"
                );


            tr.innerHTML = `

                <td>${item.tanggal}</td>

                <td>${item.nama}</td>

                <td>
                    <span class="badge ${
                        item.status.toLowerCase()
                    }">
                        ${item.status}
                    </span>
                </td>

            `;


            absensiTable.appendChild(tr);

        });


    if (
        !data.absensi.length
    ) {

        absensiTable.innerHTML = `
            <tr>
                <td colspan="3"
                    class="empty">
                    Belum ada absensi.
                </td>
            </tr>
        `;

    }


    const kasTable =
        document.getElementById(
            "dashboardKas"
        );


    kasTable.innerHTML = "";


    data.kas
        .slice(-5)
        .reverse()
        .forEach(item => {

            const tr =
                document.createElement(
                    "tr"
                );


            tr.innerHTML = `

                <td>${item.tanggal}</td>

                <td>${item.keterangan}</td>

                <td class="${
                    item.jenis ===
                    "Pemasukan"
                        ? "income"
                        : "expense"
                }">

                    ${
                        item.jenis ===
                        "Pemasukan"
                            ? "+"
                            : "-"
                    }

                    ${rupiah(item.nominal)}

                </td>

            `;


            kasTable.appendChild(tr);

        });


    if (!data.kas.length) {

        kasTable.innerHTML = `
            <tr>
                <td colspan="3"
                    class="empty">
                    Belum ada transaksi.
                </td>
            </tr>
        `;

    }

}


/* ================= ABSENSI NAMA ================= */

function populateAbsensiNames() {

    const select =
        document.getElementById(
            "absensiNama"
        );


    select.innerHTML =
        `<option value="">
            Pilih calon anggota
        </option>`;


    data.anggota.forEach(item => {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            item.nama;

        option.textContent =
            item.nama;


        select.appendChild(option);

    });

}


/* ================= MODAL ================= */

function openModal(id) {

    document
        .getElementById(id)
        .classList.add("show");

}


function closeModal(id) {

    document
        .getElementById(id)
        .classList.remove("show");

}


document
    .querySelectorAll(
        ".close-modal"
    )
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                closeModal(
                    button.dataset.close
                );

            }
        );

    });


document
    .getElementById("addKasBtn")
    .addEventListener(
        "click",
        () => openModal("kasModal")
    );


document
    .getElementById("addAbsensiBtn")
    .addEventListener(
        "click",
        () => {

            document.getElementById(
                "absensiTanggal"
            ).value =
                new Date()
                    .toISOString()
                    .split("T")[0];

            openModal(
                "absensiModal"
            );

        }
    );


/* ================= TAMBAH KAS ================= */

document
    .getElementById("kasForm")
    .addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            const jenis =
                document.getElementById(
                    "kasJenis"
                ).value;


            const keterangan =
                document.getElementById(
                    "kasKeterangan"
                ).value;


            const nominal =
                document.getElementById(
                    "kasNominal"
                ).value;


            try {

                await callAPI(
                    "addKas",
                    {
                        jenis,
                        keterangan,
                        nominal,
                        username:
                            currentUser.username
                    }
                );


                closeModal(
                    "kasModal"
                );

                this.reset();

                await loadAllData();

                showToast(
                    "Transaksi berhasil ditambahkan."
                );


            } catch (error) {

                showToast(
                    error.message
                );

            }

        }
    );


/* ================= HAPUS KAS ================= */

async function deleteKas(id) {

    if (
        currentUser.role
            .toLowerCase() !==
        "pengurus"
    ) {

        return;

    }


    if (
        !confirm(
            "Hapus transaksi ini?"
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
            "Transaksi dihapus."
        );


    } catch (error) {

        showToast(
            error.message
        );

    }

}


/* ================= TAMBAH ABSENSI ================= */

document
    .getElementById(
        "absensiForm"
    )
    .addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            const tanggal =
                document.getElementById(
                    "absensiTanggal"
                ).value;


            const nama =
                document.getElementById(
                    "absensiNama"
                ).value;


            const status =
                document.getElementById(
                    "absensiStatus"
                ).value;


            const keterangan =
                document.getElementById(
                    "absensiKeterangan"
                ).value;


            try {

                await callAPI(
                    "addAbsensi",
                    {
                        tanggal,
                        nama,
                        status,
                        keterangan,
                        username:
                            currentUser.username
                    }
                );


                closeModal(
                    "absensiModal"
                );

                this.reset();

                await loadAllData();

                showToast(
                    "Absensi berhasil disimpan."
                );


            } catch (error) {

                showToast(
                    error.message
                );

            }

        }
    );


/* ================= HAPUS ABSENSI ================= */

async function deleteAbsensi(id) {

    if (
        currentUser.role
            .toLowerCase() !==
        "pengurus"
    ) {

        return;

    }


    if (
        !confirm(
            "Hapus absensi ini?"
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
            "Absensi dihapus."
        );


    } catch (error) {

        showToast(
            error.message
        );

    }

}


/* ================= SYNC ================= */

document
    .getElementById("syncBtn")
    .addEventListener(
        "click",
        async function() {

            try {

                await loadAllData();

                showToast(
                    "Data berhasil disinkronkan."
                );

            } catch (error) {

                showToast(
                    error.message
                );

            }

        }
    );


refreshBtn.addEventListener(
    "click",
    async function() {

        await loadAllData();

        showToast(
            "Data diperbarui."
        );

    }
);


/* ================= AUTO LOGIN ================= */

window.addEventListener(
    "DOMContentLoaded",
    async function() {

        const savedUser =
            localStorage.getItem(
                "stepaUser"
            );


        if (!savedUser) {

            return;

        }


        try {

            currentUser =
                JSON.parse(
                    savedUser
                );


            loginPage.classList.add(
                "hidden"
            );

            appPage.classList.remove(
                "hidden"
            );


            setupUser();

            await loadAllData();


        } catch {

            localStorage.removeItem(
                "stepaUser"
            );

        }

    }
);
