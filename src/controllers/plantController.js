const pool = require('../config/database');

// Get all plants for a user
exports.getAllPlants = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT p.*, d.device_id, d.is_online, d.last_seen,
       (SELECT temperature FROM sensor_readings WHERE plant_id = p.id ORDER BY timestamp DESC LIMIT 1) as temperature,
       (SELECT humidity FROM sensor_readings WHERE plant_id = p.id ORDER BY timestamp DESC LIMIT 1) as humidity,
       (SELECT soil_moisture FROM sensor_readings WHERE plant_id = p.id ORDER BY timestamp DESC LIMIT 1) as soil_moisture,
       (SELECT water_level FROM sensor_readings WHERE plant_id = p.id ORDER BY timestamp DESC LIMIT 1) as water_level,
       (SELECT light_level FROM sensor_readings WHERE plant_id = p.id ORDER BY timestamp DESC LIMIT 1) as light_level
       FROM plants p
       LEFT JOIN devices d ON p.device_id = d.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [userId]
    );

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get plants error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Get single plant by ID
exports.getPlantById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const plantId = req.params.id;

    const result = await pool.query(
      `SELECT p.*, d.device_id, d.is_online, d.last_seen
       FROM plants p
       LEFT JOIN devices d ON p.device_id = d.id
       WHERE p.id = $1 AND p.user_id = $2`,
      [plantId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Plant not found',
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get plant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Create new plant
exports.createPlant = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { plantName, plantType, deviceId, location, imageUrl } = req.body;

    if (!plantName || !deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Plant name and device ID are required',
      });
    }

    // Check if device exists and belongs to user
    const deviceCheck = await pool.query(
      'SELECT id FROM devices WHERE device_id = $1 AND user_id = $2',
      [deviceId, userId]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or does not belong to you',
      });
    }

    const result = await pool.query(
      `INSERT INTO plants (user_id, device_id, plant_name, plant_type, location, image_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, deviceCheck.rows[0].id, plantName, plantType, location, imageUrl]
    );

    res.status(201).json({
      success: true,
      message: 'Plant added successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create plant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Update plant
exports.updatePlant = async (req, res) => {
  try {
    const userId = req.user.userId;
    const plantId = req.params.id;
    const { plantName, plantType, location, imageUrl } = req.body;

    // Check if plant belongs to user
    const plantCheck = await pool.query(
      'SELECT id FROM plants WHERE id = $1 AND user_id = $2',
      [plantId, userId]
    );

    if (plantCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Plant not found',
      });
    }

    const result = await pool.query(
      `UPDATE plants 
       SET plant_name = COALESCE($1, plant_name),
           plant_type = COALESCE($2, plant_type),
           location = COALESCE($3, location),
           image_url = COALESCE($4, image_url),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [plantName, plantType, location, imageUrl, plantId]
    );

    res.status(200).json({
      success: true,
      message: 'Plant updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update plant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Delete plant
exports.deletePlant = async (req, res) => {
  try {
    const userId = req.user.userId;
    const plantId = req.params.id;

    const result = await pool.query(
      'DELETE FROM plants WHERE id = $1 AND user_id = $2 RETURNING id',
      [plantId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Plant not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Plant deleted successfully',
    });
  } catch (error) {
    console.error('Delete plant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Get plant care timeline
exports.getPlantTimeline = async (req, res) => {
  try {
    const userId = req.user.userId;
    const plantId = req.params.id;

    // Check if plant belongs to user
    const plantCheck = await pool.query(
      'SELECT id FROM plants WHERE id = $1 AND user_id = $2',
      [plantId, userId]
    );

    if (plantCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Plant not found',
      });
    }

    const result = await pool.query(
      'SELECT * FROM care_events WHERE plant_id = $1 ORDER BY created_at DESC LIMIT 20',
      [plantId]
    );

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Log watering event
exports.waterPlant = async (req, res) => {
  try {
    const userId = req.user.userId;
    const plantId = req.params.id;

    // Check if plant belongs to user
    const plantCheck = await pool.query(
      'SELECT id, plant_name FROM plants WHERE id = $1 AND user_id = $2',
      [plantId, userId]
    );

    if (plantCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Plant not found',
      });
    }

    const result = await pool.query(
      `INSERT INTO care_events (plant_id, event_type, description, icon)
       VALUES ($1, 'watered', 'Plant was watered', 'water_drop')
       RETURNING *`,
      [plantId]
    );

    res.status(201).json({
      success: true,
      message: 'Watering event logged',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Water plant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};