const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route for ESP to post data (no auth required for device posting)
router.post('/data', sensorController.postSensorData);

// Protected routes for app
router.get('/plants/:plantId/latest', authMiddleware, sensorController.getLatestReading);
router.get('/plants/:plantId/history', authMiddleware, sensorController.getHistoricalData);
router.get('/device/:deviceId/commands', sensorController.getDeviceCommands);

module.exports = router;