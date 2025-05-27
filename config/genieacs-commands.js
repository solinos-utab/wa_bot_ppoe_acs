// genieacs-commands.js - Module for handling GenieACS commands via WhatsApp
const { logger } = require('./logger');
const genieacsApi = require('./genieacs').genieacsApi;
const responses = require('./responses');

// Store the WhatsApp socket instance
let sock = null;

// Set the WhatsApp socket instance
function setSock(sockInstance) {
    sock = sockInstance;
    logger.info('WhatsApp socket set in genieacs-commands module');
}

// Menggunakan format pesan dari responses.js
function formatResponse(message) {
    return responses.formatWithHeaderFooter(message);
}

// Get device by phone number
async function getDeviceByNumber(phoneNumber) {
    try {
        return await genieacsApi.findDeviceByPhoneNumber(phoneNumber);
    } catch (error) {
        logger.error(`Error finding device with phone number ${phoneNumber}: ${error.message}`);
        return null;
    }
}

// Handler for WiFi info command
async function handleWifiInfo(remoteJid, senderNumber) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        // Find device by sender's phone number
        const device = await getDeviceByNumber(senderNumber);
        
        if (!device) {
            await sock.sendMessage(remoteJid, { 
                text: formatResponse(responses.deviceNotFoundResponse)
            });
            return;
        }
        
        // Get SSID information
        const ssid = getSSIDValue(device, '1') || 'N/A';
        const ssid5G = getSSIDValue(device, '5') || 'N/A';
        
        // Send WiFi information
        const wifiInfo = responses.wifiInfoResponse({
            ssid,
            ssid5G
        });
        
        await sock.sendMessage(remoteJid, {
            text: formatResponse(wifiInfo)
        });
    } catch (error) {
        logger.error(`Error handling WiFi info: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse(responses.generalErrorResponse(error.message))
        });
    }
}

// Handler for change WiFi SSID command
async function handleChangeWifiSSID(remoteJid, senderNumber, newSSID) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        if (!newSSID || newSSID.length < 3 || newSSID.length > 32) {
            await sock.sendMessage(remoteJid, { 
                text: formatResponse(responses.changeWifiResponse.invalidFormat)
            });
            return;
        }
        
        // Find device by sender's phone number
        const device = await getDeviceByNumber(senderNumber);
        
        if (!device) {
            await sock.sendMessage(remoteJid, { 
                text: formatResponse(responses.deviceNotFoundResponse)
            });
            return;
        }
        
        // Send processing message
        await sock.sendMessage(remoteJid, { 
            text: formatResponse(responses.changeWifiResponse.processing(newSSID))
        });
        
        // Set SSID parameter value
        await genieacsApi.setParameterValues(device._id, {
            'SSID': newSSID
        });
        
        // Send success message
        await sock.sendMessage(remoteJid, { 
            text: formatResponse(responses.changeWifiResponse.success(newSSID))
        });
        
    } catch (error) {
        logger.error(`Error changing WiFi SSID: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse(responses.changeWifiResponse.error(error.message))
        });
    }
}

// Handler for change WiFi password command
async function handleChangeWifiPassword(remoteJid, senderNumber, newPassword) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        if (!newPassword || newPassword.length < 8 || newPassword.length > 63) {
            await sock.sendMessage(remoteJid, { 
                text: formatResponse(responses.changePasswordResponse.invalidFormat)
            });
            return;
        }
        
        // Find device by sender's phone number
        const device = await getDeviceByNumber(senderNumber);
        
        if (!device) {
            await sock.sendMessage(remoteJid, { 
                text: formatResponse(responses.deviceNotFoundResponse)
            });
            return;
        }
        
        // Send processing message
        await sock.sendMessage(remoteJid, { 
            text: formatResponse(responses.changePasswordResponse.processing)
        });
        
        // Set password parameter value
        await genieacsApi.setParameterValues(device._id, {
            'KeyPassphrase': newPassword
        });
        
        // Send success message
        await sock.sendMessage(remoteJid, { 
            text: formatResponse(responses.changePasswordResponse.success)
        });
        
    } catch (error) {
        logger.error(`Error changing WiFi password: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse(responses.changePasswordResponse.error(error.message))
        });
    }
}

// Handler for device status command
async function handleDeviceStatus(remoteJid, senderNumber) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        // Find device by sender's phone number
        const device = await getDeviceByNumber(senderNumber);
        
        if (!device) {
            await sock.sendMessage(remoteJid, { 
                text: formatResponse(responses.deviceNotFoundResponse)
            });
            return;
        }
        
        // Get device status information
        const { getDeviceStatus, formatUptime, getParameterWithPaths, parameterPaths } = require('./whatsapp');
        
        const lastInform = device._lastInform;
        const isOnline = getDeviceStatus(lastInform);
        const serialNumber = device.InternetGatewayDevice?.DeviceInfo?.SerialNumber?._value || 'N/A';
        const firmware = getParameterWithPaths(device, parameterPaths.firmware) || 'N/A';
        const uptime = formatUptime(getParameterWithPaths(device, parameterPaths.uptime)) || 'N/A';
        const rxPower = getParameterWithPaths(device, parameterPaths.rxPower) || 'N/A';
        const pppoeIP = getParameterWithPaths(device, parameterPaths.pppoeIP) || 'N/A';
        const pppUsername = getParameterWithPaths(device, parameterPaths.pppUsername) || 'N/A';
        const ssid = getSSIDValue(device, '1') || 'N/A';
        const ssid5G = getSSIDValue(device, '5') || 'N/A';
        const connectedUsers = getParameterWithPaths(device, parameterPaths.userConnected) || '0';
        
        // Format device status
        const statusMessage = responses.statusResponse({
            isOnline,
            serialNumber,
            firmware,
            uptime,
            rxPower,
            pppoeIP,
            pppUsername,
            ssid,
            ssid5G,
            connectedUsers,
            lastInform: new Date(lastInform).toLocaleString()
        });
        
        // Send status message
        await sock.sendMessage(remoteJid, { 
            text: formatResponse(statusMessage)
        });
        
    } catch (error) {
        logger.error(`Error handling device status: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse(responses.generalErrorResponse(error.message))
        });
    }
}

