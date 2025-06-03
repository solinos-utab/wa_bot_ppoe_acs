// pppoe-notifications.js - Module for managing PPPoE login/logout notifications
const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');
const { getMikrotikConnection } = require('./mikrotik');

// Path untuk menyimpan pengaturan notifikasi
const settingsPath = path.join(__dirname, '..', 'pppoe-notification-settings.json');

// Default settings
const defaultSettings = {
    enabled: true,
    loginNotifications: true,
    logoutNotifications: true,
    includeOfflineList: true,
    maxOfflineListCount: 20,
    adminNumbers: [], // Nomor admin yang akan menerima notifikasi
    technicianNumbers: [], // Nomor teknisi yang akan menerima notifikasi
    monitorInterval: 60000, // 1 menit
    lastActiveUsers: []
};

// Store the WhatsApp socket instance
let sock = null;
let monitorInterval = null;
let lastActivePPPoE = [];

// Set the WhatsApp socket instance
function setSock(sockInstance) {
    sock = sockInstance;
    logger.info('WhatsApp socket set in pppoe-notifications module');
}

// Load settings from file
function loadSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            const settings = JSON.parse(data);
            return { ...defaultSettings, ...settings };
        }
        return defaultSettings;
    } catch (error) {
        logger.error(`Error loading PPPoE notification settings: ${error.message}`);
        return defaultSettings;
    }
}

// Save settings to file
function saveSettings(settings) {
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        logger.info('PPPoE notification settings saved');
        return true;
    } catch (error) {
        logger.error(`Error saving PPPoE notification settings: ${error.message}`);
        return false;
    }
}

// Get current settings
function getSettings() {
    return loadSettings();
}

// Update settings
function updateSettings(newSettings) {
    const currentSettings = loadSettings();
    const updatedSettings = { ...currentSettings, ...newSettings };
    return saveSettings(updatedSettings);
}

// Enable/disable notifications
function setNotificationStatus(enabled) {
    return updateSettings({ enabled });
}

// Enable/disable login notifications
function setLoginNotifications(enabled) {
    return updateSettings({ loginNotifications: enabled });
}

// Enable/disable logout notifications
function setLogoutNotifications(enabled) {
    return updateSettings({ logoutNotifications: enabled });
}

// Set admin numbers
function setAdminNumbers(numbers) {
    const adminNumbers = Array.isArray(numbers) ? numbers : [numbers];
    return updateSettings({ adminNumbers });
}

// Set technician numbers
function setTechnicianNumbers(numbers) {
    const technicianNumbers = Array.isArray(numbers) ? numbers : [numbers];
    return updateSettings({ technicianNumbers });
}

// Add admin number
function addAdminNumber(number) {
    const settings = loadSettings();
    if (!settings.adminNumbers.includes(number)) {
        settings.adminNumbers.push(number);
        return saveSettings(settings);
    }
    return true;
}

// Add technician number
function addTechnicianNumber(number) {
    const settings = loadSettings();
    if (!settings.technicianNumbers.includes(number)) {
        settings.technicianNumbers.push(number);
        return saveSettings(settings);
    }
    return true;
}

// Remove admin number
function removeAdminNumber(number) {
    const settings = loadSettings();
    settings.adminNumbers = settings.adminNumbers.filter(n => n !== number);
    return saveSettings(settings);
}

// Remove technician number
function removeTechnicianNumber(number) {
    const settings = loadSettings();
    settings.technicianNumbers = settings.technicianNumbers.filter(n => n !== number);
    return saveSettings(settings);
}

// Send notification to admin and technician numbers
async function sendNotification(message) {
    if (!sock) {
        logger.error('WhatsApp socket not available for PPPoE notifications');
        return false;
    }

    const settings = loadSettings();
    if (!settings.enabled) {
        logger.info('PPPoE notifications are disabled');
        return false;
    }

    const recipients = [...settings.adminNumbers, ...settings.technicianNumbers];
    const uniqueRecipients = [...new Set(recipients)]; // Remove duplicates

    let successCount = 0;
    for (const number of uniqueRecipients) {
        try {
            const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
            await sock.sendMessage(jid, { text: message });
            successCount++;
            logger.info(`PPPoE notification sent to ${number}`);
        } catch (error) {
            logger.error(`Failed to send PPPoE notification to ${number}: ${error.message}`);
        }
    }

    logger.info(`PPPoE notification sent to ${successCount}/${uniqueRecipients.length} recipients`);
    return successCount > 0;
}

