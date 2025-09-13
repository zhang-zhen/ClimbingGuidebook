// server.js
console.log('🚀 Starting climbing server...');

try {
  console.log('📦 Loading modules...');
  require('dotenv').config();
  const express = require('express');
  const { Pool } = require('pg');
  const cors = require('cors');
  
  console.log('✅ All modules loaded');
  console.log('📋 Database configuration:');
  console.log(`   User: ${process.env.DB_USER || 'postgres'}`);
  console.log(`   Database: ${process.env.DB_NAME || 'climbing_guidebook'}`);
  console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`   Port: ${process.env.DB_PORT || 5432}`);
  
  const app = express();
  
  // Database connection
  console.log('🔌 Creating database connection...');
  const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'climbing_guidebook',
    ...(process.env.DB_PASSWORD && { password: process.env.DB_PASSWORD }),
    port: process.env.DB_PORT || 5432,
  });
  
  console.log('✅ Database pool created');
  
  // Test database connection with user info
  console.log('🔍 Testing database connection...');
  pool.connect()
    .then(async (client) => {
      const result = await client.query('SELECT current_database(), current_user');
      console.log('✅ Successfully connected to PostgreSQL database');
      console.log(`📊 Connected as: ${result.rows[0].current_user}`);
      console.log(`📊 Database: ${result.rows[0].current_database}`);
      client.release();
    })
    .catch(err => {
      console.error('❌ Error connecting to database:', err.message);
      console.error('Error code:', err.code);
    });
  
  // Middleware
  console.log('🔧 Setting up middleware...');
  app.use(cors());
  app.use(express.json());
  
  // Routes
  app.get('/', (req, res) => {
    console.log('📥 Request received to /');
    res.json({ 
      message: 'Climbing API Server is running!',
      database: process.env.DB_NAME || 'climbing_guidebook',
      user: process.env.DB_USER || 'postgres',
      timestamp: new Date().toISOString() 
    });
  });
  
  app.get('/api/areas', async (req, res) => {
    console.log('📥 Request received to /api/areas');
    try {
      const result = await pool.query('SELECT * FROM area ORDER BY name_zh');
      console.log(`📊 Found ${result.rows.length} areas`);
      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length
      });
    } catch (err) {
      console.error('❌ Error fetching areas:', err.message);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch areas',
        details: err.message
      });
    }
  });
  
  const port = process.env.PORT || 3000;
  console.log(`🎧 Starting server on port ${port}...`);
  
  app.listen(port, (err) => {
    if (err) {
      console.error('❌ Failed to start server:', err);
    } else {
      console.log(`🧗‍♂️ Climbing API server running on http://localhost:${port}`);
      console.log(`📍 Test the API: http://localhost:${port}/api/areas`);
      console.log(`👤 Database user: ${process.env.DB_USER || 'postgres'}`);
      console.log(`🗄️  Database name: ${process.env.DB_NAME || 'climbing_guidebook'}`);
    }
  });
  
  // Add these endpoints to your existing server.js

// ==========================================
// ADMIN ENDPOINTS
// ==========================================

// CREATE endpoints (for adding new data)

// Add new area
app.post('/api/admin/areas', async (req, res) => {
  console.log('📥 POST /api/admin/areas');
  try {
    const {
      name_zh, name_en, description_zh, description_en,
      country_zh, country_en, province_zh, province_en,
      city_zh, city_en, latitude, longitude, elevation_meters,
      access_notes_zh, access_notes_en
    } = req.body;

    const result = await pool.query(`
      INSERT INTO area (
        name_zh, name_en, description_zh, description_en,
        country_zh, country_en, province_zh, province_en,
        city_zh, city_en, latitude, longitude, elevation_meters,
        access_notes_zh, access_notes_en
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      name_zh, name_en, description_zh, description_en,
      country_zh, country_en, province_zh, province_en,
      city_zh, city_en, latitude, longitude, elevation_meters,
      access_notes_zh, access_notes_en
    ]);

    console.log(`✅ Created new area: ${name_zh} (${name_en})`);
    res.json({
      success: true,
      message: 'Area created successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Error creating area:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create area',
      details: err.message
    });
  }
});

// Add new crag
app.post('/api/admin/crags', async (req, res) => {
  console.log('📥 POST /api/admin/crags');
  try {
    const {
      area_id, name_zh, name_en, description_zh, description_en,
      latitude, longitude, approach_time_minutes, approach_difficulty,
      rock_type_zh, rock_type_en, orientation, wall_height_meters,
      parking_latitude, parking_longitude, parking_notes_zh, parking_notes_en
    } = req.body;

    const result = await pool.query(`
      INSERT INTO crag (
        area_id, name_zh, name_en, description_zh, description_en,
        latitude, longitude, approach_time_minutes, approach_difficulty,
        rock_type_zh, rock_type_en, orientation, wall_height_meters,
        parking_latitude, parking_longitude, parking_notes_zh, parking_notes_en
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      area_id, name_zh, name_en, description_zh, description_en,
      latitude, longitude, approach_time_minutes, approach_difficulty,
      rock_type_zh, rock_type_en, orientation, wall_height_meters,
      parking_latitude, parking_longitude, parking_notes_zh, parking_notes_en
    ]);

    console.log(`✅ Created new crag: ${name_zh} (${name_en})`);
    res.json({
      success: true,
      message: 'Crag created successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Error creating crag:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create crag',
      details: err.message
    });
  }
});

