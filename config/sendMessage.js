let sock = null;

// Fungsi untuk set instance sock
function setSock(sockInstance) {
    sock = sockInstance;
}

// Helper function untuk format nomor telepon
function formatPhoneNumber(number) {
    // Hapus karakter non-digit
    let cleaned = number.replace(/\D/g, '');
    
    // Hapus awalan 0 jika ada
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }
    
    // Tambahkan kode negara 62 jika belum ada
    if (!cleaned.startsWith('62')) {
        cleaned = '62' + cleaned;
    }
    
    return cleaned;
}

// Fungsi untuk mengirim pesan
async function sendMessage(number, message) {
    if (!sock) {
        console.error('WhatsApp belum terhubung');
        return false;
    }
    try {
        let jid;
        if (typeof number === 'string' && number.endsWith('@g.us')) {
            // Jika group JID, gunakan langsung
            jid = number;
        } else {
            const formattedNumber = formatPhoneNumber(number);
            jid = `${formattedNumber}@s.whatsapp.net`;
        }
        await sock.sendMessage(jid, { text: message });
        return true;
    } catch (error) {
        console.error('Error sending message:', error);
        return false;
    }
}

// Fungsi untuk mengirim pesan ke beberapa nomor sekaligus
async function sendGroupMessage(numbers, message) {
    if (!sock) {
        console.error('WhatsApp belum terhubung');
        return { success: false, sent: 0, failed: numbers.length };
    }

    let sent = 0;
    let failed = 0;
    const results = [];

    // Jika numbers adalah string tunggal, konversi ke array
    const numberArray = typeof numbers === 'string' 
        ? numbers.split(',').map(n => n.trim()) 
        : Array.isArray(numbers) ? numbers : [numbers];

    console.log(`Mengirim pesan ke ${numberArray.length} nomor`);

    for (const number of numberArray) {
        try {
            if (!number || number.trim() === '') continue;
            
            const formattedNumber = formatPhoneNumber(number);
            await sock.sendMessage(`${formattedNumber}@s.whatsapp.net`, { text: message });
            sent++;
            results.push({ number: formattedNumber, success: true });
            
            // Tunggu sebentar antara pengiriman untuk menghindari rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`Error sending message to ${number}:`, error);
            failed++;
            results.push({ number, success: false, error: error.message });
        }
    }

    return { 
        success: sent > 0, 
        sent, 
        failed,
        results
    };
}

// Fungsi untuk mengirim pesan ke grup teknisi
async function sendTechnicianMessage(message, priority = 'normal') {
    try {
        // Ambil daftar nomor teknisi dari environment variable
        const technicianNumbers = process.env.TECHNICIAN_NUMBERS;
        if (!technicianNumbers) {
            console.warn('TECHNICIAN_NUMBERS tidak ditemukan di .env file. Hanya mengirim ke admin.');
            
            // Jika tidak ada nomor teknisi yang dikonfigurasi, kirim ke admin saja
            const adminNumber = process.env.ADMIN_NUMBER;
            if (adminNumber) {
                return await sendMessage(adminNumber, message);
            } else {
                console.error('ADMIN_NUMBER juga tidak ditemukan di .env file.');
                return false;
            }
        }

        // Tambahkan indikator prioritas di awal pesan
        let priorityIcon = '';
        if (priority === 'high' || priority === 'urgent') {
            priorityIcon = '🔴 *URGENT!* ';
        } else if (priority === 'medium') {
            priorityIcon = '🟠 *PENTING* ';
        } else if (priority === 'low') {
            priorityIcon = '🟢 *Info* ';
        }

        const priorityMessage = priorityIcon + message;
        
        // Kirim pesan ke semua nomor teknisi
        const result = await sendGroupMessage(technicianNumbers, priorityMessage);
        console.log(`Pesan dikirim ke grup teknisi: ${result.sent} berhasil, ${result.failed} gagal`);
        
        return result.success;
    } catch (error) {
        console.error('Error sending message to technician group:', error);
        return false;
    }
}

module.exports = {
    setSock,
    sendMessage,
    sendGroupMessage,
    sendTechnicianMessage
};
