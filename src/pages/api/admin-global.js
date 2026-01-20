import { connection } from '../../lib/db';

export async function POST({ request }) {
    try {
        const data = await request.json();
        const { action } = data;

        // --- 1. OBTENER DETALLES DE UN USUARIO (Para editar) ---
        if (action === 'get_user') {
            const [rows] = await connection.query('SELECT id, username, role, first_name, last_name, email, phone, company_id FROM users WHERE id = ?', [data.id]);
            return new Response(JSON.stringify({ status: 'success', user: rows[0] }));
        }

        // --- 2. LISTAR EMPRESAS ---
        if (action === 'list_companies') {
            const [rows] = await connection.query('SELECT id, name FROM companies ORDER BY name ASC');
            return new Response(JSON.stringify({ status: 'success', companies: rows }));
        }

        // --- 3. CREAR EMPRESA COMPLETA + ADMIN (MANAGER) ---
        if (action === 'create_company_full') {
            const { company_name, nit, address, username, password, first_name, last_name, email, phone } = data;

            // Validar usuario
            const [exists] = await connection.query('SELECT id FROM users WHERE username = ?', [username]);
            if (exists.length > 0) return new Response(JSON.stringify({ status: 'error', message: 'El usuario ya existe' }));

            // A. Crear Empresa
            const [compRes] = await connection.query(
                'INSERT INTO companies (name, nit, address) VALUES (?, ?, ?)',
                [company_name, nit, address]
            );
            const companyId = compRes.insertId;

            // B. Crear Usuario Admin (Rol MANAGER)
            // CAMBIO AQUÍ: Ahora se crea como "manager" en lugar de "operator"
            await connection.query(
                'INSERT INTO users (username, password, first_name, last_name, email, phone, role, company_id) VALUES (?, ?, ?, ?, ?, ?, "manager", ?)',
                [username, password, first_name, last_name, email, phone, companyId]
            );

            return new Response(JSON.stringify({ status: 'success', message: 'Empresa y Gerente registrados' }));
        }

        // --- 4. CREAR USUARIO EN EMPRESA (Roles Manuales) ---
        if (action === 'create_user') {
            const { username, password, role, company_id, first_name, last_name, email, phone } = data;
            
            const [exists] = await connection.query('SELECT id FROM users WHERE username = ?', [username]);
            if (exists.length > 0) return new Response(JSON.stringify({ status: 'error', message: 'Usuario ya existe' }));

            await connection.query(
                'INSERT INTO users (username, password, first_name, last_name, email, phone, role, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [username, password, first_name, last_name, email, phone, role, company_id]
            );
            return new Response(JSON.stringify({ status: 'success' }));
        }

        // --- 5. ACTUALIZAR USUARIO (Perfil, Clave, Rol) ---
        if (action === 'update_user') {
            const { id, username, password, role, first_name, last_name, email, phone } = data;

            let query = 'UPDATE users SET username=?, first_name=?, last_name=?, email=?, phone=?, role=?';
            let params = [username, first_name, last_name, email, phone, role];

            // Solo actualizamos contraseña si el campo no está vacío
            if (password && password.trim() !== '') {
                query += ', password=?';
                params.push(password);
            }

            query += ' WHERE id=?';
            params.push(id);

            await connection.query(query, params);
            return new Response(JSON.stringify({ status: 'success' }));
        }

        // --- 6. LISTAR USUARIOS (Tabla Principal) ---
        if (action === 'list_users') {
            const [users] = await connection.query(`
                SELECT u.id, u.username, u.first_name, u.last_name, u.role, c.name as company_name,
                GROUP_CONCAT(CONCAT(m.code, '|', m.name, '|', l.expiration_date) SEPARATOR ';;') as licencias_raw
                FROM users u
                LEFT JOIN companies c ON u.company_id = c.id
                LEFT JOIN licenses l ON u.id = l.user_id AND l.status = 'active' AND l.expiration_date >= CURDATE()
                LEFT JOIN modules m ON l.module_id = m.id
                GROUP BY u.id
                ORDER BY u.id DESC
            `);
            return new Response(JSON.stringify({ status: 'success', users }));
        }

        // --- 7. ASIGNAR / RENOVAR LICENCIA (Fechas Exactas) ---
        if (action === 'grant_license') {
            const { user_id, module_code, expiration_date } = data; // Recibe fecha YYYY-MM-DD

            const [mods] = await connection.query('SELECT id FROM modules WHERE code = ?', [module_code]);
            if (mods.length === 0) return new Response(JSON.stringify({ status: 'error', message: 'Módulo no existe' }));
            const moduleId = mods[0].id;

            // Borrar licencias anteriores de este módulo para limpiar duplicados
            await connection.query('DELETE FROM licenses WHERE user_id = ? AND module_id = ?', [user_id, moduleId]);
            
            // Insertar nueva con fecha específica
            await connection.query(
                'INSERT INTO licenses (user_id, module_id, start_date, expiration_date, status) VALUES (?, ?, CURDATE(), ?, "active")',
                [user_id, moduleId, expiration_date]
            );

            return new Response(JSON.stringify({ status: 'success' }));
        }

        // --- 8. REVOCAR LICENCIA (Quitar acceso) ---
        if (action === 'revoke_license') {
            const { user_id, module_code } = data;
            
            // Eliminar licencia basada en código de módulo
            await connection.query(`
                DELETE FROM licenses 
                WHERE user_id = ? AND module_id = (SELECT id FROM modules WHERE code = ? LIMIT 1)
            `, [user_id, module_code]);

            return new Response(JSON.stringify({ status: 'success' }));
        }

        return new Response(JSON.stringify({ status: 'error', message: 'Acción inválida' }));

    } catch (error) {
        console.error("API Global Error:", error);
        return new Response(JSON.stringify({ status: 'error', message: error.message }));
    }
}