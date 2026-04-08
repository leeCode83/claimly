# Claimly: Privacy-Preserving Health Management & Insurance Claim Platform

Claimly adalah solusi modern untuk pengelolaan rekam medis dan klaim asuransi kesehatan yang mengutamakan privasi data pasien menggunakan teknologi kriptografi mutakhir (ZKP) dan kecerdasan buatan (AI).

---

## 🏗️ Arsitektur Sistem

Berikut adalah gambaran arsitektur sistem Claimly yang menghubungkan autentikasi, layanan utama, hingga pemrosesan ZK dan AI secara asinkron.

```mermaid
flowchart TB
    subgraph Client["🖥️ Browser / Client"]
        Browser["Next.js Web App<br/>(Tailwind + Web Crypto SDK)"]
    end

    subgraph Auth["🔐 Authentication"]
        Keycloak["Keycloak OIDC"]
        SupaAuth["Supabase Auth"]
    end

    subgraph App["⚙️ Application Services"]
        NextJS["Next.js Server Actions<br/>(Business Logic)"]
        FastAPI["FastAPI Chatbot Svc<br/>(WebSocket/RAG)"]
    end

    subgraph Async["🔄 Workers & Queues"]
        Redis["Redis Message Broker"]
        ZKPWorker["ZKP Worker<br/>(BullMQ/snarkjs)"]
        ChatWorker["Chatbot Worker<br/>(ARQ/Gemini)"]
    end

    subgraph Data["💾 Infrastructure & Data"]
        Postgres["PostgreSQL (Data)"]
        Vector["Supabase Vector (pgvector)"]
        S3["Supabase Storage (Files)"]
    end

    %% Flow
    Browser -- 1. Login --> Keycloak
    Keycloak -- 2. Sync --> SupaAuth
    Browser -- 3. Actions --> NextJS
    Browser -- 4. Chat --> FastAPI
    
    NextJS -- 5. Query --> Postgres
    FastAPI -- 6. Vector Search --> Vector
    
    NextJS -- 7. Ingest --> Redis
    FastAPI -- 8. Enqueue --> Redis
    
    Redis -- 9. Job --> ZKPWorker
    Redis -- 10. Task --> ChatWorker
    
    ZKPWorker -- 11. Save Proof --> Postgres
    ChatWorker -- 12. Inference --> Gemini["✨ Google Gemini Pro"]
```

---

## 1. Problem Statement

Projek ini lahir untuk menyelesaikan tantangan krusial dalam dunia kesehatan:

*   **Risiko Privasi Data Medis**: Dalam proses klaim tradisional, pasien terpaksa membagikan seluruh isi rekam medis kepada asuransi. Data sensitif ini berisiko disalahgunakan (misalnya untuk menolak klaim di masa depan atau menaikkan premi secara sepihak).
*   **Kurangnya Blind Verification**: Belum ada mekanisme yang memungkinkan asuransi memverifikasi keabsahan klaim (apakah penyakit ditanggung atau tidak) tanpa harus membaca detail penyakit pasien secara eksplisit.
*   **Kompleksitas Data bagi Pasien**: Laporan rekam medis seringkali berisi istilah teknis yang sulit dipahami pasien awam. Pasien membutuhkan asisten pintar yang bisa memberikan wawasan cepat dari data medis mereka tanpa mengorbankan keamanan data tersebut.

---

## 2. Solusi yang Ditawarkan

Claimly menyelesaikan masalah di atas dengan pendekatan **Privacy-First**:

*   **Implementasi ZKP**: Mengaktifkan proses verifikasi "buta" di mana asuransi mendapatkan kepastian klaim valid secara matematis tanpa pernah melihat diagnosis asli pasien.
*   **Enkripsi End-to-End (E2EE)**: Memastikan data medis hanya bisa dibuka oleh kunci rahasia milik pasien dan rumah sakit terkait.
*   **AI Medical Assistant (RAG)**: Menyediakan chatbot cerdas yang mampu menjawab pertanyaan seputar rekam medis dengan konteks yang akurat dan aman.

---

## 3. Implementasi Teknologi Utama

### 🔐 Zero-Knowledge (ZKP) & Enkripsi
Teknologi kuncir untuk menjaga kerahasiaan data medis:

*   **Apa itu ZK Circuit?**: Secara sederhana, ZK Circuit adalah "logika matematika" yang diprogram untuk memeriksa sekumpulan syarat (input) tanpa perlu mengetahui atau membocorkan isi input tersebut. Jika semua syarat terpenuhi, sirkuit akan mengeluarkan bukti (Proof) yang sah.
*   **Verifikasi Klaim Pintar**: Sirkuit ZKP kami memverifikasi:
    *   **Diagnosis Validity**: Apakah kode ICD-10 pasien ada di dalam daftar yang ditanggung polis (menggunakan struktur *Merkle Tree*).
    *   **Procedure Match**: Apakah tindakan medis yang dilakukan sesuai dengan diagnosis yang diderita dan ada di dalam daftar yang ditanggung polis.
    *   **Cost & Date Limit**: Memastikan biaya tidak melebihi limit polis dan tanggal berobat masih dalam masa aktif polis.
*   **Enkripsi di Browser (Web Crypto API)**:
    *   Menggunakan skema **ECIES (ECDH)** untuk pertukaran kunci aman.
    *   Enkripsi catatan medis menggunakan **AES-256-GCM** langsung di sisi browser sebelum dikirim ke server.

### 🤖 Kecerdasan Buatan (AI RAG Chatbot)
Layanan chatbot medis yang dibangun dengan privasi sebagai prioritas:

*   **RAG (Retrieval-Augmented Generation)**: Chatbot mengambil potongan data medis yang relevan dari *Vector Store* (Supabase Vector) untuk memberikan jawaban yang berbasis fakta medis pasien.
*   **Zero-Persistence Processing**: Data medis yang didekripsi untuk keperluan pengolahan AI hanya berada di memori (RAM) sementara dan tidak pernah disimpan secara permanen di server chatbot.
*   **Integrasi Gemini Pro**: Menggunakan model Google Gemini Pro untuk memahami konteks medis yang kompleks dan memberikan jawaban yang empatik namun akurat.

---

## 4. Tech Stack Utama

*   **Web Framework**: Next.js (App Router), Tailwind CSS, shadcn/ui.
*   **Authentication**: Keycloak (OIDC) & Supabase Auth.
*   **Backend & Cloud**: Supabase (Postgres, Realtime, Storage, Edge Functions).
*   **Cryptography**: Circom & snarkjs (ZK-SNARKs), Web Crypto API.
*   **Asynchronous Processing**: FastAPI (Python), Redis, BullMQ (ZKP Worker), ARQ (Chatbot Worker).
*   **AI Engine**: Google Gemini Pro & Supabase Vector (pgvector).

---

## 5. Fitur Lainnya

*   **Role-Based Access Control (RBAC)**: Pemisahan akses ketat untuk Pasien, Staf RS, dan Reviewer Asuransi.
*   **Audit Trail**: Catatan aktivitas permanen untuk setiap pengajuan klaim dan akses data.
*   **Policy Management**: Pembuatan polis asuransi yang otomatis dikonversi menjadi akar kriptografi (*Merkle Root*).
*   **Real-time Notifications**: Pemberitahuan instan status klaim menggunakan Supabase Realtime.

---

© 2026 Claimly - Built for Privacy and Security.