// Add new sector
app.post('/api/admin/sectors', async (req, res) => {
  console.log('📥 POST /api/admin/sectors');
  try {
    const {
      crag_id, name_zh, name_en, description_zh, description_en,
      sector_order, latitude, longitude
    } = req.body;

    const result = await pool.query(`
      INSERT INTO sector (
        crag_id, name_zh, name_en, description_zh, description_en,
        sector_order, latitude, longitude
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      crag_id, name_zh, name_en, description_zh, description_en,
      sector_order, latitude, longitude
    ]);

    console.log(`✅ Created new sector: ${name_zh} (${name_en})`);
    res.json({
      success: true,
      message: 'Sector created successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Error creating sector:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create sector',
      details: err.message
    });
  }
});

// Add new route
app.post('/api/admin/routes', async (req, res) => {
  console.log('📥 POST /api/admin/routes');
  try {
    const {
      sector_id, crag_id, name_zh, name_en, grade_yds, grade_french,
      length_meters, bolt_count, quality_rating, route_order,
      description_zh, description_en, beta_zh, beta_en
    } = req.body;

    const result = await pool.query(`
      INSERT INTO route (
        sector_id, crag_id, name_zh, name_en, grade_yds, grade_french,
        length_meters, bolt_count, quality_rating, route_order,
        description_zh, description_en, beta_zh, beta_en
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      sector_id, crag_id, name_zh, name_en, grade_yds, grade_french,
      length_meters, bolt_count, quality_rating, route_order,
      description_zh, description_en, beta_zh, beta_en
    ]);

    console.log(`✅ Created new route: ${name_zh} (${name_en})`);
    res.json({
      success: true,
      message: 'Route created successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Error creating route:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create route',
      details: err.message
    });
  }
});

// Get crags for dropdown (used in admin forms)
app.get('/api/crags', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.crag_id, c.name_zh, c.name_en, a.name_zh as area_name_zh, a.name_en as area_name_en
      FROM crag c
      JOIN area a ON c.area_id = a.area_id
      ORDER BY a.name_zh, c.name_zh
    `);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get sectors for dropdown
app.get('/api/sectors', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.sector_id, s.name_zh, s.name_en, c.name_zh as crag_name_zh
      FROM sector s
      JOIN crag c ON s.crag_id = c.crag_id
      ORDER BY c.name_zh, s.sector_order, s.name_zh
    `);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get routes for display
app.get('/api/routes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.route_id, r.name_zh, r.name_en, r.grade_yds, r.grade_french,
             r.length_meters, r.bolt_count, r.quality_rating,
             c.name_zh as crag_name_zh, c.name_en as crag_name_en,
             s.name_zh as sector_name_zh, s.name_en as sector_name_en
      FROM route r
      JOIN crag c ON r.crag_id = c.crag_id
      LEFT JOIN sector s ON r.sector_id = s.sector_id
      ORDER BY c.name_zh, s.sector_order, r.route_order, r.name_zh
    `);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// DELETE ENDPOINTS
// ==========================================

// Delete area
app.delete('/api/admin/areas/:id', async (req, res) => {
  console.log(`📥 DELETE /api/admin/areas/${req.params.id}`);
  try {
    const areaId = parseInt(req.params.id);
    
    // Check if area exists and get its name for logging
    const checkResult = await pool.query('SELECT name_zh, name_en FROM area WHERE area_id = $1', [areaId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Area not found'
      });
    }
    
    const areaName = checkResult.rows[0];
    
    // Check for dependent crags
    const dependentCrags = await pool.query('SELECT COUNT(*) as count FROM crag WHERE area_id = $1', [areaId]);
    if (parseInt(dependentCrags.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete area. It has ${dependentCrags.rows[0].count} dependent crag(s). Delete all crags in this area first.`
      });
    }
    
    // Delete the area
    const result = await pool.query('DELETE FROM area WHERE area_id = $1 RETURNING *', [areaId]);
    
    console.log(`✅ Deleted area: ${areaName.name_zh} (${areaName.name_en})`);
    res.json({
      success: true,
      message: 'Area deleted successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Error deleting area:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to delete area',
      details: err.message
    });
  }
});

