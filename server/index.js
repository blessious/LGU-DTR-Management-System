const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { spawn } = require('child_process');
const app = express();


// ========== SESSION TRACKING SYSTEM ==========
const activeSessions = new Map(); // Track active sessions

// Middleware to track sessions
app.use((req, res, next) => {
  // Extract session identifier
  const sessionId = req.headers['x-session-id'] ||
    req.headers['authorization']?.split(' ')[1] ||
    `${req.ip}-${req.headers['user-agent']}`;

  const now = Date.now();

  // Update or create session
  if (!activeSessions.has(sessionId)) {
    activeSessions.set(sessionId, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path,
      method: req.method,
      firstSeen: now,
      lastActivity: now,
      requestCount: 1,
      username: 'unknown'
    });

    // Log new session
    console.log(`🔵 [SESSION] New session: ${sessionId.substring(0, 20)}...`);
    console.log(`   IP: ${req.ip}, Path: ${req.method} ${req.path}`);
    printActiveSessions();
  } else {
    const session = activeSessions.get(sessionId);
    session.lastActivity = now;
    session.requestCount++;
    session.path = req.path;
    session.method = req.method;
  }

  // Clean up old sessions periodically
  if (Math.random() < 0.01) { // ~1% chance on each request
    cleanupOldSessions();
  }

  next();
});

// Function to print active sessions
function printActiveSessions() {
  console.log('\n📊 ACTIVE SESSIONS:');
  console.log('═'.repeat(60));

  const now = Date.now();
  let activeCount = 0;

  activeSessions.forEach((session, sessionId) => {
    const age = Math.floor((now - session.firstSeen) / 1000);
    const inactive = Math.floor((now - session.lastActivity) / 1000);

    // Remove sessions inactive for more than 30 minutes
    if (inactive > 1800) {
      activeSessions.delete(sessionId);
      return;
    }

    activeCount++;

    console.log(`• Session: ${sessionId.substring(0, 20)}...`);
    console.log(`  IP: ${session.ip}`);
    console.log(`  User: ${session.username}`);
    console.log(`  Age: ${age}s, Inactive: ${inactive}s`);
    console.log(`  Requests: ${session.requestCount}`);
    console.log(`  Last: ${session.method} ${session.path}`);
    console.log('');
  });

  console.log(`Total active sessions: ${activeCount}`);
  console.log('═'.repeat(60) + '\n');
}

// Cleanup function for old sessions
function cleanupOldSessions() {
  const now = Date.now();
  let removedCount = 0;

  activeSessions.forEach((session, sessionId) => {
    const inactive = Math.floor((now - session.lastActivity) / 1000);

    if (inactive > 1800) { // 30 minutes
      activeSessions.delete(sessionId);
      removedCount++;
    }
  });

  if (removedCount > 0) {
    console.log(`🧹 Cleaned up ${removedCount} inactive sessions`);
  }
}

// ========== END SESSION TRACKING SYSTEM ==========

app.use(cors());
app.use(express.json());

// ADD THIS AT THE TOP after require statements
const CONFIG_FILE_PATH = path.join(__dirname, 'config.json');

