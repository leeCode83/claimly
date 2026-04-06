# Claimly: Privacy-Preserving Health Insurance Claim Verification System

Claimly adalah sebuah platform web fullstack yang memfasilitasi proses pengajuan dan verifikasi klaim asuransi kesehatan dengan mengutamakan privasi. Sistem ini menjembatani interaksi antara **Rumah Sakit**, **Pasien**, dan **Perusahaan Asuransi**. 

Tujuan utama Claimly adalah menggunakan teknologi kriptografi mutakhir untuk memverifikasi keabsahan sebuah klaim asuransi tanpa perlu menyerahkan data rekam medis sensitif kepada pihak asuransi.

---

## 🏗️ Arsitektur Sistem & Alur Pengguna

Sistem Claimly terdiri dari modul Next.js utama untuk manajemen dan verifikasi, serta modul Chatbot RAG terpisah untuk asisten medis pintar.

```mermaid
---
config:
  theme: base
  themeVariables:
    primaryColor: '#e3f2fd'
    primaryTextColor: '#000'
    primaryBorderColor: '#1976d2'
    lineColor: '#424242'
    secondaryColor: '#f3e5f5'
    tertiaryColor: '#e8f5e9'
    noteBkgColor: '#fff3e0'
    noteTextColor: '#000'
  layout: dagre
---
flowchart TB
 subgraph Client["🖥️ Client Layer"]
    direction LR
        User["👤 User/Patient/<br>Hospital Staff"]
        Browser["📱 Next.js<br>Web App"]
        ZKPClient["🔐 ZKP Circuit/<br>snarkjs"]
  end
 subgraph Chatbot["🤖 Chatbot"]
    direction TB
        FastAPI["⚡ FastAPI<br>Service"]
        Worker["🔄 ARQ<br>Worker"]
        Gemini["✨ Gemini<br>Pro"]
  end
 subgraph MainApp["⚙️ Main"]
    direction TB
        NextJS["🔷 Next.js<br>Router"]
        ZKPVerify["✅ ZKP<br>Verifier"]
        Identity["🔑 Identity &amp;<br>Key Svc"]
  end
 subgraph Applications["Application Layers"]
    direction LR
        Chatbot
        MainApp
  end
 subgraph Infra["💾 Infrastructure & Data"]
    direction LR
        SupabaseAuth["🔐 Supabase<br>Auth"]
        Redis["⚡ Redis<br>Queue"]
        SupabasePostgres["🗄️ PostgreSQL"]
        SupabaseVector["📊 Vector<br>Store"]
  end
    User -- 1️⃣ Login --> Browser
    Browser -- 8️⃣ WebSocket --> FastAPI
    Browser <-- 3️⃣ CRUD --> NextJS
    Browser -- 5️⃣ Generate --> ZKPClient
    ZKPClient -- 6️⃣ Submit --> NextJS
    Browser <-- 2️⃣ Auth --> SupabaseAuth
    NextJS <-- 4️⃣ Data --> SupabasePostgres
    NextJS -- 7️⃣ Verify --> ZKPVerify
    ZKPVerify -. Key .-> Identity
    FastAPI -- 9️⃣ Enqueue --> Redis
    Redis -- 🔟 Job --> Worker
    Worker -- 1️⃣1️⃣ Fetch --> Identity
    Worker -- 1️⃣2️⃣ Search --> SupabaseVector
    Worker <-- 1️⃣3️⃣ LLM --> Gemini
    Worker -- 1️⃣4️⃣ Pub --> Redis
    Redis -- 1️⃣5️⃣ Sub --> FastAPI
    FastAPI -- 1️⃣6️⃣ Render --> Browser

     User:::clientStyle
     Browser:::clientStyle
     ZKPClient:::clientStyle
     FastAPI:::chatbotStyle
     Worker:::chatbotStyle
     Gemini:::chatbotStyle
     NextJS:::mainAppStyle
     ZKPVerify:::mainAppStyle
     Identity:::mainAppStyle
     SupabaseAuth:::infraStyle
     Redis:::infraStyle
     SupabasePostgres:::infraStyle
     SupabaseVector:::infraStyle
    classDef clientStyle fill:#e3f2fd,stroke:#1976d2,stroke-width:2px,color:#000
    classDef mainAppStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#000
    classDef chatbotStyle fill:#fff3e0,stroke:#f57c00,stroke-width:2px,color:#000
    classDef infraStyle fill:#e8f5e9,stroke:#388e3c,stroke-width:2px,color:#000
```

