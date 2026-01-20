import { connection } from '../../lib/db';
import fs from 'node:fs/promises';
import path from 'node:path';

// GET: Obtener Campañas, Puntos y Log
export async function GET({ request }) {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    try {
        if (action === 'get_projects_by_user') {
            const username = url.searchParams.get('user');
            // Buscamos la empresa del usuario y luego sus proyectos
            const [u] = await connection.query('SELECT company_id, role FROM users WHERE username = ?', [username]);
            
            if (u.length === 0) return new Response(JSON.stringify([]));
            
            let query = '';
            let params = [];

            if (u[0].role === 'admin') {
                query = 'SELECT id, name FROM projects ORDER BY created_at DESC';
            } else {
                query = 'SELECT id, name FROM projects WHERE company_id = ? ORDER BY created_at DESC';
                params = [u[0].company_id];
            }

            const [rows] = await connection.query(query, params);
            return new Response(JSON.stringify(rows));
        }

        if (action === 'get_campaigns') {
            const projectId = url.searchParams.get('project_id');
            // status = 'open' para que solo salgan las activas
            const [rows] = await connection.query('SELECT id, name FROM campaigns WHERE project_id = ? AND status = "open"', [projectId]);
            return new Response(JSON.stringify(rows));
        }

        if (action === 'get_campaign_log') {
            const campaignId = url.searchParams.get('campaign_id');
            const [rows] = await connection.query(
                'SELECT id, point_id, north, east, elevation, DATE_FORMAT(created_at, "%H:%i") as time FROM measurements WHERE campaign_id = ? ORDER BY id DESC LIMIT 10', 
                [campaignId]
            );
            return new Response(JSON.stringify(rows));
        }

        return new Response(JSON.stringify({ error: 'Acción no válida' }), { status: 400 });

    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

// POST: Guardar Puntos y Fotos
export async function POST({ request }) {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'upload_point') {
        try {
            const formData = await request.formData();
            
            const projectId = formData.get('project_id');
            const campaignId = formData.get('campaign_id');
            const pointId = formData.get('point_id');
            const north = formData.get('north');
            const east = formData.get('east');
            const elevation = formData.get('elevation');
            const photo = formData.get('photo'); // File object

            let photoPath = null;

            // 1. Manejo de la Foto
            if (photo && photo.size > 0) {
                // Definir ruta: public/uploads/YYYY-MM-DD
                const dateFolder = new Date().toISOString().split('T')[0];
                const uploadDir = path.join(process.cwd(), 'public', 'uploads', dateFolder);
                
                // Crear carpeta recursiva
                await fs.mkdir(uploadDir, { recursive: true });
                
                // Nombre único: TIMESTAMP_POINTID.jpg
                const fileName = `${Date.now()}_${pointId.replace(/\s+/g, '')}.jpg`;
                const arrayBuffer = await photo.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                
                await fs.writeFile(path.join(uploadDir, fileName), buffer);
                photoPath = `/uploads/${dateFolder}/${fileName}`;
            }

            // 2. Insertar en BD
            const query = `
                INSERT INTO measurements (project_id, campaign_id, point_id, north, east, elevation, photo_url, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            `;
            
            // Nota: en la DB la columna se llama 'photo_url' según tu esquema anterior
            await connection.query(query, [projectId, campaignId, pointId, north, east, elevation, photoPath]);

            return new Response(JSON.stringify({ status: 'success' }));

        } catch (error) {
            console.error(error);
            return new Response(JSON.stringify({ status: 'error', message: error.message }));
        }
    }
}