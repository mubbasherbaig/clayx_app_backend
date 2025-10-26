const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes are protected
router.use(authMiddleware);

router.get('/', deviceController.getAllDevices);
router.post('/', deviceController.registerDevice);
router.get('/:id', deviceController.getDeviceById);
router.put('/:id', deviceController.updateDevice);
router.delete('/:id', deviceController.deleteDevice);
router.get('/:id/command', deviceController.getPumpCommand);
router.post('/:id/command', deviceController.setPumpCommand);
module.exports = router;