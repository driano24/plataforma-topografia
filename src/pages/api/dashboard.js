// src/pages/api/dashboard.js
import { connection } from '../../lib/db';

export async function GET({ request }) {
    const url = new URL(request.url);
    const username = url.searchParams.get('user');

    if (!username) {
        return new Response(JSON.stringify({ status: 'error', message: 'Falta usuario' }), { status: 400 });
    }

    try {
        const [users] = await connection.query('SELECT id, role FROM users WHERE username = ?', [username]);
        
        if (users.length === 0) {
            return new Response(JSON.stringify({ status: 'error', message: 'Usuario no encontrado' }));
        }
        
        const user = users[0];

        // ADMIN: Acceso total
        if (user.role === 'admin') {
            const [allModules] = await connection.query('SELECT code FROM modules');
            return new Response(JSON.stringify({
                status: 'success',
                licenses: allModules.map(m => m.code),
                role: 'admin'
            }));
        }

        // CLIENTE: Buscar licencias
        const [licenses] = await connection.query(`
            SELECT m.code 
            FROM licenses l
            JOIN modules m ON l.module_id = m.id
            WHERE l.user_id = ? 
            AND l.status = 'active' 
            AND l.expiration_date >= CURDATE()
        `, [user.id]);

        return new Response(JSON.stringify({
            status: 'success',
            licenses: licenses.map(l => l.code),
            role: user.role
        }));

    } catch (error) {
        return new Response(JSON.stringify({ status: 'error', message: error.message }), { status: 500 });
    }
}