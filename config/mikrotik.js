// Modul untuk koneksi dan operasi Mikrotik
const { RouterOSAPI } = require('node-routeros');
const { logger } = require('./logger');
require('dotenv').config();

let sock = null;
let mikrotikConnection = null;
let monitorInterval = null;

// Fungsi untuk set instance sock
function setSock(sockInstance) {
    sock = sockInstance;
}

// Fungsi untuk koneksi ke Mikrotik
async function connectToMikrotik() {
    try {
        // Dapatkan konfigurasi Mikrotik
        const host = global.appSettings.mikrotikHost || process.env.MIKROTIK_HOST;
        const port = parseInt(global.appSettings.mikrotikPort || process.env.MIKROTIK_PORT || '8728');
        const user = global.appSettings.mikrotikUser || process.env.MIKROTIK_USER;
        const password = global.appSettings.mikrotikPassword || process.env.MIKROTIK_PASSWORD;
        
        if (!host || !user || !password) {
            logger.error('Mikrotik configuration is incomplete');
            return null;
        }
        
        // Buat koneksi ke Mikrotik
        const conn = new RouterOSAPI({
            host,
            port,
            user,
            password,
            keepalive: true
        });
        
        // Connect ke Mikrotik
        await conn.connect();
        logger.info(`Connected to Mikrotik at ${host}:${port}`);
        
        // Set global connection
        mikrotikConnection = conn;
        
        return conn;
    } catch (error) {
        logger.error(`Error connecting to Mikrotik: ${error.message}`);
        return null;
    }
}

// Fungsi untuk mendapatkan koneksi Mikrotik
async function getMikrotikConnection() {
    if (!mikrotikConnection) {
        return await connectToMikrotik();
    }
    return mikrotikConnection;
}

// Fungsi untuk mendapatkan daftar koneksi PPPoE aktif
async function getActivePPPoEConnections() {
    try {
        const conn = await getMikrotikConnection();
        if (!conn) {
            logger.error('No Mikrotik connection available');
            return [];
        }
        
        // Dapatkan daftar koneksi PPPoE aktif
        const pppConnections = await conn.write('/ppp/active/print');
        return pppConnections;
    } catch (error) {
        logger.error(`Error getting active PPPoE connections: ${error.message}`);
        return [];
    }
}

// Fungsi untuk mendapatkan daftar user PPPoE offline
async function getOfflinePPPoEUsers() {
    try {
        const conn = await getMikrotikConnection();
        if (!conn) {
            logger.error('No Mikrotik connection available');
            return [];
        }
        
        // Dapatkan semua secret PPPoE
        const pppSecrets = await conn.write('/ppp/secret/print');
        
        // Dapatkan koneksi aktif
        const activeConnections = await getActivePPPoEConnections();
        const activeUsers = activeConnections.map(conn => conn.name);
        
        // Filter user yang offline
        const offlineUsers = pppSecrets.filter(secret => !activeUsers.includes(secret.name));
        
        return offlineUsers;
    } catch (error) {
        logger.error(`Error getting offline PPPoE users: ${error.message}`);
        return [];
    }
}

// Fungsi untuk mendapatkan informasi user PPPoE yang tidak aktif (untuk whatsapp.js)
async function getInactivePPPoEUsers() {
    try {
        // Dapatkan semua secret PPPoE
        const pppSecrets = await getMikrotikConnection().then(conn => {
            if (!conn) return [];
            return conn.write('/ppp/secret/print');
        });
        
        // Dapatkan koneksi aktif
        const activeConnections = await getActivePPPoEConnections();
        const activeUsers = activeConnections.map(conn => conn.name);
        
        // Filter user yang offline
        const inactiveUsers = pppSecrets.filter(secret => !activeUsers.includes(secret.name));
        
        // Format hasil untuk whatsapp.js
        return {
            success: true,
            totalSecrets: pppSecrets.length,
            totalActive: activeUsers.length,
            totalInactive: inactiveUsers.length,
            data: inactiveUsers.map(user => ({
                name: user.name,
                comment: user.comment || '',
                profile: user.profile,
                lastLogout: user['last-logged-out'] || 'N/A'
            }))
        };
    } catch (error) {
        logger.error(`Error getting inactive PPPoE users: ${error.message}`);
        return {
            success: false,
            message: error.message,
            totalSecrets: 0,
            totalActive: 0,
            totalInactive: 0,
            data: []
        };
    }
}

// Fungsi untuk mendapatkan resource router
async function getRouterResources() {
    try {
        const conn = await getMikrotikConnection();
        if (!conn) {
            logger.error('No Mikrotik connection available');
            return null;
        }
        
        // Dapatkan resource router
        const resources = await conn.write('/system/resource/print');
        return resources[0];
    } catch (error) {
        logger.error(`Error getting router resources: ${error.message}`);
        return null;
    }
}

// Fungsi untuk mendapatkan informasi resource yang diformat
async function getResourceInfo() {
    try {
        const resources = await getRouterResources();
        if (!resources) {
            return null;
        }
        
        // Format informasi resource
        return {
            cpuLoad: resources['cpu-load'] || '0',
            memoryUsed: Math.round((parseInt(resources['total-memory'] || 0) - parseInt(resources['free-memory'] || 0)) / 1024 / 1024),
            totalMemory: Math.round(parseInt(resources['total-memory'] || 0) / 1024 / 1024),
            diskUsed: Math.round((parseInt(resources['total-hdd-space'] || 0) - parseInt(resources['free-hdd-space'] || 0)) / 1024 / 1024),
            totalDisk: Math.round(parseInt(resources['total-hdd-space'] || 0) / 1024 / 1024),
            uptime: resources.uptime || 'N/A',
            version: resources.version || 'N/A',
            boardName: resources['board-name'] || 'N/A'
        };
    } catch (error) {
        logger.error(`Error getting formatted resource info: ${error.message}`);
        return null;
    }
}

