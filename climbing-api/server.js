// server.js
console.log('🚀 Starting climbing server...');

try {
  console.log('📦 Loading modules...');
  require('dotenv').config();
  const express = require('express');
  const { Pool } = require('pg');
  const cors = require('cors');
  const multer = require('multer');
  const path = require('path');
  
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

  // Configure multer for file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/areas/');
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `area-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });

  const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    },
    limits: { fileSize: 5 * 1024 * 1024 }
  });

  // Middleware
  console.log('🔧 Setting up middleware...');
  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static('uploads'));
  
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
app.post('/api/admin/areas', upload.array('pictures', 10), async (req, res) => {
  console.log('📥 POST /api/admin/areas');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      name_zh, name_en, description_zh, description_en,
      country_zh, country_en, province_zh, province_en,
      city_zh, city_en, latitude, longitude, elevation_meters,
      access_notes_zh, access_notes_en
    } = req.body;

    // Convert empty strings to null for numeric fields
    const processedLatitude = latitude && latitude !== '' ? parseFloat(latitude) : null;
    const processedLongitude = longitude && longitude !== '' ? parseFloat(longitude) : null;
    const processedElevation = elevation_meters && elevation_meters !== '' ? parseInt(elevation_meters) : null;

    // Insert area first
    const areaResult = await client.query(`
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
      city_zh, city_en, processedLatitude, processedLongitude, processedElevation,
      access_notes_zh, access_notes_en
    ]);

    const areaId = areaResult.rows[0].area_id;

    // Insert photos into photo table if any were uploaded
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        await client.query(`
          INSERT INTO photo (area_id, uploader_id, filename, file_size, photo_type, is_primary, caption_zh, caption_en)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          areaId,
          1, // Default uploader_id - you should replace this with actual user ID
          file.path, // Using file.path as filename since it includes the full path
          file.size,
          'overview', // Default photo_type for area photos
          i === 0, // First photo is primary
          `${name_zh} - 照片 ${i + 1}`, // Default Chinese caption
          `${name_en || name_zh} - Photo ${i + 1}` // Default English caption
        ]);
      }
      console.log(`📸 Uploaded ${req.files.length} photos for area: ${name_zh}`);
    }

    await client.query('COMMIT');

    console.log(`✅ Created new area: ${name_zh} (${name_en}) with ${req.files?.length || 0} photos`);
    res.json({
      success: true,
      message: `Area created successfully${req.files?.length ? ` with ${req.files.length} photos` : ''}`,
      data: areaResult.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating area:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create area',
      details: err.message
    });
  } finally {
    client.release();
  }
});

// Add new crag
app.post('/api/admin/crags', async (req, res) => {
  console.log('📥 POST /api/admin/crags');
  console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
  try {
    const {
      area_id, name_zh, name_en, description_zh, description_en,
      latitude, longitude, approach_time_minutes, approach_difficulty,
      rock_type_zh, rock_type_en, orientation, wall_height_meters,
      parking_latitude, parking_longitude, parking_notes_zh, parking_notes_en
    } = req.body;

    // Convert empty strings to null for numeric fields
    const processedAreaId = area_id && area_id !== '' ? parseInt(area_id) : null;
    const processedLatitude = latitude && latitude !== '' ? parseFloat(latitude) : null;
    const processedLongitude = longitude && longitude !== '' ? parseFloat(longitude) : null;
    const processedApproachTime = approach_time_minutes && approach_time_minutes !== '' ? parseInt(approach_time_minutes) : null;
    const processedApproachDifficulty = approach_difficulty && approach_difficulty !== '' ? parseInt(approach_difficulty) : null;
    const processedWallHeight = wall_height_meters && wall_height_meters !== '' ? parseInt(wall_height_meters) : null;
    const processedParkingLatitude = parking_latitude && parking_latitude !== '' ? parseFloat(parking_latitude) : null;
    const processedParkingLongitude = parking_longitude && parking_longitude !== '' ? parseFloat(parking_longitude) : null;

    // Convert empty strings to null for optional text fields
    const processedNameEn = name_en && name_en.trim() !== '' ? name_en : null;
    const processedOrientation = orientation && orientation.trim() !== '' ? orientation : null;

    const result = await pool.query(`
      INSERT INTO crag (
        area_id, name_zh, name_en, description_zh, description_en,
        latitude, longitude, approach_time_minutes, approach_difficulty,
        rock_type_zh, rock_type_en, orientation, wall_height_meters,
        parking_latitude, parking_longitude, parking_notes_zh, parking_notes_en
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      processedAreaId, name_zh, processedNameEn, description_zh, description_en,
      processedLatitude, processedLongitude, processedApproachTime, processedApproachDifficulty,
      rock_type_zh, rock_type_en, processedOrientation, processedWallHeight,
      processedParkingLatitude, processedParkingLongitude, parking_notes_zh, parking_notes_en
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

// Add new wall
app.post('/api/admin/walls', async (req, res) => {
  console.log('📥 POST /api/admin/walls');
  try {
    const {
      crag_id, name_zh, name_en, description_zh, description_en,
      orientation, wall_height_meters, wall_order
    } = req.body;

    const processedCragId = crag_id && crag_id !== '' ? parseInt(crag_id) : null;
    const processedWallHeight = wall_height_meters && wall_height_meters !== '' ? parseInt(wall_height_meters) : null;
    const processedWallOrder = wall_order && wall_order !== '' ? parseInt(wall_order) : 1;

    const result = await pool.query(`
      INSERT INTO wall (
        crag_id, name_zh, name_en, description_zh, description_en,
        orientation, wall_height_meters, wall_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      processedCragId, name_zh, name_en, description_zh, description_en,
      orientation || null, processedWallHeight, processedWallOrder
    ]);

    console.log(`✅ Created new wall: ${name_zh} (${name_en})`);
    res.json({
      success: true,
      message: 'Wall created successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Error creating wall:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create wall',
      details: err.message
    });
  }
});

// Add new sector
app.post('/api/admin/sectors', async (req, res) => {
  console.log('📥 POST /api/admin/sectors');
  try {
    const {
      crag_id, wall_id, name_zh, name_en, description_zh, description_en,
      sector_order, latitude, longitude
    } = req.body;

    // Convert empty strings to null for numeric fields
    const processedCragId = crag_id && crag_id !== '' ? parseInt(crag_id) : null;
    const processedWallId = wall_id && wall_id !== '' ? parseInt(wall_id) : null;
    const processedSectorOrder = sector_order && sector_order !== '' ? parseInt(sector_order) : null;
    const processedLatitude = latitude && latitude !== '' ? parseFloat(latitude) : null;
    const processedLongitude = longitude && longitude !== '' ? parseFloat(longitude) : null;

    const result = await pool.query(`
      INSERT INTO sector (
        crag_id, wall_id, name_zh, name_en, description_zh, description_en,
        sector_order, latitude, longitude
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      processedCragId, processedWallId, name_zh, name_en, description_zh, description_en,
      processedSectorOrder, processedLatitude, processedLongitude
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
      sector_id, crag_id, name_zh, name_en, grade,
      length_meters, bolt_count, rating, route_order,
      description_zh, description_en
    } = req.body;

    const processedSectorId = sector_id && sector_id !== '' ? parseInt(sector_id) : null;
    const processedCragId = crag_id && crag_id !== '' ? parseInt(crag_id) : null;
    const processedLengthMeters = length_meters && length_meters !== '' ? parseInt(length_meters) : null;
    const processedBoltCount = bolt_count && bolt_count !== '' ? parseInt(bolt_count) : null;
    const processedRating = rating && rating !== '' ? parseInt(rating) : null;
    const processedRouteOrder = route_order && route_order !== '' ? parseInt(route_order) : null;
    const processedNameEn = name_en ? name_en.trim() : '';

    const result = await pool.query(`
      INSERT INTO route (
        sector_id, crag_id, name_zh, name_en, grade,
        length_meters, bolt_count, rating, route_order,
        description_zh, description_en
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      processedSectorId, processedCragId, name_zh, processedNameEn, grade || null,
      processedLengthMeters, processedBoltCount, processedRating, processedRouteOrder,
      description_zh, description_en
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

// Get all walls (for dropdown)
app.get('/api/admin/walls', async (req, res) => {
  console.log('📥 GET /api/admin/walls');
  try {
    const result = await pool.query(`
      SELECT 
        w.wall_id, 
        w.name_zh, 
        w.name_en, 
        c.name_zh AS crag_name_zh,
        c.name_en AS crag_name_en,
        a.name_zh AS area_name_zh
      FROM wall w
      JOIN crag c ON w.crag_id = c.crag_id
      JOIN area a ON c.area_id = a.area_id
      ORDER BY a.name_zh, c.name_zh, w.wall_order
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error('❌ Error fetching walls:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch walls',
      details: err.message
    });
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
      SELECT r.route_id, r.name_zh, r.name_en, r.grade,
             r.length_meters, r.bolt_count, r.rating,
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

// ==========================================
// INDIVIDUAL ITEM GET ENDPOINTS (for editing)
// ==========================================

// Get single area by ID
app.get('/api/admin/areas/:id', async (req, res) => {
  console.log(`📥 GET /api/admin/areas/${req.params.id}`);
  try {
    const areaId = parseInt(req.params.id);
    const result = await pool.query('SELECT * FROM area WHERE area_id = $1', [areaId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Area not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Error fetching area:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch area',
      details: err.message
    });
  }
});

// Get single crag by ID
app.get('/api/admin/crags/:id', async (req, res) => {
  console.log(`📥 GET /api/admin/crags/${req.params.id}`);
  try {
    const cragId = parseInt(req.params.id);
    const result = await pool.query('SELECT * FROM crag WHERE crag_id = $1', [cragId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Crag not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Error fetching crag:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch crag',
      details: err.message
    });
  }
});

// Get all walls in a crag
app.get('/api/admin/crags/:cragId/walls', async (req, res) => {
  console.log(`📥 GET /api/admin/crags/${req.params.cragId}/walls`);
  try {
    const result = await pool.query(`
      SELECT * FROM wall 
      WHERE crag_id = $1 
      ORDER BY wall_order, name_zh
    `, [req.params.cragId]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (err) {
    console.error('❌ Error fetching walls:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch walls',
      details: err.message
    });
  }
});


// Get single sector by ID
app.get('/api/admin/sectors/:id', async (req, res) => {
  console.log(`📥 GET /api/admin/sectors/${req.params.id}`);
  try {
    const sectorId = parseInt(req.params.id);
    const result = await pool.query('SELECT * FROM sector WHERE sector_id = $1', [sectorId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sector not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Error fetching sector:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sector',
      details: err.message
    });
  }
});

// Get single route by ID
app.get('/api/admin/routes/:id', async (req, res) => {
  console.log(`📥 GET /api/admin/routes/${req.params.id}`);
  try {
    const routeId = parseInt(req.params.id);
    const result = await pool.query('SELECT * FROM route WHERE route_id = $1', [routeId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Error fetching route:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch route',
      details: err.message
    });
  }
});

// Get single wall by ID
app.get('/api/admin/walls/:id', async (req, res) => {
  console.log(`📥 GET /api/admin/walls/${req.params.id}`);
  try {
    const wallId = parseInt(req.params.id);
    const result = await pool.query('SELECT * FROM wall WHERE wall_id = $1', [wallId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Wall not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('❌ Error fetching wall:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch wall', details: err.message });
  }
});

// Update wall
app.put('/api/admin/walls/:id', async (req, res) => {
  console.log(`📥 PUT /api/admin/walls/${req.params.id}`);
  try {
    const wallId = parseInt(req.params.id);
    const { crag_id, name_zh, name_en, description_zh, description_en, orientation, wall_height_meters, wall_order } = req.body;

    const processedCragId = crag_id && crag_id !== '' ? parseInt(crag_id) : null;
    const processedWallHeight = wall_height_meters && wall_height_meters !== '' ? parseInt(wall_height_meters) : null;
    const processedWallOrder = wall_order && wall_order !== '' ? parseInt(wall_order) : null;

    const result = await pool.query(`
      UPDATE wall SET
        crag_id = $1, name_zh = $2, name_en = $3, description_zh = $4, description_en = $5,
        orientation = $6, wall_height_meters = $7, wall_order = $8, updated_date = CURRENT_TIMESTAMP
      WHERE wall_id = $9
      RETURNING *
    `, [processedCragId, name_zh, name_en, description_zh, description_en,
        orientation || null, processedWallHeight, processedWallOrder, wallId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Wall not found' });
    }
    console.log(`✅ Updated wall: ${name_zh}`);
    res.json({ success: true, message: 'Wall updated successfully', data: result.rows[0] });
  } catch (err) {
    console.error('❌ Error updating wall:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update wall', details: err.message });
  }
});

// Delete wall
app.delete('/api/admin/walls/:id', async (req, res) => {
  console.log(`📥 DELETE /api/admin/walls/${req.params.id}`);
  try {
    const wallId = parseInt(req.params.id);

    const checkResult = await pool.query('SELECT name_zh FROM wall WHERE wall_id = $1', [wallId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Wall not found' });
    }

    const dependentSectors = await pool.query('SELECT COUNT(*) as count FROM sector WHERE wall_id = $1', [wallId]);
    if (parseInt(dependentSectors.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete wall. It has ${dependentSectors.rows[0].count} dependent sector(s). Delete all sectors in this wall first.`
      });
    }

    const result = await pool.query('DELETE FROM wall WHERE wall_id = $1 RETURNING *', [wallId]);
    console.log(`✅ Deleted wall: ${checkResult.rows[0].name_zh}`);
    res.json({ success: true, message: 'Wall deleted successfully', data: result.rows[0] });
  } catch (err) {
    console.error('❌ Error deleting wall:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete wall', details: err.message });
  }
});

// Get sectors for a wall
app.get('/api/admin/walls/:wallId/sectors', async (req, res) => {
  console.log(`📥 GET /api/admin/walls/${req.params.wallId}/sectors`);
  try {
    const result = await pool.query(`
      SELECT * FROM sector 
      WHERE wall_id = $1 
      ORDER BY sector_order, name_zh
    `, [req.params.wallId]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (err) {
    console.error('❌ Error fetching sectors:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sectors',
      details: err.message
    });
  }
});

// ==========================================
// UPDATE ENDPOINTS (PUT)
// ==========================================

// Update area
app.put('/api/admin/areas/:id', async (req, res) => {
  console.log(`📥 PUT /api/admin/areas/${req.params.id}`);
  try {
    const areaId = parseInt(req.params.id);
    const {
      name_zh, name_en, description_zh, description_en,
      country_zh, country_en, province_zh, province_en,
      city_zh, city_en, latitude, longitude, elevation_meters,
      access_notes_zh, access_notes_en
    } = req.body;

    // Convert empty strings to null for numeric fields
    const processedLatitude = latitude && latitude !== '' ? parseFloat(latitude) : null;
    const processedLongitude = longitude && longitude !== '' ? parseFloat(longitude) : null;
    const processedElevation = elevation_meters && elevation_meters !== '' ? parseInt(elevation_meters) : null;

    const result = await pool.query(`
      UPDATE area SET
        name_zh = $1, name_en = $2, description_zh = $3, description_en = $4,
        country_zh = $5, country_en = $6, province_zh = $7, province_en = $8,
        city_zh = $9, city_en = $10, latitude = $11, longitude = $12, elevation_meters = $13,
        access_notes_zh = $14, access_notes_en = $15, updated_date = CURRENT_TIMESTAMP
      WHERE area_id = $16
      RETURNING *
    `, [
      name_zh, name_en, description_zh, description_en,
      country_zh, country_en, province_zh, province_en,
      city_zh, city_en, processedLatitude, processedLongitude, processedElevation,
      access_notes_zh, access_notes_en, areaId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Area not found'
      });
    }

    console.log(`✅ Updated area: ${name_zh} (${name_en})`);
    res.json({
      success: true,
      message: 'Area updated successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Error updating area:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update area',
      details: err.message
    });
  }
});

// Update crag
app.put('/api/admin/crags/:id', async (req, res) => {
  console.log(`📥 PUT /api/admin/crags/${req.params.id}`);
  try {
    const cragId = parseInt(req.params.id);
    const {
      area_id, name_zh, name_en, description_zh, description_en,
      latitude, longitude, approach_time_minutes, approach_difficulty,
      rock_type_zh, rock_type_en, orientation, wall_height_meters
    } = req.body;

    // Convert empty strings to null for numeric fields
    const processedAreaId = area_id && area_id !== '' ? parseInt(area_id) : null;
    const processedLatitude = latitude && latitude !== '' ? parseFloat(latitude) : null;
    const processedLongitude = longitude && longitude !== '' ? parseFloat(longitude) : null;
    const processedApproachTime = approach_time_minutes && approach_time_minutes !== '' ? parseInt(approach_time_minutes) : null;
    const processedApproachDifficulty = approach_difficulty && approach_difficulty !== '' ? parseInt(approach_difficulty) : null;
    const processedWallHeight = wall_height_meters && wall_height_meters !== '' ? parseInt(wall_height_meters) : null;

    // Convert empty strings to null for optional text fields
    const processedNameEn = name_en && name_en.trim() !== '' ? name_en : null;
    const processedOrientation = orientation && orientation.trim() !== '' ? orientation : null;

    const result = await pool.query(`
      UPDATE crag SET
        area_id = $1, name_zh = $2, name_en = $3, description_zh = $4, description_en = $5,
        latitude = $6, longitude = $7, approach_time_minutes = $8, approach_difficulty = $9,
        rock_type_zh = $10, rock_type_en = $11, orientation = $12, wall_height_meters = $13,
        updated_date = CURRENT_TIMESTAMP
      WHERE crag_id = $14
      RETURNING *
    `, [
      processedAreaId, name_zh, processedNameEn, description_zh, description_en,
      processedLatitude, processedLongitude, processedApproachTime, processedApproachDifficulty,
      rock_type_zh, rock_type_en, processedOrientation, processedWallHeight, cragId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Crag not found'
      });
    }

    console.log(`✅ Updated crag: ${name_zh} (${name_en})`);
    res.json({
      success: true,
      message: 'Crag updated successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Error updating crag:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update crag',
      details: err.message
    });
  }
});

// Update sector
app.put('/api/admin/sectors/:id', async (req, res) => {
  console.log(`📥 PUT /api/admin/sectors/${req.params.id}`);
  try {
    const sectorId = parseInt(req.params.id);
    const {
      crag_id, name_zh, name_en, description_zh, description_en,
      sector_order, latitude, longitude
    } = req.body;

    // Convert empty strings to null for numeric fields
    const processedCragId = crag_id && crag_id !== '' ? parseInt(crag_id) : null;
    const processedSectorOrder = sector_order && sector_order !== '' ? parseInt(sector_order) : null;
    const processedLatitude = latitude && latitude !== '' ? parseFloat(latitude) : null;
    const processedLongitude = longitude && longitude !== '' ? parseFloat(longitude) : null;

    const result = await pool.query(`
      UPDATE sector SET
        crag_id = $1, name_zh = $2, name_en = $3, description_zh = $4, description_en = $5,
        sector_order = $6, latitude = $7, longitude = $8, updated_date = CURRENT_TIMESTAMP
      WHERE sector_id = $9
      RETURNING *
    `, [
      processedCragId, name_zh, name_en, description_zh, description_en,
      processedSectorOrder, processedLatitude, processedLongitude, sectorId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sector not found'
      });
    }

    console.log(`✅ Updated sector: ${name_zh} (${name_en})`);
    res.json({
      success: true,
      message: 'Sector updated successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Error updating sector:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update sector',
      details: err.message
    });
  }
});

// Update route
app.put('/api/admin/routes/:id', async (req, res) => {
  console.log(`📥 PUT /api/admin/routes/${req.params.id}`);
  try {
    const routeId = parseInt(req.params.id);
    const {
      sector_id, crag_id, name_zh, name_en, grade,
      length_meters, bolt_count, rating, route_order,
      description_zh, description_en
    } = req.body;

    const processedSectorId = sector_id && sector_id !== '' ? parseInt(sector_id) : null;
    const processedCragId = crag_id && crag_id !== '' ? parseInt(crag_id) : null;
    const processedLengthMeters = length_meters && length_meters !== '' ? parseInt(length_meters) : null;
    const processedBoltCount = bolt_count && bolt_count !== '' ? parseInt(bolt_count) : null;
    const processedRating = rating && rating !== '' ? parseInt(rating) : null;
    const processedRouteOrder = route_order && route_order !== '' ? parseInt(route_order) : null;
    const processedNameEn = name_en ? name_en.trim() : '';

    const result = await pool.query(`
      UPDATE route SET
        sector_id = $1, crag_id = $2, name_zh = $3, name_en = $4, grade = $5,
        length_meters = $6, bolt_count = $7, rating = $8, route_order = $9,
        description_zh = $10, description_en = $11, updated_date = CURRENT_TIMESTAMP
      WHERE route_id = $12
      RETURNING *
    `, [
      processedSectorId, processedCragId, name_zh, processedNameEn, grade || null,
      processedLengthMeters, processedBoltCount, processedRating, processedRouteOrder,
      description_zh, description_en, routeId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    console.log(`✅ Updated route: ${name_zh} (${name_en})`);
    res.json({
      success: true,
      message: 'Route updated successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Error updating route:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update route',
      details: err.message
    });
  }
});

} catch (error) {
  console.error('❌ Fatal error starting server:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}

