const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '192.168.1.52',
  user: process.env.MYSQL_USER || 'adtr',
  password: process.env.MYSQL_PASSWORD || 'adtr',
  database: process.env.MYSQL_DATABASE || 'new_dtr',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection
pool.getConnection()
  .then(conn => {
    console.log('✅ Connected to MySQL database');
    conn.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err);
  });

// Biometric Device Simulation Class
class BiometricSimulator {
  constructor(ip, port = 4370) {
    this.ip = ip;
    this.port = port;
    this.name = `Biometric-${ip}`;
  }

  // Simulate getting attendance data from biometric device
  async get_attendance() {
    console.log(`🔌 Simulating connection to biometric device: ${this.ip}:${this.port}`);
    
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate sample attendance data
    const sampleData = [
      {
        user_id: '1001',
        timestamp: new Date('2024-01-15 08:00:00'),
        status: 0,
        uid: 1
      },
      {
        user_id: '1002', 
        timestamp: new Date('2024-01-15 08:05:00'),
        status: 0,
        uid: 2
      },
      {
        user_id: '1001',
        timestamp: new Date('2024-01-15 12:00:00'),
        status: 1,
        uid: 3
      },
      {
        user_id: '1002',
        timestamp: new Date('2024-01-15 12:05:00'),
        status: 1,
        uid: 4
      },
      {
        user_id: '1001',
        timestamp: new Date('2024-01-15 13:00:00'),
        status: 0,
        uid: 5
      },
      {
        user_id: '1002',
        timestamp: new Date('2024-01-15 13:05:00'),
        status: 0,
        uid: 6
      },
      {
        user_id: '1001',
        timestamp: new Date('2024-01-15 17:00:00'),
        status: 1,
        uid: 7
      },
      {
        user_id: '1002',
        timestamp: new Date('2024-01-15 17:05:00'),
        status: 1,
        uid: 8
      }
    ];

    console.log(`📊 Generated ${sampleData.length} sample attendance records`);
    return sampleData;
  }

  connect() {
    console.log(`✅ Connected to biometric device: ${this.ip}`);
    return Promise.resolve();
  }

  disconnect() {
    console.log(`❌ Disconnected from biometric device: ${this.ip}`);
    return Promise.resolve();
  }
}

// Test Biometric Import Endpoint
app.post('/test-biometric-import', async (req, res) => {
  let connection;
  try {
    const { biometric_ip = '192.168.1.202', start, end } = req.body;

    console.log('🧪 Starting biometric import test...');
    console.log('Request parameters:', { biometric_ip, start, end });

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Create biometric simulator
    const biometric = new BiometricSimulator(biometric_ip);
    
    console.log('🔌 Connecting to biometric device...');
    await biometric.connect();

    console.log('📥 Fetching attendance records...');
    const attendances = await biometric.get_attendance();

    const dtrs = [];
    let processed = 0;
    let filtered = 0;

    console.log('🔄 Processing attendance records...');
    for (const attendance of attendances) {
      const temp_datetime = attendance.timestamp;
      const recordDate = temp_datetime.toISOString().split('T')[0];

      // Apply date filtering (same logic as Python)
      if (start && end) {
        if (!(recordDate >= start && recordDate <= end)) {
          filtered++;
          continue;
        }
      } else if (start && !end) {
        if (!(recordDate >= start)) {
          filtered++;
          continue;
        }
      } else if (!start && end) {
        if (!(recordDate <= end)) {
          filtered++;
          continue;
        }
      }

      const employee_number = attendance.user_id;
      const created_at = temp_datetime.toISOString().slice(0, 19).replace('T', ' ');
      
      dtrs.push({
        employee_id: employee_number,
        created_at: created_at,
        original_timestamp: temp_datetime
      });
      processed++;
    }

    console.log(`📊 Records: ${processed} processed, ${filtered} filtered by date`);

    // Remove duplicates based on employee_id + created_at
    const uniqueDtrs = dtrs.filter((dtr, index, self) => 
      index === self.findIndex(t => 
        t.employee_id === dtr.employee_id && 
        t.created_at === dtr.created_at
      )
    );

    console.log(`✨ After deduplication: ${uniqueDtrs.length} unique records`);

    // Insert into imports table
    let inserted = 0;
    let skipped = 0;

    for (const dtr of uniqueDtrs) {
      try {
        await connection.query(
          'INSERT INTO imports (employee_id, created_at) VALUES (?, ?)',
          [dtr.employee_id, dtr.created_at]
        );
        inserted++;
        console.log(`✅ Inserted: ${dtr.employee_id} at ${dtr.created_at}`);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          skipped++;
          console.log(`⏭️ Skipped duplicate: ${dtr.employee_id} at ${dtr.created_at}`);
        } else {
          throw error;
        }
      }
    }

    // Add log entry
    await connection.query(
      'INSERT INTO logs (admin_id, action, category, original, updated, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [1, 'import', 'import', '', `test_import(source = biometric, origin = ${biometric_ip})`]
    );

    await connection.commit();

    // Disconnect from biometric device
    await biometric.disconnect();

    const result = {
      message: 'Biometric import test completed successfully!',
      device_ip: biometric_ip,
      records_fetched: attendances.length,
      records_processed: processed,
      records_filtered: filtered,
      records_inserted: inserted,
      records_skipped: skipped,
      sample_records: uniqueDtrs.slice(0, 3) // Show first 3 records as sample
    };

    console.log('🎉 Import completed:', result);
    res.json(result);

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('❌ Error in biometric import test:', error);
    res.status(500).json({ 
      message: 'Biometric import test failed',
      error: error.message 
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Get biometric devices from database
app.get('/test-biometric-devices', async (req, res) => {
  try {
    const [devices] = await pool.query(`
      SELECT 
        id as biometric_id,
        name,
        ip_address,
        port,
        active
      FROM biometrics 
      ORDER BY id
    `);
    
    res.json({
      message: 'Available biometric devices',
      devices: devices
    });
  } catch (error) {
    console.error('Error fetching biometric devices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear test imports (optional cleanup endpoint)
app.delete('/test-clear-imports', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM imports WHERE created_at LIKE "2024-01-15%"');
    res.json({
      message: 'Test imports cleared',
      records_deleted: result.affectedRows
    });
  } catch (error) {
    console.error('Error clearing imports:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.TEST_PORT || 5001;
app.listen(PORT, () => {
  console.log(`🧪 Biometric Test Server running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   POST /test-biometric-import - Test biometric import`);
  console.log(`   GET  /test-biometric-devices - List available devices`);
  console.log(`   DELETE /test-clear-imports - Clear test data`);
});