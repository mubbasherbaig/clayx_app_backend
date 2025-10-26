const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const authMiddleware = require('../middleware/authMiddleware');

// Protected routes (require authentication)
router.get('/', authMiddleware, deviceController.getAllDevices);
router.post('/', authMiddleware, deviceController.registerDevice);
router.get('/:id', authMiddleware, deviceController.getDeviceById);
router.put('/:id', authMiddleware, deviceController.updateDevice);
router.delete('/:id', authMiddleware, deviceController.deleteDevice);

// NEW: Command routes
router.post('/:id/command', authMiddleware, deviceController.sendDeviceCommand);
router.get('/:id/command/latest', authMiddleware, deviceController.getLatestCommand);

// Public routes for ESP32 (no auth required)
router.get('/:deviceId/commands/pending', deviceController.getPendingCommands);
router.put('/commands/:commandId/status', deviceController.updateCommandStatus);

module.exports = router;