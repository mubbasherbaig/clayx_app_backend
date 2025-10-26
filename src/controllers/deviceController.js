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

// Send command to device (NEW)
exports.sendDeviceCommand = async (req, res) => {
  try {
    const userId = req.user.userId;
    const deviceId = req.params.id;
    const { commandType, commandValue } = req.body;

    if (!commandType || !commandValue) {
      return res.status(400).json({
        success: false,
        message: 'Command type and value are required',
      });
    }

    // Verify device belongs to user
    const deviceCheck = await pool.query(
      'SELECT id FROM devices WHERE id = $1 AND user_id = $2',
      [deviceId, userId]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    // Insert command
    const result = await pool.query(
      `INSERT INTO device_commands (device_id, command_type, command_value, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [deviceId, commandType, commandValue]
    );

    res.status(201).json({
      success: true,
      message: 'Command sent successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Send command error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Get latest command for device (NEW)
exports.getLatestCommand = async (req, res) => {
  try {
    const userId = req.user.userId;
    const deviceId = req.params.id;
    const { commandType } = req.query;

    // Verify device belongs to user
    const deviceCheck = await pool.query(
      'SELECT id FROM devices WHERE id = $1 AND user_id = $2',
      [deviceId, userId]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    let query = 'SELECT * FROM device_commands WHERE device_id = $1';
    const params = [deviceId];

    if (commandType) {
      query += ' AND command_type = $2';
      params.push(commandType);
    }

    query += ' ORDER BY created_at DESC LIMIT 1';

    const result = await pool.query(query, params);

    res.status(200).json({
      success: true,
      data: result.rows[0] || null,
    });
  } catch (error) {
    console.error('Get latest command error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Get pending commands for device - for ESP32 to poll (NEW)
exports.getPendingCommands = async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Get device internal ID
    const deviceCheck = await pool.query(
      'SELECT id FROM devices WHERE device_id = $1',
      [deviceId]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    const internalDeviceId = deviceCheck.rows[0].id;

    // Get pending commands
    const result = await pool.query(
      `SELECT * FROM device_commands 
       WHERE device_id = $1 AND status = 'pending'
       ORDER BY created_at ASC`,
      [internalDeviceId]
    );

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get pending commands error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Update command status - for ESP32 to confirm execution (NEW)
exports.updateCommandStatus = async (req, res) => {
  try {
    const { commandId } = req.params;
    const { status } = req.body;

    if (!['executed', 'failed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "executed" or "failed"',
      });
    }

    const result = await pool.query(
      `UPDATE device_commands 
       SET status = $1, executed_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, commandId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Command not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Command status updated',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update command status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};