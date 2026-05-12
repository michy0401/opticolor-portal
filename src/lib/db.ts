import sql from "mssql";

const sqlConfig: sql.config = {
    user: process.env.AZURE_SQL_USER,
    password: process.env.AZURE_SQL_PASSWORD,
    database: process.env.AZURE_SQL_DATABASE,
    server: process.env.AZURE_SQL_SERVER || "",
    port: parseInt(process.env.AZURE_SQL_PORT || "1433", 10),
    connectionTimeout: 180000,
    requestTimeout: 180000,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 180000,
    },
    options: {
        encrypt: true,
        trustServerCertificate: false,
    },
};

export const getConnection = async () => {
    try {
        const pool = await sql.connect(sqlConfig);
        return pool;
    } catch (err) {
        console.error("Database connection failed", err);
        throw err;
    }
};