// Get active PPPoE connections
async function getActivePPPoEConnections() {
    try {
        const conn = await getMikrotikConnection();
        if (!conn) {
            logger.error('No Mikrotik connection available for PPPoE monitoring');
            return { success: false, data: [] };
        }
        
        const pppConnections = await conn.write('/ppp/active/print');
        return {
            success: true,
            data: pppConnections
        };
    } catch (error) {
        logger.error(`Error getting active PPPoE connections: ${error.message}`);
        return { success: false, data: [] };
    }
}

// Get offline PPPoE users
async function getOfflinePPPoEUsers(activeUsers) {
    try {
        const conn = await getMikrotikConnection();
        if (!conn) {
            return [];
        }
        
        const pppSecrets = await conn.write('/ppp/secret/print');
        const offlineUsers = pppSecrets.filter(secret => !activeUsers.includes(secret.name));
        return offlineUsers.map(user => user.name);
    } catch (error) {
        logger.error(`Error getting offline PPPoE users: ${error.message}`);
        return [];
    }
}

// Format login notification message
function formatLoginMessage(loginUsers, connections, offlineUsers) {
    const settings = loadSettings();
    let message = `🔔 *PPPoE LOGIN NOTIFICATION*\n\n`;
    
    message += `📊 *User Login (${loginUsers.length}):*\n`;
    loginUsers.forEach((username, index) => {
        const connection = connections.find(c => c.name === username);
        message += `${index + 1}. *${username}*\n`;
        if (connection) {
            message += `   • IP: ${connection.address || 'N/A'}\n`;
            message += `   • Uptime: ${connection.uptime || 'N/A'}\n`;
        }
        message += '\n';
    });
    
    if (settings.includeOfflineList && offlineUsers.length > 0) {
        const maxCount = settings.maxOfflineListCount;
        const displayCount = Math.min(offlineUsers.length, maxCount);
        
        message += `🚫 *User Offline (${offlineUsers.length}):*\n`;
        for (let i = 0; i < displayCount; i++) {
            message += `${i + 1}. ${offlineUsers[i]}\n`;
        }
        
        if (offlineUsers.length > maxCount) {
            message += `... dan ${offlineUsers.length - maxCount} user lainnya\n`;
        }
    }
    
    message += `\n⏰ ${new Date().toLocaleString()}`;
    return message;
}

// Format logout notification message
function formatLogoutMessage(logoutUsers, offlineUsers) {
    const settings = loadSettings();
    let message = `🚪 *PPPoE LOGOUT NOTIFICATION*\n\n`;
    
    message += `📊 *User Logout (${logoutUsers.length}):*\n`;
    logoutUsers.forEach((username, index) => {
        message += `${index + 1}. *${username}*\n`;
    });
    
    if (settings.includeOfflineList && offlineUsers.length > 0) {
        const maxCount = settings.maxOfflineListCount;
        const displayCount = Math.min(offlineUsers.length, maxCount);
        
        message += `\n🚫 *Total User Offline (${offlineUsers.length}):*\n`;
        for (let i = 0; i < displayCount; i++) {
            message += `${i + 1}. ${offlineUsers[i]}\n`;
        }
        
        if (offlineUsers.length > maxCount) {
            message += `... dan ${offlineUsers.length - maxCount} user lainnya\n`;
        }
    }
    
    message += `\n⏰ ${new Date().toLocaleString()}`;
    return message;
}

module.exports = {
    setSock,
    loadSettings,
    saveSettings,
    getSettings,
    updateSettings,
    setNotificationStatus,
    setLoginNotifications,
    setLogoutNotifications,
    setAdminNumbers,
    setTechnicianNumbers,
    addAdminNumber,
    addTechnicianNumber,
    removeAdminNumber,
    removeTechnicianNumber,
    sendNotification,
    getActivePPPoEConnections,
    getOfflinePPPoEUsers,
    formatLoginMessage,
    formatLogoutMessage
};
