const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');
const commandController = require('../controllers/commandController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route for ESP to post data (no auth required for device posting)
router.post('/data', sensorController.postSensorData);

// Public routes for ESP to poll and execute commands (no auth required)
router.get('/device/:deviceId/commands', commandController.getPendingCommands);
router.post('/commands/:commandId/execute', commandController.markCommandExecuted);

// Protected routes for app
router.get('/plants/:plantId/latest', authMiddleware, sensorController.getLatestReading);
router.get('/plants/:plantId/history', authMiddleware, sensorController.getHistoricalData);

// Protected routes for app to send commands
router.post('/commands', authMiddleware, commandController.createCommand);
router.get('/device/:deviceId/commands/history', authMiddleware, commandController.getCommandHistory);

module.exports = router;