---

## 1. Deskripsi Projek

Claimly menggunakan **Zero-Knowledge Proof (ZKP)** (diimplementasikan dengan Circom dan snarkjs) secara off-chain untuk membuktikan bahwa sebuah proses medis yang dijalani pasien memenuhi syarat polis asuransinya. 

Alur utama dalam sistem ini adalah:
1. Pihak Rumah Sakit memasukkan data klaim dan diagnosis medis.
2. Sistem *backend* menghasilkan ZK Proof.
3. Proof dan data non-sensitif (signals) dikirimkan ke asuransi.
4. Pihak Asuransi memverifikasi proof tersebut dan memutuskan untuk menyetujui (approve) atau menolak (reject) klaim.

Proses ini memastikan bahwa asuransi tidak akan pernah melihat detail diagnosis pasien, tanggal diagnosis, maupun detail rahasia lainnya.

---

## 🤖 Claimly RAG Chatbot Service

Untuk meningkatkan pengalaman pengguna, kami menyediakan layanan chatbot medis asinkron yang mampu memberikan wawasan dari rekam medis terenkripsi tanpa mengorbankan privasi.

*   **Repository**: [claimly-rag-chatbot](https://github.com/leeCode83/claimly-rag-chatbot)
*   **Keunggulan**: Memproses data rekam medis secara "Zero-Persistence" (hanya ada di memori saat diproses).
*   **Keamanan**: Dekripsi on-the-fly di RAM menggunakan ECIES dan AES-GCM.

### Cara Menjalankan Chatbot (Quick Start):
1.  Buka terminal di folder `claimly-rag-chatbot`.
2.  Jalankan 4 background workers:
    ```powershell
    .\run_workers.ps1
    ```
3.  Jalankan FastAPI API:
    ```powershell
    .\run_api.ps1
    ```
    *Layanan akan tersedia di port 8000 via WebSocket.*

---

## 2. Problem Statement yang Mau Diselesaikan

Saat ini, proses klaim asuransi kesehatan di Indonesia mengharuskan pihak rumah sakit mengirimkan rekam medis pasien secara menyeluruh—termasuk kode diagnosis, riwayat kondisi, dan detail medis lainnya—kepada pihak perusahaan asuransi. Praktik ini menciptakan dua masalah fundamental:

1. **Privasi pasien terancam:** Data medis sensitif yang dikirim ke asuransi dapat disalahgunakan, misalnya untuk menaikkan premi di perpanjangan polis berikutnya, digunakan untuk menolak klaim penyakit terkait di masa depan, atau bahkan terancam bocor akibat celah keamanan data. Padahal, pihak asuransi sebenarnya hanya perlu mengetahui *apakah prosedur medis tersebut merupakan hak pasien dan sesuai dengan polis yang berlaku*.
2. **Tidak ada sistem verifikasi "buta" (*blind verification*):** Belum ada mekanisme di mana asuransi bisa 100% yakin akan keabsahan klaim tanpa harus membedah seluruh data historis pasien secara langsung.

---

## 3. Fitur Utama Projek

* **Manajemen Pengguna & Akses (RBAC):** Pemisahan hak akses ketat antara `hospital_staff`, `insurance_reviewer`, dan `patient`. Data medis terenkripsi dan hanya dapat dikelola oleh pihak rumah sakit.
* **Manajemen Polis Asuransi:** Fitur bagi reviewer asuransi untuk mengatur template polis, mencakup daftar diagnosis dan prosedur yang ditanggung (diubah menjadi *Merkle Tree* di balik layar).
* **Pendaftaran Pasien & Polis:** Pendaftaran pasien oleh rumah sakit yang kemudian dihubungkan ke polis asuransi valid untuk men-generate `policyCommitment` identifier.
* **Input Data Medis Terselubung:** Staf rumah sakit dapat memasukkan diagnosis kode ICD-10 dan laporan medis yang disimpan terenkripsi sempurna (*encrypted database*).
* **Pengajuan Klaim dengan ZKP:** Otomatisasi pembuatan ZK Proof di sisi server tanpa pernah menyimpan data medis dalam format yang bisa diakses asuransi setelah proof digenerate.
* **Dashboard Klaim untuk Asuransi:** Mengelola tumpukan klaim masuk dengan data publik (prosedur, nominal) dan memverifikasi kriptografi integritas klaim.
* **Notifikasi Status Klaim (Pasien):** Portal sederhana bagi pasien untuk memantau status persetujuan klaim mereka.
* **Audit Trail/Logs Log:** Semua aktivitas kritis (submit klaim, proof generation, approval) tercatat permanen dan tidak dapat dihapus.
* **AI Medical Assistant (RAG Chatbot):** Tanya jawab seputar rekam medis dengan konteks medis akurat menggunakan Google Gemini Pro.

---

## 4. Tech Stack yang Digunakan

### Core Web & Management
* **Frontend/Backend:** Next.js 14 (App Router).
* **Identity & Management:** Next.js Server Actions & Identity API.
* **BaaS:** Supabase (Auth, PostgreSQL, Storage).
* **Zero-Knowledge Proof (ZKP):** Circom & snarkjs (Poseidon Hash, Merkle Proof).

### AI & Chatbot Service
* **API Service:** FastAPI (Python) dengan Winloop (IOCP) untuk optimasi Windows.
* **Background Worker:** ARQ (Redis based job queue).
* **LLM Engine:** Google Gemini Pro API.
* **Vector Store:** Supabase Vector (pgvector).
* **Message Broker:** Redis (Queue & Pub/Sub for real-time streaming).

---

## 5. Peran ZKP dalam Projek Ini

Peran **Zero-Knowledge Proof (ZKP)** di dalam Claimly adalah menjadi alat pembuktian **"Saya memenuhi syarat, tetapi saya tidak perlu memberi tahu Anda detail milik saya"**.

ZKP memutus dilema privasi. Pihak rumah sakit dapat mengkalkulasi sebuah rumusan matematika (Proof) yang secara mutlak membuktikan bahwa tindakan medis yang dilaporkan **tepat** dan **disetujui** sesuai dokumen polis, tanpa asuransi perlu melihat apa penyakit aktual atau diagnosis yang diderita sang pasien. ZKP memastikan tidak ada kompromi pada kebenaran medis dan di saat bersamaan melindungi rekam jejak kesehatan rahasia.

---

## 6. Penjelasan Simple Cara Kerja ZKP

Di dalam sistem Claimly, komponen yang disebut sebagai "Circuit" ZKP akan mengecek 4 syarat utama dengan memasukkan *Private Input* (Diagnosis, Tanggal sakit, dll) dan *Public Input* (Tindakan/Prosedur Medis, Biaya klaim, dll):

1. **Proof Diagnosis:** Sirkuit mengecek apakah penyakit yang diderita pasien benar-benar masuk dalam daftar penyakit yang ditanggung polis asuransinya. Ini menggunakan struktur pohon kriptografi (*Merkle Tree*). Jika diagnosis pasien ada namun dirahasiakan, sirkuit menyatakan "Valid".
2. **Validitas Prosedur Medis:** Sistem mencocokkan apakah tindakan medis (yang biayanya diklaim) memang cocok dan logis dilakukan untuk penyakit (rahasia) yang sedang diidap.
3. **Mencegah Fraud Waktu:** Sistem mengecek secara kronologis bahwa tindakan medis dilakukan *setelah* pasien didiagnosis sakit, serta masih dalam *periode kontrak aktif* dari polis asuransinya.
4. **Validasi Limit Biaya:** Memastikan bahwa nominal uang yang ditagihkan tidak melampaui limit maksimum rawat/asuransi pasien.

Jika semua 4 syarat *lulus*, algoritma menghasilkan sebuah file matematika rumit (**ZK Proof**). Asuransi menerima file proof ini beserta berkas jumlah tagihan. Asuransi melakukan proses "Verifikasi" atas Proof tersebut yang mutlak hanya bisa merespons **BENAR** atau **SALAH**. Segala jenis kecurangan/manipulasi data di tengah jalan otomatis membuat hasil verifikasi menjadi salah.

---

## 7. Manfaat Penerapan ZKP bagi Stakeholder

Penerapan ZKP dalam Claimly memberikan keuntungan bagi seluruh pihak yang terlibat:

*   **Bagi Pasien:** Data diagnosis medis tetap bersifat rahasia. Pasien tidak perlu khawatir riwayat penyakitnya digunakan oleh pihak asuransi untuk menaikkan premi atau diskriminasi klaim di masa depan.
*   **Bagi Rumah Sakit:** Mengurangi beban tanggung jawab dan risiko hukum terkait kebocoran data medis sensitif (karena data tidak dikirim ke pihak luar). Proses verifikasi cakupan polis juga menjadi lebih otomatis dan akurat.
*   **Bagi Perusahaan Asuransi:** Mendapatkan kepastian matematis bahwa sebuah klaim adalah valid dan sesuai ketentuan polis tanpa perlu memproses data pribadi yang sangat sensitif. Hal ini juga mempermudah kepatuhan terhadap regulasi perlindungan data (seperti UU PDP).

---

## 8. Perbandingan Klaim: Tradisional vs ZKP

| Kategori Data | Tanpa ZKP (Tradisional) | Dengan ZKP (Claimly) |
| :--- | :--- | :--- |
| **Identitas Pasien** | Dapat dilihat (Nama, NIK) | Tersembunyi (Anonim via `Commitment`) |
| **Diagnosis (ICD-10)** | Dapat dilihat & disimpan asuransi | Tersembunyi (Hanya dicek di Circuit) |
| **Tanggal Sakit** | Dapat dilihat | Tersembunyi (Hanya cek Masa Aktif) |
| **Penyakit Penyerta** | Terbuka di rekam medis | Terproteksi (Hanya data klaim yang di-proof) |
| **Status Verifikasi** | Manual (Human Reviewer) | Otomatis (Matematis/Kriptografis) |
| **Keamanan Data** | Berisiko tinggi bocor/disalahgunakan | Privasi terjamin secara infrastruktur |

---

## 9. Detail Database & Keamanan (Supabase)

Bagian ini merinci struktur database yang digunakan untuk mendukung sistem klaim berbasis privasi.

### 📂 Daftar Tabel
Terdapat total **13 tabel** utama di dalam schema `public`:
`audit_logs`, `claims`, `diagnoses`, `institutions`, `insurance_policies`, `medical_records`, `patient_policies`, `patients`, `policy_covered_diagnoses`, `policy_covered_procedures`, `procedures`, `users`, `zkp_proofs`.

### ⚡ Remote Procedure Calls (RPC) / PostgreSQL Functions
Berikut adalah fungsi-fungsi khusus yang dapat dipanggil dari client untuk menjalankan logika database yang kompleks:

| Nama Fungsi | Argumen | Deskripsi / Fungsi |
| :--- | :--- | :--- |
| `approve_claim` | `p_claim_id`, `p_reviewer_id`, `p_review_notes` | Menyetujui klaim yang masuk dan mencatat reviewer serta catatannya. |
| `reject_claim` | `p_claim_id`, `p_reviewer_id`, `p_review_notes` | Menolak klaim yang masuk dengan alasan tertentu. |
| `get_claims_paginated` | `p_page`, `p_limit`, `p_sort_by`, `p_sort_dir`, `p_status`, `p_search` | Mengambil data klaim dengan filter, sorting, dan pagination yang efisien. |
| `get_my_crypto_data` | - | Mengambil data keypair terenkripsi milik user yang sedang login (untuk proses dekripsi di browser). |
| `get_patient_public_key` | `p_patient_id` | Mengambil public key pasien (hanya bisa diakses oleh RS yang menangani pasien tersebut). |
| `save_user_keypair` | `p_public_key`, `p_encrypted_priv_key`, `p_salt`, `p_iv` | Menyimpan pasangan kunci kriptografi baru saat user pertama kali aktivasi. |
| `update_user_keypair` | `p_encrypted_priv_key`, `p_salt`, `p_iv` | Memperbarui kunci privat terenkripsi saat user mengganti password. |
| `create_policy_with_relations`| `ins_id`, `name`, `amount`, `valid_from`, `valid_until`, `diag_root`, `proc_root`, `active`, `diagnoses`, `procedures` | Fungsi transaksional untuk membuat polis asuransi beserta daftar panjang diagnosa/prosedur sekaligus. |
| `get_user_role` | - | Mengambil string role user (`patient`, `hospital_staff`, dll) dari session aktif. |
| `get_user_institution_id` | - | Mengambil UUID institusi tempat user bekerja/terdaftar. |

### 🔒 Kebijakan Row Level Security (RLS)
RLS memastikan bahwa data hanya dapat diakses oleh pihak yang berwenang berdasarkan role dan hubungan institusional.

| Tabel | Kebijakan (Policies) | Penjelasan Detail |
| :--- | :--- | :--- |
| **`claims`** | `claims_read`, `claims_insert`, `claims_update` | Staf RS hanya bisa akses klaim institusinya; Reviewer asuransi hanya melihat klaim `submitted/approved/rejected`; Pasien hanya melihat klaim miliknya. |
| **`medical_records`** | `medical_records_read`, `medical_records_insert`, `medical_records_update` | Akses terbatas hanya untuk Staf RS asal rekam medis, Pasien pemilik data, dan Admin. Reviewer asuransi **TIDAK** punya akses baca ke tabel ini. |
| **`patients`** | `patients_read`, `patients_insert`, `patients_update` | Data pasien hanya bisa dilihat oleh RS yang mendaftarkan atau menangani pasien tersebut, serta pasien itu sendiri. |
| **`users`** | `users_read_all`, `users_update_own` | Semua user bisa melihat data publik user lain (seperti `public_key`), tapi hanya bisa mengubah data profil miliknya sendiri. |
| **`insurance_policies`**| `read`, `insert`, `update`, `delete` | Bisa dibaca oleh siapa saja (publik katalog), namun hanya Reviewer Asuransi & Admin yang bisa menambah/mengubah data. |
| **`patient_policies`** | `read`, `write` | Pasien bisa melihat polisnya; RS bisa mendaftarkan polis pasien; Admin & Reviewer bisa melihat semua distribusi polis. |
| **`zkp_proofs`** | `read`, `insert`, `update` | Hanya pihak teknis RS dan Reviewer yang bisa berinteraksi dengan bukti kriptografi klaim. |
| **`audit_logs`** | `audit_logs_read` | Log hanya bisa dilihat oleh Admin, pemilik log, atau staff dari institusi yang sama dengan pelaku aksi. |
| **`diagnoses`/`procedures`**| `read`, `write` | Terbuka untuk dibaca oleh semua (referensi standar), namun hanya Admin yang bisa mengubah data masternya. |
