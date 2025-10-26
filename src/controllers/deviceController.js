const pool = require('../config/database');

// Get all devices for a user
exports.getAllDevices = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      'SELECT * FROM devices WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Register new device
exports.registerDevice = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required',
      });
    }

    // Check if device already exists
    const deviceExists = await pool.query(
      'SELECT * FROM devices WHERE device_id = $1',
      [deviceId]
    );

    if (deviceExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Device already registered',
      });
    }

    const result = await pool.query(
      'INSERT INTO devices (device_id, user_id, is_online) VALUES ($1, $2, false) RETURNING *',
      [deviceId, userId]
    );

    res.status(201).json({
      success: true,
      message: 'Device registered successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Register device error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Get device by ID
exports.getDeviceById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const deviceId = req.params.id;

    const result = await pool.query(
      'SELECT * FROM devices WHERE id = $1 AND user_id = $2',
      [deviceId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Update device status
exports.updateDevice = async (req, res) => {
  try {
    const userId = req.user.userId;
    const deviceId = req.params.id;
    const { isOnline } = req.body;

    const result = await pool.query(
      `UPDATE devices 
       SET is_online = COALESCE($1, is_online),
           last_seen = CASE WHEN $1 = true THEN NOW() ELSE last_seen END
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [isOnline, deviceId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Device updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Delete device
exports.deleteDevice = async (req, res) => {
  try {
    const userId = req.user.userId;
    const deviceId = req.params.id;

    const result = await pool.query(
      'DELETE FROM devices WHERE id = $1 AND user_id = $2 RETURNING id',
      [deviceId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Device deleted successfully',
    });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};
exports.getPumpCommand = async (req, res) => {
  try {
    const deviceId = req.params.id;

    const result = await pool.query(
      'SELECT pump_command FROM devices WHERE device_id = $1',
      [deviceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    res.status(200).json({
      success: true,
      pump: result.rows[0].pump_command || 'auto',
    });
  } catch (error) {
    console.error('Get pump command error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

exports.setPumpCommand = async (req, res) => {
  try {
    const deviceId = req.params.id;
    const { pump } = req.body;

    if (!['on', 'off', 'auto'].includes(pump)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pump command. Use "on", "off", or "auto".',
      });
    }

    const result = await pool.query(
      'UPDATE devices SET pump_command = $1 WHERE device_id = $2 RETURNING *',
      [pump, deviceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Pump command updated',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Set pump command error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};