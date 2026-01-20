import { connection } from '../../lib/db';

export async function POST({ request }) {
    try {
        const data = await request.json();
        const { username, password } = data; // Lo que escribiste en el login

        // 1. Buscar el usuario en la BD (Sintaxis PostgreSQL: Usamos $1 en lugar de ?)
        const [rows] = await connection.query('SELECT * FROM users WHERE username = $1', [username]);

        // Si no existe el usuario
        if (rows.length === 0) {
            return new Response(JSON.stringify({ status: 'error', message: 'Usuario no encontrado' }));
        }

        const user = rows[0];

        // 2. Comparar contraseñas
        // Nota: Asegúrate de que en la BD la contraseña esté guardada tal cual la escribes aquí
        if (user.password === password) {
            return new Response(JSON.stringify({ 
                status: 'success', 
                user: { 
                    id: user.id, 
                    username: user.username, 
                    role: user.role,
                    company_id: user.company_id // Agregamos esto por si es útil para el frontend
                } 
            }));
        } else {
            return new Response(JSON.stringify({ status: 'error', message: 'Contraseña incorrecta' }));
        }

    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ status: 'error', message: 'Error interno: ' + error.message }));
    }
}