// Handler for restart device command
async function handleRestartDevice(remoteJid, senderNumber) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        // Find device by sender's phone number
        const device = await getDeviceByNumber(senderNumber);
        
        if (!device) {
            await sock.sendMessage(remoteJid, { 
                text: formatResponse(responses.deviceNotFoundResponse)
            });
            return;
        }
        
        // Send confirmation message
        await sock.sendMessage(remoteJid, { 
            text: formatResponse(responses.restartResponse.confirmation)
        });
        
        // Save restart confirmation status
        global.pendingRestarts = global.pendingRestarts || {};
        global.pendingRestarts[senderNumber] = {
            deviceId: device._id,
            timestamp: Date.now()
        };
        
    } catch (error) {
        logger.error(`Error preparing device restart: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse(responses.restartResponse.error(error.message))
        });
    }
}

// Handler for restart confirmation
async function handleRestartConfirmation(remoteJid, senderNumber, confirmed) {
    if (!sock) {
        logger.error('Sock instance not set');
        return;
    }

    try {
        if (!global.pendingRestarts || !global.pendingRestarts[senderNumber]) {
            await sock.sendMessage(remoteJid, { 
                text: formatResponse(responses.restartResponse.noPendingRequest)
            });
            return;
        }
        
        const { deviceId, timestamp } = global.pendingRestarts[senderNumber];
        
        // Check if confirmation is still valid (within 5 minutes)
        if (Date.now() - timestamp > 5 * 60 * 1000) {
            await sock.sendMessage(remoteJid, { 
                text: formatResponse(responses.restartResponse.expired)
            });
            delete global.pendingRestarts[senderNumber];
            return;
        }
        
        if (confirmed) {
            // Send processing message
            await sock.sendMessage(remoteJid, { 
                text: formatResponse(responses.restartResponse.processing)
            });
            
            // Restart device
            await genieacsApi.reboot(deviceId);
            
            // Send success message
            await sock.sendMessage(remoteJid, { 
                text: formatResponse(responses.restartResponse.success)
            });
        } else {
            // Send cancellation message
            await sock.sendMessage(remoteJid, { 
                text: formatResponse(responses.restartResponse.canceled)
            });
        }
        
        // Delete restart confirmation status
        delete global.pendingRestarts[senderNumber];
        
    } catch (error) {
        logger.error(`Error handling restart confirmation: ${error.message}`);
        await sock.sendMessage(remoteJid, {
            text: formatResponse(responses.restartResponse.error(error.message))
        });
        
        // Delete restart confirmation status even if error
        if (global.pendingRestarts && global.pendingRestarts[senderNumber]) {
            delete global.pendingRestarts[senderNumber];
        }
    }
}

// Helper function to get SSID value
function getSSIDValue(device, configIndex) {
    try {
        // Try method 1: Using bracket notation for WLANConfiguration
        if (device.InternetGatewayDevice && 
            device.InternetGatewayDevice.LANDevice && 
            device.InternetGatewayDevice.LANDevice['1'] && 
            device.InternetGatewayDevice.LANDevice['1'].WLANConfiguration && 
            device.InternetGatewayDevice.LANDevice['1'].WLANConfiguration[configIndex] && 
            device.InternetGatewayDevice.LANDevice['1'].WLANConfiguration[configIndex].SSID) {
            
            const ssidObj = device.InternetGatewayDevice.LANDevice['1'].WLANConfiguration[configIndex].SSID;
            if (ssidObj._value !== undefined) {
                return ssidObj._value;
            }
        }
        
        // Try method 2: Using getParameterWithPaths
        const { getParameterWithPaths } = require('./whatsapp');
        const ssidPath = `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${configIndex}.SSID`;
        const ssidValue = getParameterWithPaths(device, [ssidPath]);
        if (ssidValue && ssidValue !== 'N/A') {
            return ssidValue;
        }
        
        // Try method 3: Search in entire object
        for (const key in device) {
            if (device[key]?.LANDevice?.['1']?.WLANConfiguration?.[configIndex]?.SSID?._value) {
                return device[key].LANDevice['1'].WLANConfiguration[configIndex].SSID._value;
            }
        }
        
        // Try method 4: Check in virtual parameters
        if (device.VirtualParameters?.SSID?._value) {
            return device.VirtualParameters.SSID._value;
        }
        
        if (configIndex === '5' && device.InternetGatewayDevice?.LANDevice?.['1']?.WLANConfiguration?.['2']?.SSID?._value) {
            return device.InternetGatewayDevice.LANDevice['1'].WLANConfiguration['2'].SSID._value;
        }
        
        return 'N/A';
    } catch (error) {
        logger.error(`Error getting SSID for config ${configIndex}: ${error.message}`);
        return 'N/A';
    }
}

module.exports = {
    setSock,
    handleWifiInfo,
    handleChangeWifiSSID,
    handleChangeWifiPassword,
    handleDeviceStatus,
    handleRestartDevice,
    handleRestartConfirmation
};
