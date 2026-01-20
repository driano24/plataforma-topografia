import pg from 'pg';
const { Pool } = pg;

// Configuración de conexión (Usa los datos que acabamos de crear en el VPS)
export const pool = new Pool({
    user: 'vvst_user',
    host: 'localhost', // Cuando subamos al VPS será localhost. En tu PC, pon la IP del VPS si habilitaste acceso remoto.
    database: 'vvst_db',
    password: 'tu_contraseña_secreta', // LA MISMA QUE PUSISTE EN EL PASO 3
    port: 5432,
});

// Adaptador para mantener compatibilidad con tu código actual
// Postgres usa $1, $2... MySQL usaba ?, ?... aquí normalizamos un poco
export const connection = {
    query: async (text, params) => {
        try {
            const res = await pool.query(text, params);
            // Postgres devuelve las filas en res.rows
            // MySQL devolvía [rows, fields]. Mantenemos el formato array para no romper tu código.
            return [res.rows, null]; 
        } catch (e) {
            console.error("Database Error:", e.message);
            throw e;
        }
    }
};