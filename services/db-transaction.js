"use strict";

const database = require("../config/database");

async function withTransaction(callback) {
  const pool = database.getPool();
  const connection = await pool.getConnection();

  const tx = {
    query: async (sql, params = []) => {
      const [rows] = await connection.execute(sql, params);
      return rows;
    }
  };

  try {
    await connection.beginTransaction();
    const result = await callback(tx, connection);
    await connection.commit();
    return result;
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { withTransaction };
