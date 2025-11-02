const jwt = require('jsonwebtoken');
const pool = require('../config/database');

module.exports = (io) => {
  // Middleware for Socket.IO authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      // Allow ESP32 devices to connect without token (they use deviceId)
      const deviceId = socket.handshake.query.deviceId;
      if (deviceId) {
        socket.deviceId = deviceId;
        socket.isDevice = true;
        return next();
      }
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.isDevice = false;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`[WS] New connection: ${socket.id} (${socket.isDevice ? 'Device' : 'User'})`);

    if (socket.isDevice) {
      // ESP32 Device connected
      const deviceId = socket.deviceId;
      console.log(`[WS] Device connected: ${deviceId}`);

      // Update device status
      try {
        await pool.query(
          `UPDATE devices 
           SET is_online = true, last_seen = NOW() 
           WHERE device_id = $1`,
          [deviceId]
        );

        // Join device room
        socket.join(`device:${deviceId}`);

        // Notify users monitoring this device
        socket.to(`device:${deviceId}`).emit('device_status', {
          deviceId,
          isOnline: true,
          lastSeen: new Date()
        });

      } catch (error) {
        console.error('[WS] Error updating device status:', error);
      }

      // Handle sensor data from ESP32
      socket.on('sensor_data', async (data) => {
        console.log(`[WS] Sensor data from ${deviceId}:`, data);

        try {
          // Get device and plant info
          const deviceResult = await pool.query(
            `SELECT d.id as device_id, p.id as plant_id 
             FROM devices d
             LEFT JOIN plants p ON p.device_id = d.id
             WHERE d.device_id = $1`,
            [deviceId]
          );

          if (deviceResult.rows.length > 0) {
            const { device_id, plant_id } = deviceResult.rows[0];

            // Update device last_seen
            await pool.query(
              'UPDATE devices SET is_online = true, last_seen = NOW() WHERE id = $1',
              [device_id]
            );

            // Insert sensor reading
            const reading = await pool.query(
              `INSERT INTO sensor_readings 
               (device_id, plant_id, temperature, humidity, soil_moisture, water_level, light_level)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING *`,
              [
                device_id,
                plant_id,
                data.temperature || null,
                data.humidity || null,
                data.soilMoisture || null,
                data.waterLevel || null,
                data.lightLevel || null
              ]
            );

            // Broadcast to users monitoring this device/plant
            io.to(`device:${deviceId}`).emit('sensor_update', {
              deviceId,
              plantId: plant_id,
              data: reading.rows[0]
            });

            // Send acknowledgment to device
            socket.emit('sensor_ack', { success: true });
          }
        } catch (error) {
          console.error('[WS] Error processing sensor data:', error);
          socket.emit('sensor_ack', { success: false, error: error.message });
        }
      });

      // Handle command acknowledgment from ESP32
      socket.on('command_executed', async (data) => {
        console.log(`[WS] Command executed by ${deviceId}:`, data);

        try {
          await pool.query(
            `UPDATE device_commands 
             SET status = 'executed', executed_at = NOW()
             WHERE id = $1`,
            [data.commandId]
          );

          // Notify users
          io.to(`device:${deviceId}`).emit('command_status', {
            commandId: data.commandId,
            status: 'executed',
            deviceId
          });
        } catch (error) {
          console.error('[WS] Error updating command status:', error);
        }
      });

    } else {
      // Mobile App User connected
      const userId = socket.userId;
      console.log(`[WS] User connected: ${userId}`);

      // Get user's devices and join their rooms
      try {
        const devicesResult = await pool.query(
          'SELECT device_id FROM devices WHERE user_id = $1',
          [userId]
        );

        devicesResult.rows.forEach(row => {
          socket.join(`device:${row.device_id}`);
        });

        console.log(`[WS] User ${userId} joined ${devicesResult.rows.length} device rooms`);
      } catch (error) {
        console.error('[WS] Error joining device rooms:', error);
      }

      // Handle command from mobile app
      socket.on('send_command', async (data) => {
        console.log(`[WS] Command from user ${userId}:`, data);

        try {
          const { deviceId, commandType, commandValue } = data;

          // Verify device belongs to user
          const deviceCheck = await pool.query(
            'SELECT d.id FROM devices d WHERE d.device_id = $1 AND d.user_id = $2',
            [deviceId, userId]
          );

          if (deviceCheck.rows.length === 0) {
            socket.emit('command_error', { error: 'Device not found or access denied' });
            return;
          }

          const device_id = deviceCheck.rows[0].id;

          // Insert command
          const result = await pool.query(
            `INSERT INTO device_commands (device_id, command_type, command_value, status)
             VALUES ($1, $2, $3, 'pending')
             RETURNING *`,
            [device_id, commandType, commandValue]
          );

          const command = result.rows[0];

          // Send command directly to ESP32 via WebSocket
          io.to(`device:${deviceId}`).emit('command', {
            id: command.id,
            commandType: command.command_type,
            commandValue: command.command_value
          });

          // Acknowledge to app
          socket.emit('command_sent', {
            commandId: command.id,
            status: 'pending'
          });

        } catch (error) {
          console.error('[WS] Error sending command:', error);
          socket.emit('command_error', { error: error.message });
        }
      });

      // Handle request for latest sensor data
      socket.on('get_sensor_data', async (data) => {
        try {
          const { plantId } = data;

          const result = await pool.query(
            'SELECT * FROM sensor_readings WHERE plant_id = $1 ORDER BY timestamp DESC LIMIT 1',
            [plantId]
          );

          socket.emit('sensor_data_response', {
            plantId,
            data: result.rows[0] || null
          });
        } catch (error) {
          console.error('[WS] Error getting sensor data:', error);
        }
      });
    }

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`[WS] Disconnected: ${socket.id}`);

      if (socket.isDevice && socket.deviceId) {
        // Update device status
        try {
          await pool.query(
            'UPDATE devices SET is_online = false WHERE device_id = $1',
            [socket.deviceId]
          );

          // Notify users
          io.to(`device:${socket.deviceId}`).emit('device_status', {
            deviceId: socket.deviceId,
            isOnline: false,
            lastSeen: new Date()
          });
        } catch (error) {
          console.error('[WS] Error updating device status on disconnect:', error);
        }
      }
    });
  });

  console.log('[WS] Socket.IO handler initialized');
};