// Fungsi untuk mendapatkan daftar user hotspot aktif
async function getActiveHotspotUsers() {
    try {
        const conn = await getMikrotikConnection();
        if (!conn) {
            logger.error('No Mikrotik connection available');
            return [];
        }
        
        // Dapatkan daftar user hotspot aktif
        const hotspotUsers = await conn.write('/ip/hotspot/active/print');
        return hotspotUsers;
    } catch (error) {
        logger.error(`Error getting active hotspot users: ${error.message}`);
        return [];
    }
}

// Fungsi untuk menambahkan user hotspot
async function addHotspotUser(username, password, profile) {
    try {
        const conn = await getMikrotikConnection();
        if (!conn) {
            logger.error('No Mikrotik connection available');
            return false;
        }
        
        // Tambahkan user hotspot
        await conn.write('/ip/hotspot/user/add', [
            '=name=' + username,
            '=password=' + password,
            '=profile=' + profile
        ]);
        
        return true;
    } catch (error) {
        logger.error(`Error adding hotspot user: ${error.message}`);
        return false;
    }
}

// Fungsi untuk menghapus user hotspot
async function deleteHotspotUser(username) {
    try {
        const conn = await getMikrotikConnection();
        if (!conn) {
            logger.error('No Mikrotik connection available');
            return false;
        }
        
        // Cari user hotspot
        const users = await conn.write('/ip/hotspot/user/print', [
            '?name=' + username
        ]);
        
        if (users.length === 0) {
            return false;
        }
        
        // Hapus user hotspot
        await conn.write('/ip/hotspot/user/remove', [
            '=.id=' + users[0]['.id']
        ]);
        
        return true;
    } catch (error) {
        logger.error(`Error deleting hotspot user: ${error.message}`);
        return false;
    }
}

// Fungsi untuk menambahkan secret PPPoE
async function addPPPoESecret(username, password, profile, localAddress = '') {
    try {
        const conn = await getMikrotikConnection();
        if (!conn) {
            logger.error('No Mikrotik connection available');
            return false;
        }
        
        // Parameter untuk menambahkan secret
        const params = [
            '=name=' + username,
            '=password=' + password,
            '=profile=' + profile,
            '=service=pppoe'
        ];
        
        // Tambahkan local address jika ada
        if (localAddress) {
            params.push('=local-address=' + localAddress);
        }
        
        // Tambahkan secret PPPoE
        await conn.write('/ppp/secret/add', params);
        
        return true;
    } catch (error) {
        logger.error(`Error adding PPPoE secret: ${error.message}`);
        return false;
    }
}

// Fungsi untuk menghapus secret PPPoE
async function deletePPPoESecret(username) {
    try {
        const conn = await getMikrotikConnection();
        if (!conn) {
            logger.error('No Mikrotik connection available');
            return false;
        }
        
        // Cari secret PPPoE
        const secrets = await conn.write('/ppp/secret/print', [
            '?name=' + username
        ]);
        
        if (secrets.length === 0) {
            return false;
        }
        
        // Hapus secret PPPoE
        await conn.write('/ppp/secret/remove', [
            '=.id=' + secrets[0]['.id']
        ]);
        
        return true;
    } catch (error) {
        logger.error(`Error deleting PPPoE secret: ${error.message}`);
        return false;
    }
}

// Fungsi untuk mengubah profile PPPoE
async function setPPPoEProfile(username, profile) {
    try {
        const conn = await getMikrotikConnection();
        if (!conn) {
            logger.error('No Mikrotik connection available');
            return false;
        }
        
        // Cari secret PPPoE
        const secrets = await conn.write('/ppp/secret/print', [
            '?name=' + username
        ]);
        
        if (secrets.length === 0) {
            return false;
        }
        
        // Ubah profile PPPoE
        await conn.write('/ppp/secret/set', [
            '=.id=' + secrets[0]['.id'],
            '=profile=' + profile
        ]);
        
        return true;
    } catch (error) {
        logger.error(`Error setting PPPoE profile: ${error.message}`);
        return false;
    }
}

// Fungsi untuk monitoring koneksi PPPoE
async function monitorPPPoEConnections() {
    try {
        // Dapatkan interval monitoring dari konfigurasi
        const interval = parseInt(global.appSettings.pppoeMonitorInterval || process.env.PPPOE_MONITOR_INTERVAL || '60000');
        
        // Bersihkan interval sebelumnya jika ada
        if (monitorInterval) {
            clearInterval(monitorInterval);
        }
        
        // Set interval untuk monitoring
        monitorInterval = setInterval(async () => {
            try {
                // Dapatkan koneksi PPPoE aktif
                const connections = await getActivePPPoEConnections();
                logger.info(`Monitoring PPPoE connections: ${connections.length} active connections`);
                
                // TODO: Implementasi logika monitoring lebih lanjut
                
            } catch (error) {
                logger.error(`Error in PPPoE monitoring: ${error.message}`);
            }
        }, interval);
        
        logger.info(`PPPoE monitoring started with interval ${interval}ms`);
    } catch (error) {
        logger.error(`Error starting PPPoE monitoring: ${error.message}`);
    }
}

module.exports = {
    setSock,
    connectToMikrotik,
    getMikrotikConnection,
    getActivePPPoEConnections,
    getOfflinePPPoEUsers,
    getInactivePPPoEUsers,
    getRouterResources,
    getResourceInfo,
    getActiveHotspotUsers,
    addHotspotUser,
    deleteHotspotUser,
    addPPPoESecret,
    deletePPPoESecret,
    setPPPoEProfile,
    monitorPPPoEConnections
};