// Delete crag
app.delete('/api/admin/crags/:id', async (req, res) => {
  console.log(`📥 DELETE /api/admin/crags/${req.params.id}`);
  try {
    const cragId = parseInt(req.params.id);
    
    // Check if crag exists and get its name for logging
    const checkResult = await pool.query('SELECT name_zh, name_en FROM crag WHERE crag_id = $1', [cragId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Crag not found'
      });
    }
    
    const cragName = checkResult.rows[0];
    
    // Check for dependent sectors
    const dependentSectors = await pool.query('SELECT COUNT(*) as count FROM sector WHERE crag_id = $1', [cragId]);
    if (parseInt(dependentSectors.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete crag. It has ${dependentSectors.rows[0].count} dependent sector(s). Delete all sectors in this crag first.`
      });
    }
    
    // Check for dependent routes
    const dependentRoutes = await pool.query('SELECT COUNT(*) as count FROM route WHERE crag_id = $1', [cragId]);
    if (parseInt(dependentRoutes.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete crag. It has ${dependentRoutes.rows[0].count} dependent route(s). Delete all routes in this crag first.`
      });
    }
    
    // Delete the crag
    const result = await pool.query('DELETE FROM crag WHERE crag_id = $1 RETURNING *', [cragId]);
    
    console.log(`✅ Deleted crag: ${cragName.name_zh} (${cragName.name_en})`);
    res.json({
      success: true,
      message: 'Crag deleted successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Error deleting crag:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to delete crag',
      details: err.message
    });
  }
});

// Delete sector
app.delete('/api/admin/sectors/:id', async (req, res) => {
  console.log(`📥 DELETE /api/admin/sectors/${req.params.id}`);
  try {
    const sectorId = parseInt(req.params.id);
    
    // Check if sector exists and get its name for logging
    const checkResult = await pool.query('SELECT name_zh, name_en FROM sector WHERE sector_id = $1', [sectorId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sector not found'
      });
    }
    
    const sectorName = checkResult.rows[0];
    
    // Check for dependent routes
    const dependentRoutes = await pool.query('SELECT COUNT(*) as count FROM route WHERE sector_id = $1', [sectorId]);
    if (parseInt(dependentRoutes.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete sector. It has ${dependentRoutes.rows[0].count} dependent route(s). Delete all routes in this sector first.`
      });
    }
    
    // Delete the sector
    const result = await pool.query('DELETE FROM sector WHERE sector_id = $1 RETURNING *', [sectorId]);
    
    console.log(`✅ Deleted sector: ${sectorName.name_zh} (${sectorName.name_en})`);
    res.json({
      success: true,
      message: 'Sector deleted successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Error deleting sector:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to delete sector',
      details: err.message
    });
  }
});

// Delete route
app.delete('/api/admin/routes/:id', async (req, res) => {
  console.log(`📥 DELETE /api/admin/routes/${req.params.id}`);
  try {
    const routeId = parseInt(req.params.id);
    
    // Check if route exists and get its name for logging
    const checkResult = await pool.query('SELECT name_zh, name_en FROM route WHERE route_id = $1', [routeId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }
    
    const routeName = checkResult.rows[0];
    
    // Delete the route (no dependencies to check)
    const result = await pool.query('DELETE FROM route WHERE route_id = $1 RETURNING *', [routeId]);
    
    console.log(`✅ Deleted route: ${routeName.name_zh} (${routeName.name_en})`);
    res.json({
      success: true,
      message: 'Route deleted successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Error deleting route:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to delete route',
      details: err.message
    });
  }
});

} catch (error) {
  console.error('❌ Fatal error starting server:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}

