// pppoe-commands.js - WhatsApp commands for PPPoE notification management
const { logger } = require('./logger');
const pppoeNotifications = require('./pppoe-notifications');
const pppoeMonitor = require('./pppoe-monitor');

// Store the WhatsApp socket instance
let sock = null;

// Set the WhatsApp socket instance
function setSock(sockInstance) {
    sock = sockInstance;
    logger.info('WhatsApp socket set in pppoe-commands module');
}

// Handler untuk mengaktifkan notifikasi PPPoE
async function handleEnablePPPoENotifications(remoteJid) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        const success = pppoeNotifications.setNotificationStatus(true);
        
        if (success) {
            // Start monitoring if not already running
            await pppoeMonitor.startPPPoEMonitoring();
            
            await sock.sendMessage(remoteJid, {
                text: `✅ *NOTIFIKASI PPPoE DIAKTIFKAN*\n\n` +
                      `Notifikasi login/logout PPPoE telah diaktifkan.\n` +
                      `Monitoring PPPoE dimulai.\n\n` +
                      `Gunakan "pppoe status" untuk melihat status lengkap.`
            });
            
            logger.info('PPPoE notifications enabled via WhatsApp command');
        } else {
            await sock.sendMessage(remoteJid, {
                text: `❌ *GAGAL MENGAKTIFKAN NOTIFIKASI*\n\n` +
                      `Terjadi kesalahan saat menyimpan pengaturan.`
            });
        }
    } catch (error) {
        logger.error(`Error enabling PPPoE notifications: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: `❌ *ERROR*\n\nTerjadi kesalahan: ${error.message}`
        });
    }
}

// Handler untuk menonaktifkan notifikasi PPPoE
async function handleDisablePPPoENotifications(remoteJid) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        const success = pppoeNotifications.setNotificationStatus(false);
        
        if (success) {
            await sock.sendMessage(remoteJid, {
                text: `🔕 *NOTIFIKASI PPPoE DINONAKTIFKAN*\n\n` +
                      `Notifikasi login/logout PPPoE telah dinonaktifkan.\n` +
                      `Monitoring tetap berjalan tapi notifikasi tidak dikirim.\n\n` +
                      `Gunakan "pppoe on" untuk mengaktifkan kembali.`
            });
            
            logger.info('PPPoE notifications disabled via WhatsApp command');
        } else {
            await sock.sendMessage(remoteJid, {
                text: `❌ *GAGAL MENONAKTIFKAN NOTIFIKASI*\n\n` +
                      `Terjadi kesalahan saat menyimpan pengaturan.`
            });
        }
    } catch (error) {
        logger.error(`Error disabling PPPoE notifications: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: `❌ *ERROR*\n\nTerjadi kesalahan: ${error.message}`
        });
    }
}

// Handler untuk melihat status notifikasi PPPoE
async function handlePPPoEStatus(remoteJid) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        const status = pppoeMonitor.getMonitoringStatus();
        const settings = pppoeNotifications.getSettings();
        
        let message = `📊 *STATUS NOTIFIKASI PPPoE*\n\n`;
        
        // Status monitoring
        message += `🔄 *Monitoring:* ${status.isRunning ? '🟢 Berjalan' : '🔴 Berhenti'}\n`;
        message += `🔔 *Notifikasi:* ${status.notificationsEnabled ? '🟢 Aktif' : '🔴 Nonaktif'}\n`;
        message += `📥 *Login Notif:* ${status.loginNotifications ? '🟢 Aktif' : '🔴 Nonaktif'}\n`;
        message += `📤 *Logout Notif:* ${status.logoutNotifications ? '🟢 Aktif' : '🔴 Nonaktif'}\n`;
        message += `⏱️ *Interval:* ${status.interval/1000} detik\n`;
        message += `👥 *Koneksi Aktif:* ${status.activeConnections}\n\n`;
        
        // Recipients
        message += `📱 *Penerima Notifikasi:*\n`;
        if (settings.adminNumbers.length > 0) {
            message += `• Admin (${settings.adminNumbers.length}): ${settings.adminNumbers.join(', ')}\n`;
        }
        if (settings.technicianNumbers.length > 0) {
            message += `• Teknisi (${settings.technicianNumbers.length}): ${settings.technicianNumbers.join(', ')}\n`;
        }
        if (settings.adminNumbers.length === 0 && settings.technicianNumbers.length === 0) {
            message += `• Belum ada nomor terdaftar\n`;
        }
        
        message += `\n💡 *Perintah Tersedia:*\n`;
        message += `• pppoe on - Aktifkan notifikasi\n`;
        message += `• pppoe off - Nonaktifkan notifikasi\n`;
        message += `• pppoe addadmin [nomor] - Tambah admin\n`;
        message += `• pppoe addtech [nomor] - Tambah teknisi\n`;
        message += `• pppoe interval [detik] - Ubah interval\n`;
        message += `• pppoe test - Test notifikasi`;
        
        await sock.sendMessage(remoteJid, { text: message });
        
    } catch (error) {
        logger.error(`Error getting PPPoE status: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: `❌ *ERROR*\n\nTerjadi kesalahan: ${error.message}`
        });
    }
}

// Handler untuk menambah nomor admin
async function handleAddAdminNumber(remoteJid, phoneNumber) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        // Format nomor telepon
        const formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (formattedNumber.length < 10) {
            await sock.sendMessage(remoteJid, {
                text: `❌ *FORMAT NOMOR SALAH*\n\n` +
                      `Format yang benar:\n` +
                      `pppoe addadmin 081234567890`
            });
            return;
        }
        
        const success = pppoeNotifications.addAdminNumber(formattedNumber);
        
        if (success) {
            await sock.sendMessage(remoteJid, {
                text: `✅ *ADMIN DITAMBAHKAN*\n\n` +
                      `Nomor ${formattedNumber} berhasil ditambahkan sebagai admin.\n` +
                      `Nomor ini akan menerima notifikasi PPPoE.`
            });
            
            logger.info(`Admin number added: ${formattedNumber}`);
        } else {
            await sock.sendMessage(remoteJid, {
                text: `❌ *GAGAL MENAMBAH ADMIN*\n\n` +
                      `Terjadi kesalahan saat menyimpan pengaturan.`
            });
        }
    } catch (error) {
        logger.error(`Error adding admin number: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: `❌ *ERROR*\n\nTerjadi kesalahan: ${error.message}`
        });
    }
}

