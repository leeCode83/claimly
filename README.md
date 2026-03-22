# Claimly: Privacy-Preserving Health Insurance Claim Verification System

Claimly adalah sebuah platform web fullstack yang memfasilitasi proses pengajuan dan verifikasi klaim asuransi kesehatan dengan mengutamakan privasi. Sistem ini menjembatani interaksi antara **Rumah Sakit**, **Pasien**, dan **Perusahaan Asuransi**. 

Tujuan utama Claimly adalah menggunakan teknologi kriptografi mutakhir untuk memverifikasi keabsahan sebuah klaim asuransi tanpa perlu menyerahkan data rekam medis sensitif kepada pihak asuransi.

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

---

## 4. Tech Stack yang Digunakan

* **Frontend:** Next.js 14 (App Router) difokuskan pada fungsionalitas dan pemisahan rendering (*Server Components* & *Client Components*).
* **Backend:** Next.js API Routes / Route Handlers.
* **Database & BaaS:** Supabase — PostgreSQL, Supabase Auth (Manajemen sesi), Supabase Storage, Row-Level Security (RLS) untuk perlindungan data, RPC, dan Triggers.
* **Zero-Knowledge Proof (ZKP):** Circom untuk merancang sirkuit ZK, snarkjs untuk generation & verification secara *runtime*, serta circomlib (Poseidon hash & MerkleProof).
* **State Management:** Zustand (untuk mengelola state UI dan *session* di frontend).
* **Testing:** Vitest (untuk service layer API dan logic ZKP) & Supertest.

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
