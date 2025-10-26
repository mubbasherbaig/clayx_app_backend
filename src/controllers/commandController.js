const pool = require('../config/database');

// Get pending commands for a device (ESP32 polls this)
exports.getPendingCommands = async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Get device by device_id string
    const deviceResult = await pool.query(
      'SELECT id FROM devices WHERE device_id = $1',
      [deviceId]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    const device_id = deviceResult.rows[0].id;

    // Get all pending commands
    const result = await pool.query(
      `SELECT id, command_type, command_value, created_at
       FROM device_commands
       WHERE device_id = $1 AND status = 'pending'
       ORDER BY created_at ASC`,
      [device_id]
    );

    res.status(200).json({
      success: true,
      data: {
        commands: result.rows,
      },
    });
  } catch (error) {
    console.error('Get pending commands error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Mark command as executed (ESP32 calls this after executing)
exports.markCommandExecuted = async (req, res) => {
  try {
    const { commandId } = req.params;
    const { deviceId } = req.body;

    // Verify the command belongs to this device
    const result = await pool.query(
      `UPDATE device_commands dc
       SET status = 'executed', executed_at = NOW()
       FROM devices d
       WHERE dc.id = $1 
       AND dc.device_id = d.id 
       AND d.device_id = $2
       AND dc.status = 'pending'
       RETURNING dc.id`,
      [commandId, deviceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Command not found or already executed',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Command marked as executed',
    });
  } catch (error) {
    console.error('Mark command executed error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Create a new command (from mobile app)
exports.createCommand = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { deviceId, commandType, commandValue } = req.body;

    if (!deviceId || !commandType || !commandValue) {
      return res.status(400).json({
        success: false,
        message: 'Device ID, command type, and command value are required',
      });
    }

    // Verify device belongs to user
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

    const device_id = deviceCheck.rows[0].id;

    // Create the command
    const result = await pool.query(
      `INSERT INTO device_commands (device_id, command_type, command_value, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [device_id, commandType, commandValue]
    );

    res.status(201).json({
      success: true,
      message: 'Command created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create command error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Get command history for a device
exports.getCommandHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { deviceId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    // Verify device belongs to user
    const deviceCheck = await pool.query(
      'SELECT id FROM devices WHERE device_id = $1 AND user_id = $2',
      [deviceId, userId]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    const device_id = deviceCheck.rows[0].id;

    const result = await pool.query(
      `SELECT id, command_type, command_value, status, created_at, executed_at
       FROM device_commands
       WHERE device_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [device_id, limit]
    );

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get command history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};