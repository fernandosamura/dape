import "../bootstrap";

module.exports = {
  define: {
    charset: "utf8mb4",
    collate: "utf8mb4_bin",
  },
  dialect: process.env.DB_DIALECT || "postgres",
  timezone: "-03:00",
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  logging: process.env.DB_DEBUG === "true" 
    ? (msg) => console.log(`[Sequelize] ${new Date().toISOString()}: ${msg}`) 
    : false,
  pool: {
    // Padrão seguro: 50 conexões máximas, 5 mínimas sempre abertas.
    // acquire: 30s antes de lançar SequelizeConnectionAcquireTimeoutError
    // (o valor anterior era 0 = sem timeout — pool podia travar indefinidamente).
    max:     parseInt(process.env.DB_POOL_MAX     || "50",    10),
    min:     parseInt(process.env.DB_POOL_MIN     || "5",     10),
    acquire: parseInt(process.env.DB_POOL_ACQUIRE || "30000", 10),
    idle:    parseInt(process.env.DB_POOL_IDLE    || "10000", 10),
  },
  retry: {
    max: 3,
    timeout: 30000,
    match: [
      /Deadlock/i,
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeConnectionTimedOutError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionAcquireTimeoutError/,
      /Operation timeout/,
      /ETIMEDOUT/
    ]
  },
};
