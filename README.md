# Botlokal WhatsApp-Only

Versi ringan dari Botlokal yang hanya menggunakan fitur WhatsApp tanpa web interface.

## Persyaratan

- Node.js v14+ (direkomendasikan v16+)
- npm atau yarn
- Akses ke GenieACS API
- Akses ke Mikrotik API (opsional)

## Cara Instalasi

### 1. Install Dependensi

```bash
npm install
```

### 2. Konfigurasi Environment Variables

Salin file `.env.example` menjadi `.env` dan sesuaikan:

```bash
cp .env.example .env
```

Edit file `.env` dengan pengaturan yang sesuai:

### 3. Menjalankan Aplikasi

```bash
node app-whatsapp-only.js
```

Scan QR code yang muncul di terminal untuk login WhatsApp.

## Perintah WhatsApp

### Perintah untuk Pelanggan
- `menu` - Menampilkan menu bantuan
- `status` - Cek status perangkat
- `refresh` - Refresh data perangkat
- `gantiwifi [nama]` - Ganti nama WiFi
- `gantipass [password]` - Ganti password WiFi

### Perintah untuk Admin
- Semua perintah pelanggan
- `admin` - Menampilkan menu admin
- `cek [nomor]` - Cek status ONU pelanggan
- `list` - Daftar semua ONU
- `cekall` - Cek status semua ONU
- `editssid [nomor] [ssid]` - Edit SSID pelanggan
- `editpass [nomor] [password]` - Edit password WiFi pelanggan
- `addhotspot [user] [pass] [profile]` - Tambah user hotspot
- `delhotspot [user]` - Hapus user hotspot
- `hotspot` - Lihat user hotspot aktif
- `addpppoe [user] [pass] [profile] [ip]` - Tambah secret PPPoE
- `delpppoe [user]` - Hapus secret PPPoE
- `setprofile [user] [profile]` - Ubah profile PPPoE
- `pppoe` - Lihat koneksi PPPoE aktif
- `offline` - Lihat user PPPoE offline
- `resource` - Info resource router
- `addwan [nomor] [tipe] [mode]` - Tambah konfigurasi WAN
- `addtag [device_id] [nomor]` - Tambahkan nomor pelanggan ke perangkat
- `addpppoe_tag [pppoe_username] [nomor]` - Tambahkan nomor pelanggan berdasarkan PPPoE
