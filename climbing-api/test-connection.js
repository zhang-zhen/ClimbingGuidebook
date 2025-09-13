require('dotenv').config();
const { Pool } = require('pg');

console.log('Testing PostgreSQL connection with new settings...');
console.log('Environment variables:');
console.log('DB_USER:', process.env.DB_USER || 'postgres');
console.log('DB_HOST:', process.env.DB_HOST || 'localhost');
console.log('DB_NAME:', process.env.DB_NAME || 'climbing_guide');
console.log('DB_PORT:', process.env.DB_PORT || 5432);

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'climbing_guide',
  port: process.env.DB_PORT || 5432,
});

async function testConnection() {
  try {
    console.log('\n🔍 Testing connection...');
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL!');
    
    const result = await client.query('SELECT current_database(), current_user, now()');
    console.log('✅ Query successful!');
    console.log('Database:', result.rows[0].current_database);
    console.log('User:', result.rows[0].current_user);
    console.log('Time:', result.rows[0].now);
    
    // Check for tables
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tables in database:');
    if (tableCheck.rows.length > 0) {
      tableCheck.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.log('  No tables found. You need to run your schema script.');
    }
    
    client.release();
    
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    console.error('Error code:', err.code);
    
    if (err.code === 'ECONNREFUSED') {
      console.log('\n💡 PostgreSQL may not be running. Try: brew services start postgresql');
    } else if (err.code === '3D000') {
      console.log('\n💡 Database "climbing_guidebook" does not exist.');
      console.log('Create it with: createdb -U zhenzhang climbing_guidebook');
    } else if (err.code === '28P01') {
      console.log('\n💡 Authentication failed for user "zhenzhang".');
      console.log('Make sure the user exists in PostgreSQL.');
    }
  } finally {
    await pool.end();
  }
}

testConnection();
