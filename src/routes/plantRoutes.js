const express = require('express');
const router = express.Router();
const plantController = require('../controllers/plantController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes are protected
router.use(authMiddleware);

router.get('/', plantController.getAllPlants);
router.get('/:id', plantController.getPlantById);
router.post('/', plantController.createPlant);
router.put('/:id', plantController.updatePlant);
router.delete('/:id', plantController.deletePlant);
router.get('/:id/timeline', plantController.getPlantTimeline);
router.post('/:id/water', plantController.waterPlant);

module.exports = router;