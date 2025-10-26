const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes (no auth - for ESP32)
router.post('/data', sensorController.postSensorData);
router.get('/device/:deviceId/commands', sensorController.getDeviceCommands);
router.post('/device/command/executed', sensorController.markCommandExecuted);

// Protected routes (for app)
router.post('/device/command', authMiddleware, sensorController.sendDeviceCommand);
router.get('/plants/:plantId/latest', authMiddleware, sensorController.getLatestReading);
router.get('/plants/:plantId/history', authMiddleware, sensorController.getHistoricalData);

module.exports = router;