// ADD THESE FUNCTIONS after app.use() statements
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const configData = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
      return JSON.parse(configData);
    } else {
      const defaultConfig = {
        database: {
          host: process.env.MYSQL_HOST || '192.168.1.52',
          user: process.env.MYSQL_USER || 'adtr',
          password: process.env.MYSQL_PASSWORD || 'adtr',
          database: process.env.MYSQL_DATABASE || 'bless_dtr_test',
          port: parseInt(process.env.MYSQL_PORT || '3306')
        },
        export: {
          path: 'exports'
        }
      };
      saveConfig(defaultConfig);
      return defaultConfig;
    }
  } catch (error) {
    console.error('Error loading config:', error);
    return {
      database: {
        host: '192.168.1.52',
        user: 'adtr',
        password: 'adtr',
        database: 'bless_dtr_test',
        port: 3306
      },
      export: {
        path: 'exports'
      }
    };
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

// REPLACE your existing pool creation with this:
let config = loadConfig();

let pool = mysql.createPool({
  host: config.database.host,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  port: config.database.port,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

function recreatePool(newConfig) {
  if (pool) {
    pool.end().catch(err => console.error('Error closing pool:', err));
  }

  pool = mysql.createPool({
    host: newConfig.database.host,
    user: newConfig.database.user,
    password: newConfig.database.password,
    database: newConfig.database.database,
    port: newConfig.database.port,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  console.log('✅ Database pool recreated with new configuration');
}

// ADD THESE TWO ENDPOINTS anywhere after your existing endpoints (I suggest after biometrics endpoints):

// Get current settings
app.get('/api/settings', async (req, res) => {
  try {
    const currentConfig = loadConfig();
    res.json({
      database: {
        host: currentConfig.database.host,
        database: currentConfig.database.database,
        username: currentConfig.database.user,
        port: currentConfig.database.port
      },
      export: {
        path: currentConfig.export.path
      }
    });
  } catch (error) {
    console.error('Error in /api/settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update settings
app.post('/api/settings', async (req, res) => {
  try {
    const { host, database, username, password, exportPath } = req.body;

    console.log('Updating settings:', { host, database, username, exportPath });

    if (!host || !database || !username) {
      return res.status(400).json({
        error: 'Host, database, and username are required'
      });
    }

    const newConfig = {
      database: {
        host: host,
        user: username,
        password: password || config.database.password,
        database: database,
        port: parseInt(req.body.port) || 3306
      },
      export: {
        path: exportPath || config.export.path
      }
    };

    // Test connection
    try {
      const testPool = mysql.createPool({
        host: newConfig.database.host,
        user: newConfig.database.user,
        password: newConfig.database.password,
        database: newConfig.database.database,
        port: newConfig.database.port,
        waitForConnections: true,
        connectionLimit: 1,
        queueLimit: 0
      });

      const testConn = await testPool.getConnection();
      testConn.release();
      await testPool.end();

      console.log('✅ Test connection successful');
    } catch (testError) {
      console.error('❌ Test connection failed:', testError);
      return res.status(400).json({
        error: 'Failed to connect to database with new settings',
        details: testError.message
      });
    }

    if (saveConfig(newConfig)) {
      config = newConfig;
      recreatePool(newConfig);

      console.log('✅ Settings updated successfully');

      res.json({
        message: 'Settings updated successfully',
        config: {
          database: {
            host: newConfig.database.host,
            database: newConfig.database.database,
            username: newConfig.database.user,
            port: newConfig.database.port
          },
          export: {
            path: newConfig.export.path
          }
        }
      });
    } else {
      throw new Error('Failed to save configuration file');
    }

  } catch (error) {
    console.error('Error in POST /api/settings:', error);
    res.status(500).json({
      error: 'Failed to update settings',
      details: error.message
    });
  }
});


// UPDATE the multer configuration to accept .dat files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const fileExtension = file.originalname.toLowerCase().split('.').pop();

    // UPDATED: Accept .dat files
    if (['txt', 'xlsx', 'dat'].includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .txt, .xlsx, and .dat are supported'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
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

// ========== NEW ENDPOINTS ==========

// Add new department head
app.post('/api/noters', async (req, res) => {
  let connection;
  try {
    const { name, position, office, signatory } = req.body;

    console.log('Adding new department head:', { name, position, office, signatory });

    // Validate required fields
    if (!name || !position || !office || !signatory) {
      return res.status(400).json({
        error: 'All fields are required: name, position, office, signatory'
      });
    }

    connection = await pool.getConnection();

    const query = `
      INSERT INTO noters (name, position, office, signatory)
      VALUES (?, ?, ?, ?)
    `;

    const [result] = await connection.query(query, [name, position, office, signatory]);

    console.log('Department head added successfully with ID:', result.insertId);

    res.json({
      message: 'Department head added successfully',
      noter_id: result.insertId
    });
  } catch (error) {
    console.error('Error in POST /api/noters:', error);
    res.status(500).json({
      error: 'Failed to add department head',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Get positions
app.get('/api/positions', async (req, res) => {
  try {
    // This would typically come from a dedicated positions table or be hardcoded
    const positions = [
      "Department Head",
      "Division Chief",
      "Section Head",
      "Unit Head",
      "Supervisor",
      "Manager",
      "Director"
    ];

    res.json(positions);
  } catch (error) {
    console.error('Error in /api/positions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get offices
app.get('/api/offices', async (req, res) => {
  try {
    // This would typically come from a dedicated offices table or be hardcoded
    const offices = [
      "Mayor's Office",
      "Administration Office",
      "Finance Office",
      "Engineering Office",
      "Health Office",
      "Social Welfare Office",
      "Planning Office",
      "Budget Office"
    ];

    res.json(offices);
  } catch (error) {
    console.error('Error in /api/offices:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== EXISTING ENDPOINTS ==========
// Get employee count statistics
app.get('/api/employees/count', async (req, res) => {
  try {
    const [totalResult] = await pool.query('SELECT COUNT(*) as count FROM employees WHERE registered = 1');
    const total = totalResult[0].count;

    const [regularResult] = await pool.query('SELECT COUNT(*) as count FROM employees WHERE regular = 1');
    const regular = regularResult[0].count;

    const jobOrder = total - regular;

    res.json({ total, regular, jobOrder });
  } catch (error) {
    console.error('Error in /api/employees/count:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update the GET /api/attendance/:date endpoint
app.get('/api/attendance/:date', async (req, res) => {
  try {
    const { date } = req.params;

    const query = `
      SELECT 
        e.id, 
        e.name, 
        e.position,
        e.office, 
        TIME_FORMAT(d.am_in, '%H:%i') as am_in, 
        TIME_FORMAT(d.am_out, '%H:%i') as am_out, 
        TIME_FORMAT(d.pm_in, '%H:%i') as pm_in, 
        TIME_FORMAT(d.pm_out, '%H:%i') as pm_out
      FROM dtrs d
      INNER JOIN employees e ON d.employee_id = e.id
      WHERE d.date = ?
      ORDER BY e.id ASC
    `;

    const [results] = await pool.query(query, [date]);

    // Format the results to show null instead of "00:00"
    const formattedResults = results.map(record => ({
      ...record,
      am_in: formatTimeForDisplay(record.am_in),
      am_out: formatTimeForDisplay(record.am_out),
      pm_in: formatTimeForDisplay(record.pm_in),
      pm_out: formatTimeForDisplay(record.pm_out)
    }));

    res.json(formattedResults);
  } catch (error) {
    console.error('Error in /api/attendance/:date:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all employees
app.get('/api/employees', async (req, res) => {
  try {
    const query = `
      SELECT 
        id as employee_id, name, position, office, 
        registered, noter, regular, signatory,
        TIME_FORMAT(am_in, '%H:%i') as am_in,
        TIME_FORMAT(am_out, '%H:%i') as am_out,
        TIME_FORMAT(pm_in, '%H:%i') as pm_in,
        TIME_FORMAT(pm_out, '%H:%i') as pm_out
      FROM employees
      ORDER BY name
    `;

    const [results] = await pool.query(query);
    res.json(results);
  } catch (error) {
    console.error('Error in /api/employees:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get employee by ID
app.get('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        id as employee_id, 
        name, 
        position, 
        office, 
        registered, 
        noter, 
        regular, 
        signatory,
        TIME_FORMAT(am_in, '%H:%i') as am_in,
        TIME_FORMAT(am_out, '%H:%i') as am_out,
        TIME_FORMAT(pm_in, '%H:%i') as pm_in,
        TIME_FORMAT(pm_out, '%H:%i') as pm_out
      FROM employees
      WHERE id = ?
    `;

    const [results] = await pool.query(query, [id]);

    if (results.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(results[0]);
  } catch (error) {
    console.error('Error in /api/employees/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add new employee
app.post('/api/employees', async (req, res) => {
  try {
    const { id, name, position, office, registered, noter, regular, signatory, am_in, am_out, pm_in, pm_out } = req.body;

    const query = `
      INSERT INTO employees (id, name, position, office, registered, noter, regular, signatory, am_in, am_out, pm_in, pm_out)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await pool.query(query, [id, name, position, office, registered, noter, regular, signatory, am_in, am_out, pm_in, pm_out]);
    res.json({ message: 'Employee added successfully' });
  } catch (error) {
    console.error('Error in POST /api/employees:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update employee
app.put('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, position, office, registered, noter, regular, signatory, am_in, am_out, pm_in, pm_out } = req.body;

    const query = `
      UPDATE employees 
      SET name = ?, position = ?, office = ?, registered = ?, noter = ?, regular = ?, 
          signatory = ?, am_in = ?, am_out = ?, pm_in = ?, pm_out = ?
      WHERE id = ?
    `;

    await pool.query(query, [name, position, office, registered, noter, regular, signatory, am_in, am_out, pm_in, pm_out, id]);
    res.json({ message: 'Employee updated successfully' });
  } catch (error) {
    console.error('Error in PUT /api/employees/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete employee
app.delete('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM employees WHERE id = ?', [id]);
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/employees/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk Edit Schedule (Update multiple employees default schedule)
app.post('/api/employees/bulk-schedule', async (req, res) => {
  try {
    const { employeeIds, schedule } = req.body;

    if (!employeeIds || !employeeIds.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { am_in, am_out, pm_in, pm_out } = schedule;

    // Convert array of IDs to comma-separated string for IN clause, securely parameterized
    if (employeeIds.length > 0) {
      const placeholders = employeeIds.map(() => '?').join(',');
      const updateQuery = `
        UPDATE employees 
        SET am_in = ?, am_out = ?, pm_in = ?, pm_out = ?
        WHERE id IN (${placeholders})
      `;

      const queryParams = [
        am_in || null,
        am_out || null,
        pm_in || null,
        pm_out || null,
        ...employeeIds
      ];

      await pool.query(updateQuery, queryParams);
    }

    res.json({ message: 'Default schedule applied successfully' });
  } catch (error) {
    console.error('Error in POST /api/employees/bulk-schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk Edit Schedule Override (creates schedule exceptions for specific dates)
app.post('/api/employees/bulk-schedule-overrides', async (req, res) => {
  try {
    const { employeeIds, startDate, endDate, schedule, skipWeekends } = req.body;

    if (!employeeIds || !employeeIds.length || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates = [];

    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      const day = dt.getDay();
      if (skipWeekends && (day === 0 || day === 6)) {
        continue;
      }
      dates.push(new Date(dt).toISOString().split('T')[0]);
    }

    if (dates.length === 0) {
      return res.status(400).json({ error: 'No dates selected or all dates skipped' });
    }

    const { am_in, am_out, pm_in, pm_out } = schedule;

    for (const empId of employeeIds) {
      for (const date of dates) {
        const checkQuery = 'SELECT id FROM employee_schedules WHERE employee_id = ? AND date = ?';
        const [existing] = await pool.query(checkQuery, [empId, date]);

        if (existing.length > 0) {
          const updateQuery = `
            UPDATE employee_schedules 
            SET am_in = ?, am_out = ?, pm_in = ?, pm_out = ?
            WHERE employee_id = ? AND date = ?
          `;
          await pool.query(updateQuery, [
            am_in || null, am_out || null, pm_in || null, pm_out || null, empId, date
          ]);
        } else {
          const insertQuery = `
            INSERT INTO employee_schedules (employee_id, date, am_in, am_out, pm_in, pm_out)
            VALUES (?, ?, ?, ?, ?, ?)
          `;
          await pool.query(insertQuery, [
            empId, date, am_in || null, am_out || null, pm_in || null, pm_out || null
          ]);
        }
      }
    }

    res.json({ message: 'Schedule override applied successfully' });
  } catch (error) {
    console.error('Error in POST /api/employees/bulk-schedule-overrides:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Schedule Overrides for a specific employee
app.get('/api/employees/:id/overrides', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT id, date, 
             TIME_FORMAT(am_in, '%H:%i') as am_in, 
             TIME_FORMAT(am_out, '%H:%i') as am_out, 
             TIME_FORMAT(pm_in, '%H:%i') as pm_in, 
             TIME_FORMAT(pm_out, '%H:%i') as pm_out
      FROM employee_schedules 
      WHERE employee_id = ? 
      ORDER BY date DESC
    `;
    const [overrides] = await pool.query(query, [id]);
    res.json(overrides);
  } catch (error) {
    console.error('Error in GET /api/employees/:id/overrides:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a specific schedule override
app.delete('/api/employees/overrides/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM employee_schedules WHERE id = ?', [id]);
    res.json({ message: 'Schedule override deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/employees/overrides/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Grouped Schedule ranges for an employee
app.get('/api/employees/:id/overrides-grouped', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Get default schedule from employee
    const [empRows] = await pool.query('SELECT am_in, am_out, pm_in, pm_out FROM employees WHERE id = ?', [id]);
    if (empRows.length === 0) return res.status(404).json({ error: 'Employee not found' });

    const def = empRows[0];
    const defSchedStr = `${def.am_in}-${def.am_out}-${def.pm_in}-${def.pm_out}`;

    // 2. Get all overrides ordered by date
    const [overrides] = await pool.query(`
      SELECT date, 
             TIME_FORMAT(am_in, '%H:%i:%s') as am_in, 
             TIME_FORMAT(am_out, '%H:%i:%s') as am_out, 
             TIME_FORMAT(pm_in, '%H:%i:%s') as pm_in, 
             TIME_FORMAT(pm_out, '%H:%i:%s') as pm_out
      FROM employee_schedules 
      WHERE employee_id = ? 
      ORDER BY date ASC
    `, [id]);

    const groups = [];
    if (overrides.length > 0) {
      let currentGroup = {
        startDate: overrides[0].date,
        endDate: overrides[0].date,
        am_in: overrides[0].am_in,
        am_out: overrides[0].am_out,
        pm_in: overrides[0].pm_in,
        pm_out: overrides[0].pm_out,
        isDefault: false
      };

      const isSameSchedule = (s1, s2) =>
        s1.am_in === s2.am_in && s1.am_out === s2.am_out &&
        s1.pm_in === s2.pm_in && s1.pm_out === s2.pm_out;

      const isNextDay = (d1, d2) => {
        const date1 = new Date(d1);
        const date2 = new Date(d2);
        const diffInput = Math.abs(date2 - date1);
        const diffDays = Math.ceil(diffInput / (1000 * 60 * 60 * 24));
        return diffDays <= 1;
      };

      for (let i = 1; i < overrides.length; i++) {
        const ov = overrides[i];
        if (isSameSchedule(currentGroup, ov) && isNextDay(currentGroup.endDate, ov.date)) {
          currentGroup.endDate = ov.date;
        } else {
          groups.push(currentGroup);
          currentGroup = {
            startDate: ov.date,
            endDate: ov.date,
            am_in: ov.am_in,
            am_out: ov.am_out,
            pm_in: ov.pm_in,
            pm_out: ov.pm_out,
            isDefault: false
          };
        }
      }
      groups.push(currentGroup);
    }

    res.json(groups);
  } catch (error) {
    console.error('Error in GET /api/employees/:id/overrides-grouped:', error);
    res.status(500).json({ error: error.message });
  }
});


// ========== FIXED NOTERS ENDPOINT ==========
// Get department heads (noters) from ALL THREE TABLES
app.get('/api/noters', async (req, res) => {
  try {
    console.log('🔄 Fetching noters from all three tables...');

    const query = `
      -- Get officials (Mayor, etc.)
      SELECT 
        id as noter_id,
        name,
        position,
        '' as office,  -- officials table has no office field
        signatory,
        'official' as source
      FROM officials
      
      UNION ALL
      
      -- Get department heads from noters table
      SELECT 
        id as noter_id,
        name,
        position,
        office,
        signatory,
        'noter' as source
      FROM noters
      
      UNION ALL
      
      -- Get employees marked as noters
      SELECT 
        id as noter_id,
        name,
        position,
        office,
        signatory,
        'employee' as source
      FROM employees
      WHERE noter = 1
      
      ORDER BY name ASC
    `;

    const [results] = await pool.query(query);
    console.log(`✅ Found ${results.length} noters from all sources`);

    res.json(results);
  } catch (error) {
    console.error('❌ Error in /api/noters:', error);
    res.status(500).json({
      error: 'Failed to fetch department heads',
      details: error.message
    });
  }
});

// Get officials
app.get('/api/officials', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM officials ORDER BY id');
    res.json(results);
  } catch (error) {
    console.error('Error in /api/officials:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get admins
app.get('/api/admins', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT id as admin_id, name, username, level FROM admins ORDER BY id');
    res.json(results);
  } catch (error) {
    console.error('Error in /api/admins:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get biometric devices
app.get('/api/biometrics', async (req, res) => {
  try {
    const query = `
      SELECT 
        id as biometric_id,
        name,
        ip_address,
        port,
        active
      FROM biometrics
      ORDER BY id
    `;

    const [results] = await pool.query(query);
    res.json(results);
  } catch (error) {
    console.error('Error in /api/biometrics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Updated helper function to calculate tardiness for all shifts including PM
function calculateTardiness(record, employeeSchedule, shiftType) {
  if (!record || !employeeSchedule) return null;

  let tardinessMinutes = 0;

  // Helper function to calculate minutes late
  function calculateSingleTardiness(scheduledTime, actualTime, isNightShift = false) {
    if (!scheduledTime || !actualTime || actualTime === '00:00:00' || actualTime === '00:00') {
      return 0;
    }

    const scheduledMinutes = timeToMinutes(scheduledTime);
    const actualMinutes = timeToMinutes(actualTime);

    if (isNightShift) {
      const difference = actualMinutes - scheduledMinutes;

      if (difference <= 0) {
        return 0;
      }

      return difference;

    } else {
      // REGULAR SHIFT (morning/mid)
      const lateness = actualMinutes - scheduledMinutes;

      if (lateness <= 0) {
        return 0;
      }

      return lateness;
    }
  }

  switch (shiftType) {
    case 'morning':
      // MORNING SHIFT: Calculate tardiness for BOTH AM IN and PM IN
      const amTardiness = calculateSingleTardiness(employeeSchedule.am_in, record.am_in, false);
      const pmTardiness = calculateSingleTardiness(employeeSchedule.pm_in, record.pm_in, false);

      // Total tardiness = AM tardiness + PM tardiness
      tardinessMinutes = amTardiness + pmTardiness;
      break;

    case 'night':
      // NIGHT SHIFT: Use AM_IN (22:00) as scheduled time, compare with PM_IN (actual clock-in)
      const nightShiftScheduledTime = employeeSchedule.am_in || "22:00:00";
      tardinessMinutes += calculateSingleTardiness(nightShiftScheduledTime, record.pm_in, true);
      break;

    case 'mid':
      // MID SHIFT: Only check AM IN (since they work straight through)
      tardinessMinutes += calculateSingleTardiness(employeeSchedule.am_in, record.am_in, false);
      break;

    default:
      return null;
  }

  // Return null if no tardiness, otherwise return total minutes
  return tardinessMinutes > 0 ? tardinessMinutes : null;
}

// Helper function to convert time string to minutes
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;

  // Handle both "HH:MM" and "HH:MM:SS" formats
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;

  return hours * 60 + minutes;
}

// Update the GET /api/dtr/:employeeId endpoint to include tardiness
app.get('/api/dtr/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;

    const connection = await pool.getConnection();

    try {
      // Get employee schedule first
      const [employeeRows] = await connection.query(`
        SELECT 
          am_in, am_out, pm_in, pm_out
        FROM employees 
        WHERE id = ?
      `, [employeeId]);

      if (employeeRows.length === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      const employeeSchedule = employeeRows[0];
      const defaultShiftType = detectShiftTypeFromSchedule(employeeSchedule);

      // Get Schedule Overrides for the selected date range
      const [overrideRows] = await connection.query(`
        SELECT 
          date, 
          TIME_FORMAT(am_in, '%H:%i:%s') as am_in, 
          TIME_FORMAT(am_out, '%H:%i:%s') as am_out, 
          TIME_FORMAT(pm_in, '%H:%i:%s') as pm_in, 
          TIME_FORMAT(pm_out, '%H:%i:%s') as pm_out
        FROM employee_schedules
        WHERE employee_id = ? AND date BETWEEN ? AND ?
      `, [employeeId, startDate, endDate]);

      const overridesByDate = {};
      for (const override of overrideRows) {
        // Force exact string date format without timezone shift issues
        const dt = new Date(override.date);
        const dateStr = [
          dt.getFullYear(),
          String(dt.getMonth() + 1).padStart(2, '0'),
          String(dt.getDate()).padStart(2, '0')
        ].join('-');
        overridesByDate[dateStr] = override;
      }

      // Get DTR records
      const query = `
        SELECT 
          id,
          employee_id,
          date,
          TIME_FORMAT(am_in, '%H:%i') as am_in,
          TIME_FORMAT(am_out, '%H:%i') as am_out,
          TIME_FORMAT(pm_in, '%H:%i') as pm_in,
          TIME_FORMAT(pm_out, '%H:%i') as pm_out,
          locked
        FROM dtrs 
        WHERE employee_id = ? 
          AND date BETWEEN ? AND ?
        ORDER BY date DESC
      `;

      const [results] = await connection.query(query, [employeeId, startDate, endDate]);

      // Calculate tardiness for each record using default schedule or override
      const formattedResults = results.map(record => {
        const dt = new Date(record.date);
        const recordDateStr = [
          dt.getFullYear(),
          String(dt.getMonth() + 1).padStart(2, '0'),
          String(dt.getDate()).padStart(2, '0')
        ].join('-');

        const activeSchedule = overridesByDate[recordDateStr] || employeeSchedule;
        const activeShiftType = overridesByDate[recordDateStr] ? detectShiftTypeFromSchedule(activeSchedule) : defaultShiftType;

        const tardinessMinutes = calculateTardiness(record, activeSchedule, activeShiftType);

        return {
          ...record,
          am_in: formatTimeForDisplay(record.am_in),
          am_out: formatTimeForDisplay(record.am_out),
          pm_in: formatTimeForDisplay(record.pm_in),
          pm_out: formatTimeForDisplay(record.pm_out),
          tardiness: tardinessMinutes,
          is_override: !!overridesByDate[recordDateStr]
        };
      });

      res.json(formattedResults);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error in /api/dtr/:employeeId:', error);
    res.status(500).json({ error: error.message });
  }
});

// Improved helper function to detect shift type from schedule
function detectShiftTypeFromSchedule(schedule) {
  if (!schedule || (!schedule.am_in && !schedule.pm_in)) return 'morning';

  // Check AM_IN hour for night shift detection
  if (schedule.am_in) {
    const amInHour = parseInt(schedule.am_in.split(':')[0]);
    // Night shift: starts around 10PM (22:00)
    if (amInHour >= 20 && amInHour <= 23) {
      return 'night';
    }
  }

  // If employee has PM_IN scheduled but no AM_IN, check PM_IN
  if (schedule.pm_in && (!schedule.am_in || schedule.am_in === '00:00:00')) {
    const pmInHour = parseInt(schedule.pm_in.split(':')[0]);
    // Night shift can also start in early morning hours
    if (pmInHour >= 20 || pmInHour <= 2) {
      return 'night';
    }
  }

  // Mid shift: starts around 6AM-8AM, works straight through (no lunch break)
  if (schedule.am_in && (!schedule.pm_in || schedule.pm_in === '00:00:00')) {
    const amInHour = parseInt(schedule.am_in.split(':')[0]);
    if (amInHour >= 5 && amInHour <= 8) {
      return 'mid';
    }
  }

  // Morning shift: has both AM and PM schedules (with lunch break)
  if (schedule.am_in && schedule.pm_in && schedule.pm_in !== '00:00:00') {
    return 'morning';
  }

  // Default to morning shift
  return 'morning';
}


// Update DTR record
app.put('/api/dtr/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, am_in, am_out, pm_in, pm_out, locked } = req.body;

    // Convert empty strings to NULL for time fields
    const amInValue = am_in === '' ? null : am_in;
    const amOutValue = am_out === '' ? null : am_out;
    const pmInValue = pm_in === '' ? null : pm_in;
    const pmOutValue = pm_out === '' ? null : pm_out;

    const query = `
      UPDATE dtrs 
      SET date = ?, am_in = ?, am_out = ?, pm_in = ?, pm_out = ?, locked = ?
      WHERE id = ?
    `;

    await pool.query(query, [date, amInValue, amOutValue, pmInValue, pmOutValue, locked ? 1 : 0, id]);
    res.json({ message: 'DTR record updated successfully' });
  } catch (error) {
    console.error('Error in PUT /api/dtr/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== EXPORT DTR ENDPOINT ==========
app.post('/api/export-dtr', async (req, res) => {
  try {
    const {
      employee_id,
      noterSignatory,        // Accept camelCase from frontend
      noter_signatory,       // Also accept snake_case for compatibility
      noterPosition,         // Accept camelCase from frontend
      noter_position,        // Also accept snake_case for compatibility
      first_month,
      first_year,
      first_cut,
      second_month,
      second_year,
      second_cut,
      export_to,
      preview,
      print,
      printer_name
    } = req.body;

    // Use either naming convention - prioritize camelCase from frontend
    const finalNoterSignatory = noterSignatory || noter_signatory;
    const finalNoterPosition = noterPosition || noter_position;

    console.log('Export DTR request:', {
      employee_id,
      noterSignatory: finalNoterSignatory,
      noterPosition: finalNoterPosition,
      first_month,
      first_year,
      first_cut,
      second_month,
      second_year,
      second_cut,
      export_to,
      preview,
      print,
      printer_name
    });

    // Validate required fields
    if (!employee_id || !finalNoterSignatory || !finalNoterPosition || !first_month || !first_year) {
      return res.status(400).json({
        message: 'Missing required fields: employee_id, noter_signatory, noter_position, first_month, first_year'
      });
    }

    // Prepare arguments for the Python script
    const args = [
      'export_dtr.py',
      employee_id.toString(),
      `${finalNoterSignatory}`,
      `${finalNoterPosition}`,
      first_month.toString(),
      first_year.toString(),
      first_cut || 'full',
      (second_month || 0).toString(),
      (second_year || 0).toString(),
      second_cut || 'full',
      export_to || 'excel',
      preview ? 'true' : 'false',
      print ? 'true' : 'false',
      printer_name ? `"${printer_name}"` : '""'
    ];

    console.log('Calling Python export script with args:', args);

    const pythonProcess = spawn('python', args);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log('Python stdout:', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('Python stderr:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python script failed with code:', code);
        return res.status(500).json({
          message: 'Export failed',
          error: errorOutput || 'Unknown error occurred during export'
        });
      }

      if (output.includes('ERROR:')) {
        const errorMatch = output.match(/ERROR: (.*)/);
        return res.status(500).json({
          message: 'Export failed',
          error: errorMatch ? errorMatch[1] : 'Unknown error'
        });
      }

      // Success response
      res.json({
        message: 'DTR exported successfully',
        employee_id: employee_id,
        export_format: export_to || 'excel',
        first_period: {
          month: first_month,
          year: first_year,
          cut: first_cut || 'full'
        },
        second_period: second_month ? {
          month: second_month,
          year: second_year,
          cut: second_cut || 'full'
        } : null,
        preview: preview || false,
        printed: print || false
      });
    });

  } catch (error) {
    console.error('Error in /api/export-dtr:', error);
    res.status(500).json({
      message: 'Export failed',
      error: error.message
    });
  }
});

// ========== PRINT DTR ENDPOINT ==========
app.post('/api/dtr/generate-print-pdf', async (req, res) => {
  console.log('=== VIEW DTR BACKEND DEBUG ===');
  console.log('Single PDF generation request received:', req.body);
  try {
    const {
      employee_id,
      noterSignatory,        // Accept camelCase from frontend
      noter_signatory,       // Also accept snake_case for compatibility
      noterPosition,         // Accept camelCase from frontend
      noter_position,        // Also accept snake_case for compatibility
      first_month,
      first_year,
      first_cut,
      second_month,
      second_year,
      second_cut
    } = req.body;

    // Use either naming convention - prioritize camelCase from frontend
    const finalNoterSignatory = noterSignatory || noter_signatory;
    const finalNoterPosition = noterPosition || noter_position;

    console.log('Generate Print PDF request:', {
      employee_id,
      noterSignatory: finalNoterSignatory,
      noterPosition: finalNoterPosition,
      first_month,
      first_year,
      first_cut,
      second_month,
      second_year,
      second_cut
    });

    // Validate required fields
    if (!employee_id || !finalNoterSignatory || !finalNoterPosition || !first_month || !first_year) {
      return res.status(400).json({
        message: 'Missing required fields for printing'
      });
    }

    // Clean up old preview files before generating new one
    try {
      const previewsDir = path.join(__dirname, 'exports', 'previews');
      if (fs.existsSync(previewsDir)) {
        const files = fs.readdirSync(previewsDir);
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000); // 1 hour ago

        files.forEach(file => {
          if (file.endsWith('.pdf')) {
            const filePath = path.join(previewsDir, file);
            const stats = fs.statSync(filePath);
            if (stats.mtime.getTime() < oneHourAgo) {
              fs.unlinkSync(filePath);
              console.log('🧹 Cleaned up old PDF file:', file);
            }
          }
        });
      }
    } catch (cleanupError) {
      console.log('Note: Could not clean up old files, continuing...');
    }

    // Prepare arguments for Python script (PDF format, preview=true, print=false)
    const args = [
      'export_dtr.py',
      employee_id.toString(),
      `${finalNoterSignatory}`,
      `${finalNoterPosition}`,
      first_month.toString(),
      first_year.toString(),
      first_cut || 'full',
      (second_month || 0).toString(),
      (second_year || 0).toString(),
      second_cut || 'full',
      'pdf', // PDF format for printing
      'true', // preview mode (generates in previews folder)
      'false', // don't print on server
      '""' // no printer
    ];

    console.log('Calling Python script for PDF generation with args:', args);

    const pythonProcess = spawn('python', args);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log('Python stdout:', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('Python stderr:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python script failed with code:', code);
        return res.status(500).json({
          message: 'Failed to generate PDF for printing',
          error: errorOutput || 'Unknown error occurred during PDF generation'
        });
      }

      if (output.includes('ERROR:')) {
        const errorMatch = output.match(/ERROR: (.*)/);
        return res.status(500).json({
          message: 'Failed to generate PDF for printing',
          error: errorMatch ? errorMatch[1] : 'Unknown error'
        });
      }

      // Extract PDF filename from output
      const filenameMatch = output.match(/exports[\\\/]previews[\\\/]([^\\\/\n]+\.pdf)/) ||
        output.match(/previews[\\\/]([^\\\/\n]+\.pdf)/);

      if (filenameMatch) {
        const filename = filenameMatch[1];
        console.log('PDF generated for printing:', filename);

        res.json({
          success: true,
          filename: filename,
          downloadUrl: `/api/dtr/pdf-preview/${filename}`
        });
      } else {
        console.error('Could not extract PDF filename from Python output. Full output:', output);
        res.status(500).json({
          message: 'Failed to generate PDF for printing - file not found in output',
          output: output
        });
      }
    });

  } catch (error) {
    console.error('Error in /api/dtr/generate-print-pdf:', error);
    res.status(500).json({
      message: 'PDF generation failed',
      error: error.message
    });
  }
});
// Add a cleanup endpoint that can be called periodically
app.post('/api/cleanup-preview-files', (req, res) => {
  try {
    const previewsDir = path.join(__dirname, 'exports', 'previews');
    let deletedCount = 0;

    if (fs.existsSync(previewsDir)) {
      const files = fs.readdirSync(previewsDir);
      const now = Date.now();
      const maxAge = 30 * 60 * 1000; // 30 minutes max age

      files.forEach(file => {
        const filePath = path.join(previewsDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtime.getTime() > maxAge) {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log('🧹 Cleaned up old preview file:', file);
          }
        } catch (err) {
          console.error('Error cleaning up file:', file, err);
        }
      });
    }

    res.json({
      message: `Cleanup completed. Deleted ${deletedCount} old files.`,
      deletedCount: deletedCount
    });

  } catch (error) {
    console.error('Error in cleanup:', error);
    res.status(500).json({
      message: 'Cleanup failed',
      error: error.message
    });
  }
});

app.get('/api/dtr/pdf-preview/:filename', (req, res) => {
  try {
    const { filename } = req.params;

    // Use the export path from config (same as Python uses)
    const currentConfig = loadConfig();
    const exportPath = currentConfig.export?.path || 'exports';

    // Check if exportPath is absolute or relative
    let filePath;
    let previewsDir;

    if (path.isAbsolute(exportPath)) {
      // Absolute path like "C:\Users\admin\Documents\DTR EXPORTS PATH"
      previewsDir = path.join(exportPath, 'previews');
      filePath = path.join(previewsDir, filename);
    } else {
      // Relative path like "exports"
      previewsDir = path.join(__dirname, exportPath, 'previews');
      filePath = path.join(previewsDir, filename);
    }

    // Ensure .pdf extension is added if not present
    if (!filePath.endsWith('.pdf')) {
      filePath = filePath + '.pdf';
    }

    console.log('🔍 Looking for PDF at:', filePath);
    console.log('📁 Export path from config:', exportPath);
    console.log('📄 Filename:', filename);
    console.log('📂 Previews directory:', previewsDir);

    if (!fs.existsSync(filePath)) {
      console.error('❌ PDF file not found at:', filePath);

      // Also check what files ARE in the previews folder
      if (fs.existsSync(previewsDir)) {
        const files = fs.readdirSync(previewsDir);
        console.log('📂 Files in previews folder:', files);
      } else {
        console.error('❌ Previews folder does not exist:', previewsDir);
        console.error('   Creating previews folder...');
        try {
          fs.mkdirSync(previewsDir, { recursive: true });
          console.log('✓ Previews folder created');
        } catch (err) {
          console.error('   Failed to create previews folder:', err.message);
        }
      }

      return res.status(404).json({ message: 'PDF file not found', path: filePath });
    }

    console.log('✅ PDF file found, sending to browser...');

    // Set headers for PDF file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    // Read the file and send it
    const fileStream = fs.createReadStream(filePath);

    fileStream.on('error', (err) => {
      console.error('Error reading PDF file:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to read PDF file' });
      }
    });

    fileStream.on('end', () => {
      console.log('✅ PDF file sent to browser successfully');

      // Delete the file 60 seconds after sending
      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) {
              console.error('Error deleting PDF file:', unlinkErr);
            } else {
              console.log('🗑️ PDF file auto-deleted:', filename);
            }
          });
        }
      }, 5000); // 60 seconds
    });

    fileStream.pipe(res);

  } catch (error) {
    console.error('Error serving PDF file:', error);
    res.status(500).json({ message: 'Failed to serve PDF file' });
  }
});

// ========== EXCEL PREVIEW ENDPOINTS ==========
app.get('/api/dtr/excel-preview/:filename', (req, res) => {
  try {
    const { filename } = req.params;

    const currentConfig = loadConfig();
    const exportPath = currentConfig.export?.path || 'exports';

    // Check if exportPath is absolute or relative
    let filePath;
    if (path.isAbsolute(exportPath)) {
      filePath = path.join(exportPath, 'previews', filename);
    } else {
      filePath = path.join(__dirname, exportPath, 'previews', filename);
    }

    console.log('🔍 Looking for Excel at:', filePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Preview file not found' });
    }

    // Set headers for Excel file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    // Send the file (Excel files are kept, not deleted)
    res.sendFile(filePath);

  } catch (error) {
    console.error('Error serving Excel file:', error);
    res.status(500).json({ message: 'Failed to serve Excel file' });
  }
});

// ========== GENERATE EXCEL PREVIEW ENDPOINT ==========
app.post('/api/dtr/generate-excel-preview', async (req, res) => {
  try {
    const {
      employee_id,
      noter_signatory,
      noter_position,
      first_month,
      first_year,
      first_cut,
      second_month,
      second_year,
      second_cut
    } = req.body;

    console.log('Generating Excel preview for employee:', employee_id);

    // Validate required fields
    if (!employee_id || !noter_signatory || !noter_position || !first_month || !first_year) {
      return res.status(400).json({
        message: 'Missing required fields for preview'
      });
    }

    // Prepare arguments for the Python script (preview mode)
    const args = [
      'export_dtr.py',
      employee_id.toString(),
      `${noter_signatory}`,
      `${noter_position}`,
      first_month.toString(),
      first_year.toString(),
      first_cut || 'full',
      (second_month || 0).toString(),
      (second_year || 0).toString(),
      second_cut || 'full',
      'excel', // Always generate Excel for preview
      'true',  // preview mode
      'false', // don't print
      '""'     // no printer
    ];

    console.log('Calling Python script for Excel preview with args:', args);

    const pythonProcess = spawn('python', args);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log('Python stdout:', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('Python stderr:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python script failed with code:', code);
        return res.status(500).json({
          message: 'Failed to generate Excel preview',
          error: errorOutput || 'Unknown error occurred'
        });
      }

      // Check if there's an ERROR in the output
      if (output.includes('ERROR:')) {
        const errorMatch = output.match(/ERROR: (.*)/);
        return res.status(500).json({
          message: 'Failed to generate Excel preview',
          error: errorMatch ? errorMatch[1] : 'Unknown error in Python script'
        });
      }

      // Extract filename from Python output - look for the file path
      const filenameMatch = output.match(/exports[\\\/]previews[\\\/]([^\\\/\n]+\.xlsx)/) ||
        output.match(/previews[\\\/]([^\\\/\n]+\.xlsx)/);

      if (filenameMatch) {
        const filename = filenameMatch[1];
        console.log('Excel preview generated:', filename);

        res.json({
          success: true,
          filename: filename,
          downloadUrl: `/api/dtr/excel-preview/${filename}`
        });
      } else {
        console.error('Could not extract filename from Python output. Full output:', output);
        res.status(500).json({
          message: 'Failed to generate Excel preview - file not found in output',
          output: output
        });
      }
    });

  } catch (error) {
    console.error('Error in /api/dtr/generate-excel-preview:', error);
    res.status(500).json({
      message: 'Excel preview generation failed',
      error: error.message
    });
  }
});

// Update the DTR Preview endpoint
app.post('/api/dtr/preview', async (req, res) => {
  let connection;
  try {
    const {
      employee_id,
      noter_signatory,
      noter_position,
      first_month,
      first_year,
      first_cut = 'full',
      second_month = 0,
      second_year = 0,
      second_cut = 'full'
    } = req.body;

    console.log('DTR Preview request:', {
      employee_id,
      noter_signatory,
      noter_position,
      first_month,
      first_year,
      first_cut,
      second_month,
      second_year,
      second_cut
    });

    if (!employee_id || !noter_signatory || !noter_position || !first_month || !first_year) {
      return res.status(400).json({
        message: 'Missing required fields for preview'
      });
    }

    connection = await pool.getConnection();

    const [employeeRows] = await connection.query(`
      SELECT id, name, position, office, signatory, am_in, pm_out 
      FROM employees 
      WHERE id = ?
    `, [employee_id]);

    if (employeeRows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const employee = employeeRows[0];

    let firstPeriodQuery = `
      SELECT date, am_in, am_out, pm_in, pm_out 
      FROM dtrs 
      WHERE employee_id = ? AND YEAR(date) = ? AND MONTH(date) = ?
    `;

    const firstPeriodParams = [employee_id, first_year, first_month];

    if (first_cut === 'first') {
      firstPeriodQuery += ' AND DAY(date) < 16';
    } else if (first_cut === 'last') {
      firstPeriodQuery += ' AND DAY(date) >= 16';
    }

    firstPeriodQuery += ' ORDER BY date';

    const [firstPeriodRecords] = await connection.query(firstPeriodQuery, firstPeriodParams);

    let secondPeriodRecords = [];
    if (second_month && second_year && second_month !== 0 && second_year !== 0) {
      let secondPeriodQuery = `
        SELECT date, am_in, am_out, pm_in, pm_out 
        FROM dtrs 
        WHERE employee_id = ? AND YEAR(date) = ? AND MONTH(date) = ?
      `;

      const secondPeriodParams = [employee_id, second_year, second_month];

      if (second_cut === 'first') {
        secondPeriodQuery += ' AND DAY(date) < 16';
      } else if (second_cut === 'last') {
        secondPeriodQuery += ' AND DAY(date) >= 16';
      }

      secondPeriodQuery += ' ORDER BY date';
      const [secondRows] = await connection.query(secondPeriodQuery, secondPeriodParams);
      secondPeriodRecords = secondRows;
    }

    const previewData = {
      employee: {
        id: employee.id,
        name: employee.name,
        position: employee.position,
        office: employee.office,
        signatory: employee.signatory
      },
      noter_signatory,
      noter_position,
      first_period: {
        month: first_month,
        year: first_year,
        cut: first_cut,
        records: firstPeriodRecords.map(record => ({
          date: record.date.toISOString().split('T')[0],
          am_in: formatTimeForDisplay(record.am_in),
          am_out: formatTimeForDisplay(record.am_out),
          pm_in: formatTimeForDisplay(record.pm_in),
          pm_out: formatTimeForDisplay(record.pm_out)
        }))
      },
      second_period: second_month && second_year && second_month !== 0 && second_year !== 0 ? {
        month: second_month,
        year: second_year,
        cut: second_cut,
        records: secondPeriodRecords.map(record => ({
          date: record.date.toISOString().split('T')[0],
          am_in: formatTimeForDisplay(record.am_in),
          am_out: formatTimeForDisplay(record.am_out),
          pm_in: formatTimeForDisplay(record.pm_in),
          pm_out: formatTimeForDisplay(record.pm_out)
        }))
      } : null
    };

    res.json(previewData);

  } catch (error) {
    console.error('Error in /api/dtr/preview:', error);
    res.status(500).json({
      message: 'Preview failed',
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Add this helper function at the top of index.js after the imports
function formatTimeForDisplay(time) {
  if (!time) return null;

  // Check if it's a "00:00:00" or "00:00" (which means blank)
  if (time === '00:00:00' || time === '00:00') return null;

  if (typeof time === 'string') {
    // Remove seconds if present (HH:MM:SS -> HH:MM)
    const parts = time.split(':');
    if (parts.length === 3) {
      return `${parts[0]}:${parts[1]}`;
    }
    return time;
  }

  const timeStr = time.toString();
  if (timeStr.includes(':')) {
    const parts = timeStr.split(':');
    if (parts.length === 3) {
      return `${parts[0]}:${parts[1]}`;
    }
    return timeStr;
  }

  return timeStr;
}

// ========== IMPORT AND REFRESH ENDPOINTS ==========

// Helper function to call Python biometric script
async function fetchBiometricAttendance(biometricId, startDate, endDate) {
  return new Promise((resolve, reject) => {
    console.log(`Calling Python script for biometric ${biometricId}`);

    const pythonProcess = spawn('python', [
      'fetch_biometric.py',
      biometricId.toString(),
      startDate || '',
      endDate || ''
    ]);

    let dataString = '';
    let errorString = '';

    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString();
      console.error('Python stderr:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed: ${errorString}`));
        return;
      }

      try {
        const attendances = JSON.parse(dataString);
        console.log(`Python returned ${attendances.length} attendance records`);
        resolve(attendances);
      } catch (error) {
        reject(new Error(`Failed to parse Python output: ${dataString}`));
      }
    });
  });
}

// Fixed biometric import endpoint - handles timezone properly
// Replace the biometric import endpoint in index.js

// Helper function to parse timestamp string directly (NO Date object conversion)
function parseTimestampDirect(timestampStr) {
  // timestampStr format: "2025-10-23 21:52:32"
  // Return as-is for MySQL (no timezone conversion)
  return timestampStr;
}

// Helper function for date range checking (string comparison only)
function isTimestampInRange(timestampStr, startDate, endDate) {
  // Handle invalid input
  if (!timestampStr || typeof timestampStr !== 'string') {
    return false;
  }

  const dateStr = timestampStr.split(' ')[0];

  if (startDate && endDate) {
    return dateStr >= startDate && dateStr <= endDate;
  } else if (startDate && !endDate) {
    return dateStr >= startDate;
  } else if (!startDate && endDate) {
    return dateStr <= endDate;
  }
  return true;
}

function parseTimestampToMinute(timestampStr) {
  // timestampStr format: "2025-10-23 21:52:32"
  // Returns: "2025-10-23 21:52:00" (seconds set to 00)
  const parts = timestampStr.split(':');
  if (parts.length === 3) {
    // Replace seconds with "00"
    return `${parts[0]}:${parts[1]}:00`;
  }
  return timestampStr;
}


// Biometric import endpoint - FULLY FIXED VERSION
app.post('/import-dtr', async (req, res) => {
  let connection;
  try {
    const { source, biometric_id, start_date, end_date } = req.body;

    console.log('Import DTR biometric request:', { source, biometric_id, start_date, end_date });

    if (!source || source.toLowerCase() !== 'biometric') {
      return res.status(400).json({ message: 'Invalid source. Use /import-dtr-file for file uploads' });
    }

    if (!biometric_id) {
      return res.status(400).json({ message: 'Biometric ID is required' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Get biometric device info
    const [biometricRows] = await connection.query(
      'SELECT * FROM biometrics WHERE id = ?',
      [biometric_id]
    );

    if (biometricRows.length === 0) {
      throw new Error('Biometric device not found');
    }

    const biometric = biometricRows[0];
    const origin = biometric.ip_address;

    console.log(`Fetching attendance from biometric device: ${origin}`);

    // Call Python script to get attendance
    let attendances;
    try {
      attendances = await fetchBiometricAttendance(biometric_id, start_date, end_date);
    } catch (error) {
      console.error('Python script error:', error);
      throw new Error(`Failed to fetch biometric data: ${error.message}`);
    }

    const dtrs = [];

    // FIXED: Process each attendance record - now matches Python behavior
    for (const attendance of attendances) {
      const employeeId = attendance.user_id;
      const timestampStr = attendance.timestamp; // "2025-10-23 21:52:32"

      if (!employeeId || !timestampStr) {
        console.warn('Skipping invalid record:', attendance);
        continue;
      }

      // FIXED: Check date range using date-only comparison (matches Python)
      if (!isTimestampInRange(timestampStr, start_date, end_date)) {
        continue;
      }

      // FIXED: Truncate to minute level (removes seconds) - matches Python's deduplication
      const created_at = parseTimestampToMinute(timestampStr);

      console.log(`Processing: Employee ${employeeId} at ${created_at}`);

      dtrs.push({
        employee_id: employeeId.toString(),
        created_at: created_at
      });
    }

    // FIXED: Remove duplicates (now at minute level like Python)
    const uniqueDtrs = Array.from(new Set(dtrs.map(d => JSON.stringify(d)))).map(d => JSON.parse(d));

    // FIXED: Sort by datetime before inserting (matches Python)
    uniqueDtrs.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateA - dateB;
    });

    console.log(`Importing ${uniqueDtrs.length} unique DTR records from biometric (sorted chronologically)`);

    if (uniqueDtrs.length === 0) {
      throw new Error('No attendance records found in the specified date range');
    }

    // Insert into imports table in sorted order
    for (const dtr of uniqueDtrs) {
      try {
        await connection.query(
          'INSERT INTO imports (employee_id, created_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE created_at = created_at',
          [dtr.employee_id, dtr.created_at]
        );
      } catch (insertError) {
        // Skip if duplicate key error (already exists)
        if (insertError.code !== 'ER_DUP_ENTRY') {
          throw insertError;
        }
      }
    }

    // Add log entry
    await connection.query(
      'INSERT INTO logs (admin_id, action, category, original, updated) VALUES (?, ?, ?, ?, ?)',
      [1, 'import', 'import', '', `import(source = biometric, origin = ${origin})`]
    );

    await connection.commit();

    res.json({
      message: 'DTR imported successfully from biometric device',
      source: 'biometric',
      origin,
      records_imported: uniqueDtrs.length,
      start_date: start_date,
      end_date: end_date,
      note: 'Records deduplicated at minute level and sorted chronologically'
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error in POST /import-dtr:', error);
    res.status(500).json({ message: error.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Helper function for file processing
async function processDTRRecord(employee_id, datetime, start, end, dtrs) {
  const recordDate = datetime.toISOString().split('T')[0];
  const created_at = datetime.toISOString().slice(0, 19).replace('T', ' ');

  if (start && end) {
    if (recordDate < start || recordDate > end) return;
  } else if (start && !end) {
    if (recordDate < start) return;
  } else if (!start && end) {
    if (recordDate > end) return;
  }

  dtrs.push({
    employee_id: employee_id.toString(),
    created_at: created_at
  });
}

// Fixed file import endpoint - handles timezone properly
// Add this helper function at the top of index.js

function formatDateTimeForMySQL(dateStr, timeStr) {
  // Parse date: MM/DD/YYYY
  const [month, day, year] = dateStr.split('/');

  // Parse time: HH:MM:SS
  const [hours, minutes, seconds] = timeStr.split(':');

  // Format directly as MySQL datetime WITHOUT timezone conversion
  const mysqlDateTime = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;

  return mysqlDateTime;
}

// Helper function for date range checking (without Date object timezone issues)
function isDateInRange(dateStr, startDate, endDate) {
  if (!dateStr) return false;

  let isoDate;

  // Check if date is in MM/DD/YYYY format
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return false;
    const [month, day, year] = parts;
    if (!month || !day || !year) return false;
    isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Check if date is already in YYYY-MM-DD format
  else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    isoDate = dateStr;
  }
  // Invalid format
  else {
    return false;
  }

  if (startDate && endDate) {
    return isoDate >= startDate && isoDate <= endDate;
  } else if (startDate && !endDate) {
    return isoDate >= startDate;
  } else if (!startDate && endDate) {
    return isoDate <= endDate;
  }
  return true;
}

app.post('/import-dtr-file', upload.single('file'), async (req, res) => {
  let connection;
  try {
    const { start_date, end_date } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'File is required' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const dtrs = [];
    const origin = file.originalname;
    const fileExtension = file.originalname.toLowerCase().split('.').pop();

    console.log(`Processing ${fileExtension} file: ${file.originalname}`);

    // ADD .dat file processing
    if (fileExtension === 'dat') {
      console.log('📄 Processing .dat file...');

      try {
        const datRecords = await convertDatFile(file.path);

        for (const record of datRecords) {
          // Extract date from created_at for range checking (already in YYYY-MM-DD format)
          const recordDate = record.created_at.split(' ')[0]; // YYYY-MM-DD format

          // Check date range - recordDate is already in YYYY-MM-DD format
          if (start_date && end_date) {
            if (recordDate < start_date || recordDate > end_date) {
              continue;
            }
          } else if (start_date && !end_date) {
            if (recordDate < start_date) {
              continue;
            }
          } else if (!start_date && end_date) {
            if (recordDate > end_date) {
              continue;
            }
          }

          dtrs.push({
            employee_id: record.employee_id.toString(),
            created_at: record.created_at
          });
        }

        console.log(`✅ Processed ${dtrs.length} records from .dat file (after date filtering)`);
      } catch (datError) {
        throw new Error(`Failed to process .dat file: ${datError.message}`);
      }
    }
    // Parse TXT file (existing code)
    else if (fileExtension === 'txt') {
      const content = fs.readFileSync(file.path, 'utf8');
      const rows = content.split('\n');

      if (rows.length === 0) {
        throw new Error('File is empty');
      }

      rows.shift(); // Remove header

      for (const row of rows) {
        if (!row.trim()) continue;

        const parts = row.trim().split(/\s+/);
        if (parts.length < 7) continue;

        const employee_id = parts[2];
        const date = parts[5]; // MM/DD/YYYY
        const time = parts[6]; // HH:MM:SS

        try {
          if (!isDateInRange(date, start_date, end_date)) {
            continue;
          }

          const created_at = formatDateTimeForMySQL(date, time);

          dtrs.push({
            employee_id: employee_id.toString(),
            created_at: created_at
          });

        } catch (parseError) {
          console.warn(`Error parsing row:`, parseError);
          continue;
        }
      }
    }
    // Parse XLSX file (existing code)
    else if (fileExtension === 'xlsx') {
      const workbook = XLSX.readFile(file.path);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 4) continue;
        if (i === 0 && isNaN(row[1])) continue;

        const employee_id = row[1]?.toString();
        const excelDate = row[0];
        const time = row[3];

        if (!employee_id || !excelDate || !time) continue;

        try {
          let created_at;

          if (typeof excelDate === 'number') {
            const jsDate = new Date((excelDate - 25569) * 86400 * 1000);
            const year = jsDate.getUTCFullYear();
            const month = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
            const day = String(jsDate.getUTCDate()).padStart(2, '0');

            const [hours, minutes, seconds] = time.split(':').map(Number);

            created_at = `${year}-${month}-${day} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds || 0).padStart(2, '0')}`;

            const dateStr = `${year}-${month}-${day}`;
            if (start_date && end_date && !(dateStr >= start_date && dateStr <= end_date)) continue;
            if (start_date && !end_date && !(dateStr >= start_date)) continue;
            if (!start_date && end_date && !(dateStr <= end_date)) continue;
          } else {
            const [datePart, timePart] = excelDate.split(' ');
            created_at = `${datePart} ${time}`;

            if (start_date && end_date && !(datePart >= start_date && datePart <= end_date)) continue;
            if (start_date && !end_date && !(datePart >= start_date)) continue;
            if (!start_date && end_date && !(datePart <= end_date)) continue;
          }

          dtrs.push({
            employee_id: employee_id.toString(),
            created_at: created_at
          });

        } catch (parseError) {
          console.warn(`Error parsing Excel row:`, parseError);
          continue;
        }
      }
    } else {
      throw new Error('File type not supported. Only .txt, .xlsx, and .dat are supported.');
    }

    // Clean up uploaded file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    const uniqueDtrs = Array.from(new Set(dtrs.map(d => JSON.stringify(d)))).map(d => JSON.parse(d));

    console.log(`Importing ${uniqueDtrs.length} unique DTR records from file`);

    if (uniqueDtrs.length === 0) {
      throw new Error('No valid DTR records found in file');
    }

    // Insert into imports table
    for (const dtr of uniqueDtrs) {
      await connection.query(
        'INSERT INTO imports (employee_id, created_at) VALUES (?, ?)',
        [dtr.employee_id, dtr.created_at]
      );
    }

    // Add log entry
    await connection.query(
      'INSERT INTO logs (admin_id, action, category, original, updated) VALUES (?, ?, ?, ?, ?)',
      [1, 'import', 'import', '', `import(source = file, origin = ${origin})`]
    );

    await connection.commit();

    res.json({
      message: 'DTR imported successfully',
      source: 'file',
      file_type: fileExtension,
      origin,
      records_imported: uniqueDtrs.length,
      start_date: start_date,
      end_date: end_date
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error in POST /import-dtr-file:', error);
    res.status(500).json({ message: error.message });
  } finally {
    if (connection) {
      connection.release();
    }
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

// Refresh DTR using Python (all employees)
app.post('/refresh-dtr', async (req, res) => {
  try {
    console.log('Starting DTR refresh via Python (direct)...');

    const pythonProcess = spawn('python', ['refresh_dtr_direct.py']);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log('Python stdout:', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('Python stderr:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code: ${code}`);

      if (code !== 0) {
        console.error('Python script failed with code:', code);
        console.error('Python stderr output:', errorOutput);
        return res.status(500).json({
          message: 'Failed to refresh DTR',
          error: errorOutput || `Python script exited with code ${code}`,
          output: output
        });
      }

      try {
        // Try to parse the last line as JSON (in case there are print statements)
        const lines = output.split('\n');
        let jsonLine = '';
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].trim().startsWith('{') && lines[i].trim().endsWith('}')) {
            jsonLine = lines[i].trim();
            break;
          }
        }

        if (!jsonLine) {
          jsonLine = output.trim();
        }

        const result = JSON.parse(jsonLine);

        if (result.success) {
          res.json({
            message: result.message,
            records_processed: result.records_processed,
            refreshed_via: 'python_direct'
          });
        } else {
          res.status(500).json({
            message: 'DTR refresh failed',
            error: result.error
          });
        }
      } catch (parseError) {
        console.error('Error parsing Python output:', parseError);
        console.error('Raw Python output:', output);
        res.status(500).json({
          message: 'Error processing refresh result',
          error: parseError.message,
          raw_output: output,
          stderr: errorOutput
        });
      }
    });

  } catch (error) {
    console.error('Error in /refresh-dtr:', error);
    res.status(500).json({ message: error.message });
  }
});

// Refresh DTR for specific employee using Python
app.post('/refresh-dtr/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;

    console.log(`Starting DTR refresh for employee ${employeeId} via Python (direct)...`);

    const pythonProcess = spawn('python', ['refresh_dtr_direct.py', employeeId]);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log('Python stdout:', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('Python stderr:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code: ${code}`);

      if (code !== 0) {
        console.error('Python script failed with code:', code);
        console.error('Python stderr output:', errorOutput);
        return res.status(500).json({
          message: 'Failed to refresh DTR',
          error: errorOutput || `Python script exited with code ${code}`,
          output: output
        });
      }

      try {
        // Try to parse the last line as JSON
        const lines = output.split('\n');
        let jsonLine = '';
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].trim().startsWith('{') && lines[i].trim().endsWith('}')) {
            jsonLine = lines[i].trim();
            break;
          }
        }

        if (!jsonLine) {
          jsonLine = output.trim();
        }

        const result = JSON.parse(jsonLine);

        if (result.success) {
          res.json({
            message: result.message,
            employee_id: employeeId,
            records_processed: result.records_processed,
            refreshed_via: 'python_direct'
          });
        } else {
          res.status(500).json({
            message: 'DTR refresh failed',
            error: result.error,
            employee_id: employeeId
          });
        }
      } catch (parseError) {
        console.error('Error parsing Python output:', parseError);
        console.error('Raw Python output:', output);
        res.status(500).json({
          message: 'Error processing refresh result',
          error: parseError.message,
          raw_output: output,
          stderr: errorOutput
        });
      }
    });

  } catch (error) {
    console.error('Error in /refresh-dtr/:employeeId:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add to your index.js file

// Get official positions
app.get('/api/officials/positions', async (req, res) => {
  try {
    // This would typically come from a dedicated positions table for officials
    const positions = [
      "Mayor",
      "Vice Mayor",
      "Councilor",
      "Department Head",
      "Assistant Department Head",
    ];

    res.json(positions);
  } catch (error) {
    console.error('Error in /api/officials/positions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add new official
app.post('/api/officials', async (req, res) => {
  let connection;
  try {
    const { name, position, signatory } = req.body;

    console.log('Adding new official:', { name, position, signatory });

    // Validate required fields
    if (!name || !position || !signatory) {
      return res.status(400).json({
        error: 'All fields are required: name, position, signatory'
      });
    }

    connection = await pool.getConnection();

    const query = `
      INSERT INTO officials (name, position, signatory)
      VALUES (?, ?, ?)
    `;

    const [result] = await connection.query(query, [name, position, signatory]);

    console.log('Official added successfully with ID:', result.insertId);

    res.json({
      message: 'Official added successfully',
      official_id: result.insertId
    });
  } catch (error) {
    console.error('Error in POST /api/officials:', error);
    res.status(500).json({
      error: 'Failed to add official',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Add to your index.js file

// Update official
app.put('/api/officials/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { name, position, signatory } = req.body;

    console.log('Updating official:', { id, name, position, signatory });

    // Validate required fields
    if (!name || !position || !signatory) {
      return res.status(400).json({
        error: 'All fields are required: name, position, signatory'
      });
    }

    connection = await pool.getConnection();

    const query = `
      UPDATE officials 
      SET name = ?, position = ?, signatory = ?
      WHERE id = ?
    `;

    const [result] = await connection.query(query, [name, position, signatory, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Official not found' });
    }

    console.log('Official updated successfully with ID:', id);

    res.json({
      message: 'Official updated successfully'
    });
  } catch (error) {
    console.error('Error in PUT /api/officials/:id:', error);
    res.status(500).json({
      error: 'Failed to update official',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Delete official
app.delete('/api/officials/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    console.log('Deleting official with ID:', id);

    connection = await pool.getConnection();

    const query = `DELETE FROM officials WHERE id = ?`;

    const [result] = await connection.query(query, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Official not found' });
    }

    console.log('Official deleted successfully with ID:', id);

    res.json({
      message: 'Official deleted successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /api/officials/:id:', error);
    res.status(500).json({
      error: 'Failed to delete official',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});
// Add to your index.js file after the POST /api/noters endpoint

// Update department head
app.put('/api/noters/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { name, position, office, signatory } = req.body;

    console.log('Updating department head:', { id, name, position, office, signatory });

    // Validate required fields
    if (!name || !position || !office || !signatory) {
      return res.status(400).json({
        error: 'All fields are required: name, position, office, signatory'
      });
    }

    connection = await pool.getConnection();

    const query = `
      UPDATE noters 
      SET name = ?, position = ?, office = ?, signatory = ?
      WHERE id = ?
    `;

    const [result] = await connection.query(query, [name, position, office, signatory, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Department head not found' });
    }

    console.log('Department head updated successfully with ID:', id);

    res.json({
      message: 'Department head updated successfully'
    });
  } catch (error) {
    console.error('Error in PUT /api/noters/:id:', error);
    res.status(500).json({
      error: 'Failed to update department head',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Delete department head
app.delete('/api/noters/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    console.log('Deleting department head with ID:', id);

    connection = await pool.getConnection();

    const query = `DELETE FROM noters WHERE id = ?`;

    const [result] = await connection.query(query, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Department head not found' });
    }

    console.log('Department head deleted successfully with ID:', id);

    res.json({
      message: 'Department head deleted successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /api/noters/:id:', error);
    res.status(500).json({
      error: 'Failed to delete department head',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});
// ========== BIOMETRIC DEVICE ENDPOINTS ==========

// Add biometric device
app.post('/api/biometrics', async (req, res) => {
  let connection;
  try {
    const { name, ip_address, port, active } = req.body;

    console.log('Adding new biometric device:', { name, ip_address, port, active });

    // Validate required fields
    if (!name || !ip_address || !port) {
      return res.status(400).json({
        error: 'All fields are required: name, ip_address, port'
      });
    }

    connection = await pool.getConnection();

    const query = `
      INSERT INTO biometrics (name, ip_address, port, active)
      VALUES (?, ?, ?, ?)
    `;

    const [result] = await connection.query(query, [name, ip_address, port, active ? 1 : 0]);

    console.log('Biometric device added successfully with ID:', result.insertId);

    res.json({
      message: 'Biometric device added successfully',
      biometric_id: result.insertId
    });
  } catch (error) {
    console.error('Error in POST /api/biometrics:', error);
    res.status(500).json({
      error: 'Failed to add biometric device',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Update biometric device
app.put('/api/biometrics/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { name, ip_address, port, active } = req.body;

    console.log('Updating biometric device:', { id, name, ip_address, port, active });

    // Validate required fields
    if (!name || !ip_address || !port) {
      return res.status(400).json({
        error: 'All fields are required: name, ip_address, port'
      });
    }

    connection = await pool.getConnection();

    const query = `
      UPDATE biometrics 
      SET name = ?, ip_address = ?, port = ?, active = ?
      WHERE id = ?
    `;

    const [result] = await connection.query(query, [name, ip_address, port, active ? 1 : 0, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Biometric device not found' });
    }

    console.log('Biometric device updated successfully with ID:', id);

    res.json({
      message: 'Biometric device updated successfully'
    });
  } catch (error) {
    console.error('Error in PUT /api/biometrics/:id:', error);
    res.status(500).json({
      error: 'Failed to update biometric device',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Delete biometric device
app.delete('/api/biometrics/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    console.log('Deleting biometric device with ID:', id);

    connection = await pool.getConnection();

    const query = `DELETE FROM biometrics WHERE id = ?`;

    const [result] = await connection.query(query, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Biometric device not found' });
    }

    console.log('Biometric device deleted successfully with ID:', id);

    res.json({
      message: 'Biometric device deleted successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /api/biometrics/:id:', error);
    res.status(500).json({
      error: 'Failed to delete biometric device',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ========== AUTHENTICATION ENDPOINTS ==========
const bcrypt = require('bcrypt');

// Login endpoint - MODIFIED TO TRACK SESSIONS
app.post('/api/auth/login', async (req, res) => {
  let connection;
  try {
    const { username, password } = req.body;

    console.log('Login attempt for username:', username);

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // Handle guest login (no database check)
    if (username === 'guest' && password === 'guest123') {
      console.log('✅ Guest login successful for:', username);

      // Get session info
      const sessionId = req.headers['x-session-id'] ||
        req.headers['authorization']?.split(' ')[1] ||
        `${req.ip}-${req.headers['user-agent']}`;

      if (activeSessions.has(sessionId)) {
        const session = activeSessions.get(sessionId);
        session.username = 'guest';
        session.adminId = 999;
        session.level = 1;
        session.lastActivity = Date.now();

        console.log(`\n🎯 [AUTH] Guest user logged in`);
        console.log(`   Session: ${sessionId.substring(0, 20)}...`);
        console.log(`   IP: ${session.ip}`);
        printActiveSessions();
      }

      return res.json({
        success: true,
        message: 'Login successful',
        admin: {
          id: 999,
          username: 'guest',
          name: 'Guest User',
          level: 1,
          levelText: 'Viewer'
        }
      });
    }

    // Regular login - check database
    connection = await pool.getConnection();

    // Find admin by username
    const [admins] = await connection.query(
      'SELECT * FROM admins WHERE username = ?',
      [username]
    );

    if (admins.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    const admin = admins[0];

    // Verify password
    const bcrypt = require('bcrypt');
    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    // Password is correct - return admin info (without password)
    const adminInfo = {
      id: admin.id,
      username: admin.username,
      name: admin.name,
      level: admin.level,
      levelText: getAdminLevelText(admin.level)
    };

    console.log('✅ Login successful for:', admin.username);

    // Update session with username
    const sessionId = req.headers['x-session-id'] ||
      req.headers['authorization']?.split(' ')[1] ||
      `${req.ip}-${req.headers['user-agent']}`;

    if (activeSessions.has(sessionId)) {
      const session = activeSessions.get(sessionId);
      session.username = admin.username;
      session.adminId = admin.id;
      session.level = admin.level;
      session.lastActivity = Date.now();

      console.log(`\n🎯 [AUTH] ${admin.username} (Level ${admin.level}) logged in`);
      console.log(`   Session: ${sessionId.substring(0, 20)}...`);
      console.log(`   IP: ${session.ip}`);
      printActiveSessions();
    }

    res.json({
      success: true,
      message: 'Login successful',
      admin: adminInfo
    });

  } catch (error) {
    console.error('Error in POST /api/auth/login:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed due to server error'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Helper function to get admin level text
function getAdminLevelText(level) {
  switch (level) {
    case 1: return "View Only";
    case 2: return "Standard";
    case 3: return "Administrator";
    default: return "Unknown";
  }
}

// Verify token endpoint (for checking if user is still logged in)
app.get('/api/auth/verify', async (req, res) => {
  try {
    // For now, we'll use a simple session check
    // In a real app, you'd verify JWT tokens here
    res.json({
      success: true,
      message: 'Token is valid'
    });
  } catch (error) {
    console.error('Error in GET /api/auth/verify:', error);
    res.status(500).json({
      success: false,
      error: 'Token verification failed'
    });
  }
});

// Logout endpoint - MODIFIED TO TRACK SESSIONS
app.post('/api/auth/logout', async (req, res) => {
  try {
    // Get session info
    const sessionId = req.headers['x-session-id'] ||
      req.headers['authorization']?.split(' ')[1] ||
      `${req.ip}-${req.headers['user-agent']}`;

    let username = 'unknown';

    if (activeSessions.has(sessionId)) {
      const session = activeSessions.get(sessionId);
      username = session.username || 'unknown';
      console.log(`\n🚪 [AUTH] ${username} logged out`);
      console.log(`   Session: ${sessionId.substring(0, 20)}...`);
      console.log(`   IP: ${session.ip}`);
      activeSessions.delete(sessionId);
      printActiveSessions();
    }

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Error in POST /api/auth/logout:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

// Add to index.js
app.get('/api/check-unimported-dtrs/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;

    const query = `
      SELECT COUNT(*) as unimported_count 
      FROM imports 
      WHERE employee_id = ? 
      AND NOT EXISTS (
        SELECT 1 FROM dtrs 
        WHERE dtrs.employee_id = imports.employee_id 
        AND dtrs.date = DATE(imports.created_at)
      )
    `;

    const [results] = await pool.query(query, [employeeId]);
    const hasUnimported = results[0].unimported_count > 0;

    res.json({ hasUnimported, count: results[0].unimported_count });
  } catch (error) {
    console.error('Error checking unimported DTRs:', error);
    res.status(500).json({ error: error.message });
  }
});


// ========== MASS PDF GENERATION ENDPOINT ==========
app.post('/api/dtr/mass-generate-print-pdf', async (req, res) => {
  let connection;
  try {
    const {
      office,
      employeeType,
      noter_signatory,
      noter_position,
      first_month,
      first_year,
      first_cut,
      second_month,
      second_year,
      second_cut
    } = req.body;

    console.log('=== MASS EXPORT BACKEND DEBUG ===');
    console.log('Mass PDF generation request received:', {
      office,
      employeeType,
      noter_signatory,
      noter_position,
      first_month,
      first_year,
      first_cut,
      second_month,
      second_year,
      second_cut
    });

    // Validate required fields
    if (!office || !noter_signatory || !noter_position || !first_month || !first_year) {
      console.log('ERROR: Missing required fields');
      return res.status(400).json({
        message: 'Missing required fields for mass PDF generation'
      });
    }

    connection = await pool.getConnection();

    // Get employees based on office and type
    let employeeQuery = `
      SELECT id, name, position, office, regular 
      FROM employees 
      WHERE office = ? AND registered = 1
    `;

    const queryParams = [office];

    if (employeeType === 'regular') {
      employeeQuery += ' AND regular = 1';
    } else if (employeeType === 'jobOrder') {
      employeeQuery += ' AND regular = 0';
    }

    employeeQuery += ' ORDER BY name';

    const [employees] = await connection.query(employeeQuery, queryParams);

    console.log(`Found ${employees.length} employees for mass PDF generation`);

    if (employees.length === 0) {
      console.log('ERROR: No employees found');
      return res.status(404).json({
        message: 'No employees found for the selected criteria'
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `mass_${office.replace(/\s+/g, '_')}_${timestamp}.pdf`;

    console.log('Generated filename:', filename);

    // Prepare arguments for Python script
    const args = [
      'mass_export_dtr.py',
      office,
      employeeType,
      noter_signatory,
      noter_position,
      first_month.toString(),
      first_year.toString(),
      first_cut || 'full',
      (second_month || 0).toString(),
      (second_year || 0).toString(),
      second_cut || 'full',
      filename
    ];

    console.log('Calling Python mass export script with args:', args);

    const pythonProcess = spawn('python', args);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log('Python stdout:', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('Python stderr:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      console.log('Python process exited with code:', code);

      if (code !== 0) {
        console.error('Python script failed with code:', code);
        return res.status(500).json({
          message: 'Failed to generate mass PDF',
          error: errorOutput || 'Unknown error occurred during mass PDF generation'
        });
      }

      // Check for success message
      if (output.includes('SUCCESS: Mass PDF created')) {
        console.log('✅ Mass PDF generated successfully');

        // Extract the final output path
        const finalOutputMatch = output.match(/FINAL_OUTPUT: (.*)/);
        if (finalOutputMatch) {
          const generatedFilePath = finalOutputMatch[1];
          console.log('Final output path:', generatedFilePath);

          res.json({
            success: true,
            filename: filename,
            downloadUrl: `/api/dtr/mass-pdf-preview/${filename}`,
            employeeCount: employees.length
          });
        } else {
          console.log('WARNING: Could not extract final output path, using filename');
          res.json({
            success: true,
            filename: filename,
            downloadUrl: `/api/dtr/mass-pdf-preview/${filename}`,
            employeeCount: employees.length
          });
        }

        console.log('=== MASS EXPORT BACKEND COMPLETED ===');

      } else {
        console.error('Mass PDF generation failed. Output:', output);
        res.status(500).json({
          message: 'Mass PDF generation failed',
          output: output
        });
      }
    });

  } catch (error) {
    console.error('Error in /api/dtr/mass-generate-print-pdf:', error);
    res.status(500).json({
      message: 'Mass PDF generation failed',
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ========== MASS PDF PREVIEW ENDPOINT ==========
app.get('/api/dtr/mass-pdf-preview/:filename', (req, res) => {
  try {
    const { filename } = req.params;

    if (!filename.startsWith('mass_') || !filename.endsWith('.pdf')) {
      return res.status(400).json({ message: 'Invalid filename' });
    }

    const currentConfig = loadConfig();
    const exportPath = currentConfig.export?.path || 'exports';

    // Check if exportPath is absolute or relative
    let filePath;
    if (path.isAbsolute(exportPath)) {
      filePath = path.join(exportPath, 'previews', filename);
    } else {
      filePath = path.join(__dirname, exportPath, 'previews', filename);
    }

    console.log('🔍 Looking for mass PDF at:', filePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'PDF file not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    const fileStream = fs.createReadStream(filePath);

    fileStream.on('error', (err) => {
      console.error('Error reading mass PDF file:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to read PDF file' });
      }
    });

    fileStream.on('end', () => {
      console.log('✅ Mass PDF sent successfully');

      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) {
              console.error('Error deleting mass PDF:', unlinkErr);
            } else {
              console.log('🗑️ Mass PDF auto-deleted:', filename);
            }
          });
        }
      }, 5000);
    });

    fileStream.pipe(res);

  } catch (error) {
    console.error('Error serving mass PDF file:', error);
    res.status(500).json({ message: 'Failed to serve mass PDF file' });
  }
});

// ========== ADMIN MANAGEMENT ENDPOINTS ==========
// Get all admins
app.get('/api/admins', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT id, name, username, level FROM admins ORDER BY id');
    res.json(results);
  } catch (error) {
    console.error('Error in /api/admins:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add new admin
app.post('/api/admins', async (req, res) => {
  let connection;
  try {
    const { name, username, password, level } = req.body;

    console.log('Adding new admin:', { name, username, level });

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      });
    }

    connection = await pool.getConnection();

    // Check if username already exists
    const [existing] = await connection.query(
      'SELECT id FROM admins WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        error: 'Username already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO admins (name, username, password, level)
      VALUES (?, ?, ?, ?)
    `;

    const [result] = await connection.query(query, [
      name || username,
      username,
      hashedPassword,
      level || 1
    ]);

    console.log('Admin added successfully with ID:', result.insertId);

    res.json({
      message: 'Admin added successfully',
      admin_id: result.insertId
    });
  } catch (error) {
    console.error('Error in POST /api/admins:', error);
    res.status(500).json({
      error: 'Failed to add admin',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Update admin
app.put('/api/admins/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { name, username, password, level } = req.body;

    console.log('Updating admin:', { id, name, username, level });

    connection = await pool.getConnection();

    // Check if admin exists
    const [existing] = await connection.query(
      'SELECT id FROM admins WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Build update query dynamically based on provided fields
    let updateFields = [];
    let queryParams = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      queryParams.push(name);
    }

    if (username !== undefined) {
      // Check if new username already exists (excluding current admin)
      const [usernameCheck] = await connection.query(
        'SELECT id FROM admins WHERE username = ? AND id != ?',
        [username, id]
      );

      if (usernameCheck.length > 0) {
        return res.status(400).json({
          error: 'Username already exists'
        });
      }

      updateFields.push('username = ?');
      queryParams.push(username);
    }

    if (password !== undefined) {
      if (password.length < 6) {
        return res.status(400).json({
          error: 'Password must be at least 6 characters'
        });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push('password = ?');
      queryParams.push(hashedPassword);
    }

    if (level !== undefined) {
      updateFields.push('level = ?');
      queryParams.push(level);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'No fields to update'
      });
    }

    queryParams.push(id);

    const query = `
      UPDATE admins 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    const [result] = await connection.query(query, queryParams);

    console.log('Admin updated successfully with ID:', id);

    res.json({
      message: 'Admin updated successfully'
    });
  } catch (error) {
    console.error('Error in PUT /api/admins/:id:', error);
    res.status(500).json({
      error: 'Failed to update admin',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Delete admin
app.delete('/api/admins/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    console.log('Deleting admin with ID:', id);

    connection = await pool.getConnection();

    // Check if admin exists
    const [existing] = await connection.query(
      'SELECT id FROM admins WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Prevent deleting the last admin
    const [allAdmins] = await connection.query('SELECT COUNT(*) as count FROM admins');
    if (allAdmins[0].count <= 1) {
      return res.status(400).json({
        error: 'Cannot delete the last admin'
      });
    }

    const query = `DELETE FROM admins WHERE id = ?`;

    const [result] = await connection.query(query, [id]);

    console.log('Admin deleted successfully with ID:', id);

    res.json({
      message: 'Admin deleted successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /api/admins/:id:', error);
    res.status(500).json({
      error: 'Failed to delete admin',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});


// ALSO UPDATE the single DTR import to support .dat files
app.post('/import-single-dtr', upload.single('file'), async (req, res) => {
  let connection;
  try {
    const { source, biometric_id, employee_id, start_date, end_date } = req.body;
    const file = req.file;

    console.log('Single DTR import request:', {
      source,
      biometric_id,
      employee_id,
      start_date,
      end_date
    });

    if (!source || !employee_id) {
      return res.status(400).json({
        message: 'Source and employee ID are required'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const dtrs = [];
    let origin = '';

    if (source.toLowerCase() === 'biometric') {
      // ... existing biometric code ...
      if (!biometric_id) {
        throw new Error('Biometric ID is required for biometric source');
      }

      const [biometricRows] = await connection.query(
        'SELECT * FROM biometrics WHERE id = ?',
        [biometric_id]
      );

      if (biometricRows.length === 0) {
        throw new Error('Biometric device not found');
      }

      const biometric = biometricRows[0];
      origin = biometric.ip_address;

      let attendances;
      try {
        attendances = await fetchBiometricAttendance(biometric_id, start_date, end_date);
      } catch (error) {
        throw new Error(`Failed to fetch biometric data: ${error.message}`);
      }

      for (const attendance of attendances) {
        const recordEmployeeId = attendance.user_id;
        const timestampStr = attendance.timestamp;

        if (!recordEmployeeId || !timestampStr || recordEmployeeId.toString() !== employee_id.toString()) {
          continue;
        }

        if (!isTimestampInRange(timestampStr, start_date, end_date)) {
          continue;
        }

        const created_at = parseTimestampDirect(timestampStr);

        dtrs.push({
          employee_id: employee_id.toString(),
          created_at: created_at
        });
      }
    }
    else if (source.toLowerCase() === 'file') {
      if (!file) {
        return res.status(400).json({ message: 'File is required for file source' });
      }

      origin = file.originalname;
      const fileExtension = file.originalname.toLowerCase().split('.').pop();

      console.log(`Processing ${fileExtension} file for employee ${employee_id}: ${file.originalname}`);

      // ADD .dat file processing for single employee
      if (fileExtension === 'dat') {
        console.log('📄 Processing .dat file for single employee...');

        try {
          const datRecords = await convertDatFile(file.path);

          for (const record of datRecords) {
            // Only process records for target employee
            if (record.employee_id.toString() !== employee_id.toString()) {
              continue;
            }

            // Extract date from created_at (already in YYYY-MM-DD format)
            const recordDate = record.created_at.split(' ')[0];

            // Check date range - recordDate is already in YYYY-MM-DD format
            if (start_date && end_date) {
              if (recordDate < start_date || recordDate > end_date) {
                continue;
              }
            } else if (start_date && !end_date) {
              if (recordDate < start_date) {
                continue;
              }
            } else if (!start_date && end_date) {
              if (recordDate > end_date) {
                continue;
              }
            }

            dtrs.push({
              employee_id: employee_id.toString(),
              created_at: record.created_at
            });
          }

          console.log(`✅ Found ${dtrs.length} records for employee ${employee_id} from .dat file`);
        } catch (datError) {
          throw new Error(`Failed to process .dat file: ${datError.message}`);
        }
      }
      // Parse TXT file (existing code)
      else if (fileExtension === 'txt') {
        const content = fs.readFileSync(file.path, 'utf8');
        const rows = content.split('\n');

        if (rows.length === 0) {
          throw new Error('File is empty');
        }

        rows.shift();

        for (const row of rows) {
          if (!row.trim()) continue;

          const parts = row.trim().split(/\s+/);
          if (parts.length < 7) continue;

          const recordEmployeeId = parts[2];
          const date = parts[5];
          const time = parts[6];

          if (recordEmployeeId.toString() !== employee_id.toString()) {
            continue;
          }

          try {
            if (!isDateInRange(date, start_date, end_date)) {
              continue;
            }

            const created_at = formatDateTimeForMySQL(date, time);

            dtrs.push({
              employee_id: employee_id.toString(),
              created_at: created_at
            });

          } catch (parseError) {
            console.warn(`Error parsing row:`, parseError);
            continue;
          }
        }
      }
      // Parse XLSX file (existing code continues...)
      else if (fileExtension === 'xlsx') {
        const workbook = XLSX.readFile(file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length < 4) continue;
          if (i === 0 && isNaN(row[1])) continue;

          const recordEmployeeId = row[1]?.toString();
          const excelDate = row[0];
          const time = row[3];

          if (!recordEmployeeId || recordEmployeeId.toString() !== employee_id.toString()) {
            continue;
          }

          if (!excelDate || !time) continue;

          try {
            let created_at;

            if (typeof excelDate === 'number') {
              const jsDate = new Date((excelDate - 25569) * 86400 * 1000);
              const year = jsDate.getUTCFullYear();
              const month = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
              const day = String(jsDate.getUTCDate()).padStart(2, '0');

              const [hours, minutes, seconds] = time.split(':').map(Number);

              created_at = `${year}-${month}-${day} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds || 0).padStart(2, '0')}`;

              const dateStr = `${year}-${month}-${day}`;
              if (start_date && end_date && !(dateStr >= start_date && dateStr <= end_date)) continue;
              if (start_date && !end_date && !(dateStr >= start_date)) continue;
              if (!start_date && end_date && !(dateStr <= end_date)) continue;
            } else {
              const [datePart, timePart] = excelDate.split(' ');
              created_at = `${datePart} ${time}`;

              if (start_date && end_date && !(datePart >= start_date && datePart <= end_date)) continue;
              if (start_date && !end_date && !(datePart >= start_date)) continue;
              if (!start_date && end_date && !(datePart <= end_date)) continue;
            }

            dtrs.push({
              employee_id: employee_id.toString(),
              created_at: created_at
            });

          } catch (parseError) {
            console.warn(`Error parsing Excel row:`, parseError);
            continue;
          }
        }
      } else {
        throw new Error('File type not supported. Only .txt, .xlsx, and .dat are supported.');
      }

      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } else {
      throw new Error('Invalid source. Use "biometric" or "file"');
    }

    const uniqueDtrs = Array.from(new Set(dtrs.map(d => JSON.stringify(d)))).map(d => JSON.parse(d));

    console.log(`Importing ${uniqueDtrs.length} unique DTR records for employee ${employee_id}`);

    if (uniqueDtrs.length === 0) {
      throw new Error('No DTR records found for the specified employee in the date range');
    }

    for (const dtr of uniqueDtrs) {
      await connection.query(
        'INSERT INTO imports (employee_id, created_at) VALUES (?, ?)',
        [dtr.employee_id, dtr.created_at]
      );
    }

    await connection.query(
      'INSERT INTO logs (admin_id, action, category, original, updated) VALUES (?, ?, ?, ?, ?)',
      [1, 'single_import', 'import', '', `single_import(employee_id = ${employee_id}, source = ${source}, origin = ${origin})`]
    );

    await connection.commit();

    res.json({
      message: `DTR imported successfully for employee ${employee_id}`,
      source: source,
      file_type: source === 'file' ? file.originalname.split('.').pop() : 'biometric',
      origin,
      employee_id: employee_id,
      records_imported: uniqueDtrs.length,
      start_date: start_date,
      end_date: end_date
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error in POST /import-single-dtr:', error);
    res.status(500).json({ message: error.message });
  } finally {
    if (connection) {
      connection.release();
    }
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

/**
 * Convert .dat file to formatted DTR data
 * Based on the script.py logic
 */
function convertDatFile(inputPath) {
  return new Promise((resolve, reject) => {
    try {
      const content = fs.readFileSync(inputPath, 'utf8');
      const lines = content.split('\n');
      const records = [];
      let processedCount = 0;
      let skippedCount = 0;

      console.log(`📄 Converting .dat file: ${lines.length} lines found`);

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        const parts = trimmedLine.split(/\s+/);
        if (parts.length < 2) {
          console.warn(`⚠️ Skipping line with insufficient parts: ${trimmedLine}`);
          skippedCount++;
          continue;
        }

        const enno = parts[0].trim(); // Employee ID
        let datetimeStr = parts[1].trim();

        // Combine date and time if separated
        if (parts.length >= 3) {
          datetimeStr = parts[1] + " " + parts[2];
        }

        // Parse datetime: 2025-10-13 21:52:32 format
        try {
          // Validate datetime format - must be YYYY-MM-DD HH:MM:SS
          const datetimeMatch = datetimeStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
          if (!datetimeMatch) {
            console.warn(`⚠️ Invalid datetime format: ${datetimeStr} (expected YYYY-MM-DD HH:MM:SS)`);
            skippedCount++;
            continue;
          }

          const [_, year, month, day, hour, minute, second] = datetimeMatch;

          // Validate date components
          const yearNum = parseInt(year);
          const monthNum = parseInt(month);
          const dayNum = parseInt(day);
          const hourNum = parseInt(hour);
          const minuteNum = parseInt(minute);
          const secondNum = parseInt(second);

          if (yearNum < 2000 || yearNum > 2100 ||
            monthNum < 1 || monthNum > 12 ||
            dayNum < 1 || dayNum > 31 ||
            hourNum < 0 || hourNum > 23 ||
            minuteNum < 0 || minuteNum > 59 ||
            secondNum < 0 || secondNum > 59) {
            console.warn(`⚠️ Invalid date/time values: ${datetimeStr}`);
            skippedCount++;
            continue;
          }

          // MySQL datetime format (already in correct format)
          const mysqlDateTime = `${year}-${month}-${day} ${hour}:${minute}:${second}`;

          records.push({
            employee_id: enno,
            created_at: mysqlDateTime,
            original_line: trimmedLine,
            line_number: processedCount + 1
          });

          processedCount++;
        } catch (parseError) {
          console.warn(`⚠️ Error parsing line: ${trimmedLine}`, parseError.message);
          skippedCount++;
          continue;
        }
      }

      console.log(`✅ Conversion complete: ${processedCount} records processed, ${skippedCount} lines skipped`);

      if (records.length === 0) {
        reject(new Error(`No valid attendance records found in .dat file. Processed ${lines.length} lines, all skipped due to format errors.`));
      } else {
        console.log(`✅ Converted ${records.length} records from .dat file`);
        resolve(records);
      }
    } catch (error) {
      reject(new Error(`Failed to read or parse .dat file: ${error.message}`));
    }
  });
}

// ========== FAST BIOMETRIC DEVICE STATUS CHECK ENDPOINT ==========
app.post('/api/biometrics/check-status', async (req, res) => {
  try {
    const { ip_address, port } = req.body;

    console.log(`Quick checking biometric device: ${ip_address}:${port}`);

    if (!ip_address || !port) {
      return res.status(400).json({
        error: 'IP address and port are required'
      });
    }

    // Use the simple ping script (more reliable)
    const pythonProcess = spawn('python', [
      'ping_biometric.py',  // Use this file
      ip_address,
      port.toString()
    ]);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`Python stderr for ${ip_address}:`, data.toString());
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python process for ${ip_address} exited with code: ${code}`);

      if (code !== 0) {
        console.error(`Python script failed for ${ip_address} with code ${code}. Error:`, errorOutput);
        return res.json({
          online: false,
          userCount: 0,
          attendanceCount: 0,
          firmware: null,
          error: `Check failed (code ${code})`
        });
      }

      try {
        // Clean the output - remove any extra spaces/newlines
        const cleanOutput = output.trim();
        const result = JSON.parse(cleanOutput);
        console.log(`✅ ${ip_address}: ${result.online ? 'Online' : 'Offline'}`);
        res.json(result);
      } catch (parseError) {
        console.error(`Failed to parse Python output for ${ip_address}:`, output);
        res.json({
          online: false,
          userCount: 0,
          attendanceCount: 0,
          firmware: null,
          error: 'Failed to parse device status response'
        });
      }
    });

    // Handle process errors
    pythonProcess.on('error', (error) => {
      console.error(`Failed to start Python process for ${ip_address}:`, error);
      res.json({
        online: false,
        userCount: 0,
        attendanceCount: 0,
        firmware: null,
        error: 'Failed to start check process'
      });
    });

  } catch (error) {
    console.error('Error in /api/biometrics/check-status:', error);
    res.json({
      online: false,
      userCount: 0,
      attendanceCount: 0,
      firmware: null,
      error: error.message
    });
  }
});


// ========== ADD DTR ENDPOINT ==========
app.post('/api/dtr', async (req, res) => {
  let connection;
  try {
    const { employee_id, date, am_in, am_out, pm_in, pm_out, locked } = req.body;

    console.log('Adding DTR record:', {
      employee_id,
      date,
      am_in: am_in || '(empty)',
      am_out: am_out || '(empty)',
      pm_in: pm_in || '(empty)',
      pm_out: pm_out || '(empty)',
      locked
    });

    // 1. Date Validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        error: 'Invalid date format. Please use YYYY-MM-DD format.'
      });
    }

    // 2. Time Validation
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

    const validateTime = (time, fieldName) => {
      if (time && !timeRegex.test(time)) {
        throw new Error(`Invalid time format for ${fieldName}. Please use HH:MM or HH:MM:SS format.`);
      }
    };

    if (am_in) validateTime(am_in, "AM In");
    if (am_out) validateTime(am_out, "AM Out");
    if (pm_in) validateTime(pm_in, "PM In");
    if (pm_out) validateTime(pm_out, "PM Out");

    // 3. Check if employee exists
    connection = await pool.getConnection();

    const [employeeRows] = await connection.query(
      'SELECT id FROM employees WHERE id = ?',
      [employee_id]
    );

    if (employeeRows.length === 0) {
      return res.status(404).json({
        error: `Employee with ID ${employee_id} not found`
      });
    }

    // 4. Check for duplicate DTR date
    const [existingDTR] = await connection.query(
      'SELECT id FROM dtrs WHERE employee_id = ? AND date = ?',
      [employee_id, date]
    );

    if (existingDTR.length > 0) {
      return res.status(400).json({
        error: `A DTR record already exists for employee ${employee_id} on ${date}`
      });
    }

    // 5. Prepare time values (empty strings become NULL)
    const amInValue = am_in === '' ? null : am_in;
    const amOutValue = am_out === '' ? null : am_out;
    const pmInValue = pm_in === '' ? null : pm_in;
    const pmOutValue = pm_out === '' ? null : pm_out;

    // 6. Insert DTR record
    const query = `
      INSERT INTO dtrs (employee_id, date, am_in, am_out, pm_in, pm_out, locked)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await connection.query(query, [
      employee_id,
      date,
      amInValue,
      amOutValue,
      pmInValue,
      pmOutValue,
      locked ? 1 : 0
    ]);

    console.log('✅ DTR record added successfully with ID:', result.insertId);

    // 7. Log the action (assuming Level 2 or higher access)
    await connection.query(
      'INSERT INTO logs (admin_id, action, category, original, updated) VALUES (?, ?, ?, ?, ?)',
      [1, 'add_dtr', 'dtr', '', `Added DTR for employee ${employee_id} on ${date}`]
    );

    res.json({
      success: true,
      message: 'DTR record added successfully',
      dtr_id: result.insertId,
      employee_id,
      date,
      locked: locked ? 1 : 0
    });

  } catch (error) {
    console.error('Error in POST /api/dtr:', error);
    res.status(500).json({
      error: error.message || 'Failed to add DTR record'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});


// ========== DELETE DTR ENDPOINT ==========
app.delete('/api/dtr/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    console.log('Deleting DTR record with ID:', id);

    connection = await pool.getConnection();

    // Check if DTR record exists
    const [existingRows] = await connection.query(
      'SELECT id, employee_id, date FROM dtrs WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        error: 'DTR record not found'
      });
    }

    const dtrRecord = existingRows[0];

    // Delete the DTR record
    const [result] = await connection.query(
      'DELETE FROM dtrs WHERE id = ?',
      [id]
    );

    console.log('✅ DTR record deleted:', {
      id,
      employee_id: dtrRecord.employee_id,
      date: dtrRecord.date
    });

    // Log the action
    await connection.query(
      'INSERT INTO logs (admin_id, action, category, original, updated) VALUES (?, ?, ?, ?, ?)',
      [1, 'delete_dtr', 'dtr', `DTR ${id} for employee ${dtrRecord.employee_id} on ${dtrRecord.date}`, '']
    );

    res.json({
      success: true,
      message: 'DTR record deleted successfully',
      deleted_id: id,
      employee_id: dtrRecord.employee_id,
      date: dtrRecord.date
    });

  } catch (error) {
    console.error('Error in DELETE /api/dtr/:id:', error);
    res.status(500).json({
      error: error.message || 'Failed to delete DTR record'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});


// ========== DEBUG SESSION ENDPOINT ==========
app.get('/api/debug/sessions', (req, res) => {
  const sessions = [];

  activeSessions.forEach((session, sessionId) => {
    sessions.push({
      sessionId: sessionId.substring(0, 20) + '...',
      ip: session.ip,
      username: session.username,
      firstSeen: new Date(session.firstSeen).toISOString(),
      lastActivity: new Date(session.lastActivity).toISOString(),
      requestCount: session.requestCount,
      userAgent: session.userAgent?.substring(0, 50) + '...',
      currentPath: session.path,
      currentMethod: session.method
    });
  });

  res.json({
    activeCount: sessions.length,
    sessions: sessions
  });
});


// Periodic session monitor
function startSessionMonitor() {
  console.log('\n🔄 Starting session monitor...');

  // Print active sessions every 60 seconds
  setInterval(() => {
    printActiveSessions();
  }, 60000);

  // Initial print after 5 seconds
  setTimeout(() => {
    printActiveSessions();
  }, 5000);
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Config file: ${CONFIG_FILE_PATH}`);

  // Ensure export directories exist
  const currentConfig = loadConfig();
  const exportPath = currentConfig.export?.path || 'exports';
  let exportDir, previewsDir;

  if (path.isAbsolute(exportPath)) {
    exportDir = exportPath;
    previewsDir = path.join(exportPath, 'previews');
  } else {
    exportDir = path.join(__dirname, exportPath);
    previewsDir = path.join(__dirname, exportPath, 'previews');
  }

  try {
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
      console.log(`✅ Created export directory: ${exportDir}`);
    }
    if (!fs.existsSync(previewsDir)) {
      fs.mkdirSync(previewsDir, { recursive: true });
      console.log(`✅ Created previews directory: ${previewsDir}`);
    }
  } catch (err) {
    console.error('❌ Failed to create export directories:', err.message);
  }

  console.log('\n💡 Session monitoring enabled');
  console.log('💡 Active sessions will be displayed every 60 seconds');

  // Start session monitoring
  startSessionMonitor();
});