// Handler untuk menambah nomor teknisi
async function handleAddTechnicianNumber(remoteJid, phoneNumber) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        // Format nomor telepon
        const formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (formattedNumber.length < 10) {
            await sock.sendMessage(remoteJid, {
                text: `❌ *FORMAT NOMOR SALAH*\n\n` +
                      `Format yang benar:\n` +
                      `pppoe addtech 081234567890`
            });
            return;
        }
        
        const success = pppoeNotifications.addTechnicianNumber(formattedNumber);
        
        if (success) {
            await sock.sendMessage(remoteJid, {
                text: `✅ *TEKNISI DITAMBAHKAN*\n\n` +
                      `Nomor ${formattedNumber} berhasil ditambahkan sebagai teknisi.\n` +
                      `Nomor ini akan menerima notifikasi PPPoE.`
            });
            
            logger.info(`Technician number added: ${formattedNumber}`);
        } else {
            await sock.sendMessage(remoteJid, {
                text: `❌ *GAGAL MENAMBAH TEKNISI*\n\n` +
                      `Terjadi kesalahan saat menyimpan pengaturan.`
            });
        }
    } catch (error) {
        logger.error(`Error adding technician number: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: `❌ *ERROR*\n\nTerjadi kesalahan: ${error.message}`
        });
    }
}

// Handler untuk mengubah interval monitoring
async function handleSetInterval(remoteJid, seconds) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        const intervalSeconds = parseInt(seconds);
        if (isNaN(intervalSeconds) || intervalSeconds < 30 || intervalSeconds > 3600) {
            await sock.sendMessage(remoteJid, {
                text: `❌ *INTERVAL TIDAK VALID*\n\n` +
                      `Interval harus antara 30-3600 detik.\n\n` +
                      `Contoh: pppoe interval 60`
            });
            return;
        }
        
        const intervalMs = intervalSeconds * 1000;
        const result = await pppoeMonitor.setMonitoringInterval(intervalMs);
        
        if (result.success) {
            await sock.sendMessage(remoteJid, {
                text: `✅ *INTERVAL DIUBAH*\n\n` +
                      `Interval monitoring PPPoE diubah menjadi ${intervalSeconds} detik.\n` +
                      `Monitoring akan restart dengan interval baru.`
            });
            
            logger.info(`PPPoE monitoring interval changed to ${intervalSeconds} seconds`);
        } else {
            await sock.sendMessage(remoteJid, {
                text: `❌ *GAGAL MENGUBAH INTERVAL*\n\n${result.message}`
            });
        }
    } catch (error) {
        logger.error(`Error setting interval: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: `❌ *ERROR*\n\nTerjadi kesalahan: ${error.message}`
        });
    }
}

// Handler untuk test notifikasi
async function handleTestNotification(remoteJid) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        const testMessage = `🧪 *TEST NOTIFIKASI PPPoE*\n\n` +
                           `Ini adalah test notifikasi PPPoE.\n` +
                           `Jika Anda menerima pesan ini, berarti notifikasi berfungsi dengan baik.\n\n` +
                           `⏰ ${new Date().toLocaleString()}`;
        
        const success = await pppoeNotifications.sendNotification(testMessage);
        
        if (success) {
            await sock.sendMessage(remoteJid, {
                text: `✅ *TEST NOTIFIKASI BERHASIL*\n\n` +
                      `Notifikasi test telah dikirim ke semua nomor terdaftar.`
            });
        } else {
            await sock.sendMessage(remoteJid, {
                text: `❌ *TEST NOTIFIKASI GAGAL*\n\n` +
                      `Tidak ada nomor terdaftar atau terjadi kesalahan.`
            });
        }
    } catch (error) {
        logger.error(`Error sending test notification: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: `❌ *ERROR*\n\nTerjadi kesalahan: ${error.message}`
        });
    }
}

module.exports = {
    setSock,
    handleEnablePPPoENotifications,
    handleDisablePPPoENotifications,
    handlePPPoEStatus,
    handleAddAdminNumber,
    handleAddTechnicianNumber,
    handleSetInterval,
    handleTestNotification
};
