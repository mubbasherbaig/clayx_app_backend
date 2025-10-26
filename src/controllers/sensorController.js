const pool = require('../config/database');

// Post sensor data (from ESP)
exports.postSensorData = async (req, res) => {
  try {
    const { deviceId, temperature, humidity, soilMoisture, waterLevel, lightLevel } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required',
      });
    }

    // Get device and plant info
    const deviceResult = await pool.query(
      `SELECT d.id as device_id, p.id as plant_id 
       FROM devices d
       LEFT JOIN plants p ON p.device_id = d.id
       WHERE d.device_id = $1`,
      [deviceId]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    const { device_id, plant_id } = deviceResult.rows[0];

    // Update device last_seen and is_online
    await pool.query(
      'UPDATE devices SET is_online = true, last_seen = NOW() WHERE id = $1',
      [device_id]
    );

    // Insert sensor reading
    const result = await pool.query(
      `INSERT INTO sensor_readings 
       (device_id, plant_id, temperature, humidity, soil_moisture, water_level, light_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [device_id, plant_id, temperature, humidity, soilMoisture, waterLevel, lightLevel]
    );

    res.status(201).json({
      success: true,
      message: 'Sensor data recorded',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Post sensor data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Get latest sensor reading for a plant
exports.getLatestReading = async (req, res) => {
  try {
    const userId = req.user.userId;
    const plantId = req.params.plantId;

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
      'SELECT * FROM sensor_readings WHERE plant_id = $1 ORDER BY timestamp DESC LIMIT 1',
      [plantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No sensor data available',
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get latest reading error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Get historical sensor data
exports.getHistoricalData = async (req, res) => {
  try {
    const userId = req.user.userId;
    const plantId = req.params.plantId;
    const { startDate, endDate, limit = 100 } = req.query;

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

    let query = 'SELECT * FROM sensor_readings WHERE plant_id = $1';
    const params = [plantId];

    if (startDate) {
      query += ' AND timestamp >= $2';
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND timestamp <= $${params.length + 1}`;
      params.push(endDate);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get historical data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};
// Get latest control commands for device (NO AUTH REQUIRED)
exports.getDeviceCommands = async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Get device info
    const deviceResult = await pool.query(
      'SELECT id, is_online FROM devices WHERE device_id = $1',
      [deviceId]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    // Return simple command structure for device
    res.status(200).json({
      success: true,
      data: {
        pumpOn: false, // Can be controlled from app later
        interval: 30, // Seconds between readings
      },
    });
  } catch (error) {
    console.error('Get device commands error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};