const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
};

const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

async function query(sqlQuery) {
    await poolConnect;
    try {
        const result = await pool.request().query(sqlQuery);
        return result.recordset;
    } catch (err) {
        console.error('SQL error:', err);
        throw err;
    }
}

module.exports = { query };