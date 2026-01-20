import { connection } from '../../lib/db';

export async function POST({ request }) {
    try {
        const contentType = request.headers.get("content-type");
        let body = {};
        let action = new URL(request.url).searchParams.get('action');

        // Handle both FormData (Files) and JSON
        if (contentType && contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            body = Object.fromEntries(formData);
            if (!action) action = body.action; 
        } else {
            body = await request.json();
            if (!action) action = body.action;
        }

        // --- 1. PROJECTS ---
        if (action === 'create_project') {
            const { name, client, logo, user } = body; 
            
            // Find creator's company
            const [u] = await connection.query('SELECT company_id FROM users WHERE username = ?', [user]);
            const companyId = u.length > 0 ? u[0].company_id : null;

            // Process logo name
            let logoName = '';
            if (logo && typeof logo === 'object' && logo.name) logoName = logo.name; 
            else if (typeof logo === 'string') logoName = logo;

            const [res] = await connection.query(
                'INSERT INTO projects (name, client_name, logo_url, company_id) VALUES (?, ?, ?, ?)',
                [name, client, logoName, companyId]
            );
            return new Response(JSON.stringify({ status: 'success', id: res.insertId }));
        }

        if (action === 'update_project') {
            const { id, name, client } = body;
            await connection.query('UPDATE projects SET name = ?, client_name = ? WHERE id = ?', [name, client, id]);
            return new Response(JSON.stringify({ status: 'success' }));
        }
        if (action === 'delete_project') {
            await connection.query('DELETE FROM projects WHERE id = ?', [body.id]);
            return new Response(JSON.stringify({ status: 'success' }));
        }

        // --- 2. MANUAL CAMPAIGNS ---
        if (action === 'create_campaign') {
            const { project_id, name } = body;
            await connection.query('INSERT INTO campaigns (project_id, name) VALUES (?, ?)', [project_id, name]);
            return new Response(JSON.stringify({ status: 'success' }));
        }
        if (action === 'toggle_campaign_status') {
            const { id, status } = body;
            await connection.query('UPDATE campaigns SET status = ? WHERE id = ?', [status, id]);
            return new Response(JSON.stringify({ status: 'success' }));
        }
        if (action === 'delete_campaign') {
            await connection.query('DELETE FROM campaigns WHERE id = ?', [body.id]);
            return new Response(JSON.stringify({ status: 'success' }));
        }

        // --- 3. MASSIVE CSV UPLOAD (DATE-BASED GROUPING) ---
        if (action === 'upload_csv') {
            const projectId = body.project_id;
            const file = body.csvFile;
            
            if (!file) return new Response(JSON.stringify({ status: 'error', message: 'No file uploaded' }));

            const text = await file.text();
            const lines = text.split('\n');
            
            // Dictionary to group points by date: { '2023-07-31': [points...], '2023-08-04': [points...] }
            const dataByDate = {}; 

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                // Skip header if present (starts with letters usually)
                if (line.toLowerCase().startsWith('id') || line.toLowerCase().startsWith('punto')) continue;

                const parts = line.split(',');
                // Expected Structure: ID(0), North(1), East(2), Elevation(3), Date(4)
                if (parts.length < 5) continue; 

                const pid = parts[0].trim();
                const n = parseFloat(parts[1]);
                const e = parseFloat(parts[2]);
                const z = parseFloat(parts[3] || 0);
                
                // Date Cleaning: Change '2023/07/31' to '2023-07-31' for MySQL
                let dateStr = parts[4].trim().replace(/\//g, '-'); 
                
                // Basic date validation
                if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    // Fallback to today if date is missing or malformed
                    dateStr = new Date().toISOString().split('T')[0];
                }

                if (!dataByDate[dateStr]) {
                    dataByDate[dateStr] = [];
                }

                dataByDate[dateStr].push({ pid, n, e, z });
            }

            // Sort found dates chronologically (Oldest to Newest)
            const sortedDates = Object.keys(dataByDate).sort(); 

            let totalCount = 0;
            let campaignsCreated = 0;

            // Check if project already has data to determine if we need a "Baseline"
            const [existingCamps] = await connection.query('SELECT count(*) as count FROM campaigns WHERE project_id = ?', [projectId]);
            const isProjectEmpty = existingCamps[0].count === 0;

            // Process each date group
            for (let i = 0; i < sortedDates.length; i++) {
                const dateKey = sortedDates[i];
                const points = dataByDate[dateKey];
                
                let campName = '';

                // NAMING LOGIC:
                // If project was empty AND this is the first chronological date -> BASELINE
                if (isProjectEmpty && i === 0) {
                    campName = 'Línea Base';
                } else {
                    campName = `Lectura ${dateKey}`;
                }

                // 1. Check if campaign exists (to prevent duplicates if file is re-uploaded)
                let [camps] = await connection.query('SELECT id FROM campaigns WHERE project_id = ? AND name = ?', [projectId, campName]);
                let campaignId;

                if (camps.length > 0) {
                    campaignId = camps[0].id;
                } else {
                    // 2. Create Campaign
                    const [resC] = await connection.query('INSERT INTO campaigns (project_id, name, created_at) VALUES (?, ?, ?)', [projectId, campName, dateKey]);
                    campaignId = resC.insertId;
                    campaignsCreated++;
                }

                // 3. Insert Points
                for (const p of points) {
                    // Optional: Delete previous measurement for this point in this specific campaign to ensure latest value
                    await connection.query('DELETE FROM measurements WHERE campaign_id = ? AND point_id = ?', [campaignId, p.pid]);

                    await connection.query(
                        'INSERT INTO measurements (project_id, campaign_id, point_id, north, east, elevation, latitude, longitude, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)',
                        [projectId, campaignId, p.pid, p.n, p.e, p.z, `${dateKey} 12:00:00`]
                    );
                    totalCount++;
                }
            }

            return new Response(JSON.stringify({ 
                status: 'success', 
                count: totalCount, 
                campaigns: campaignsCreated,
                dates_processed: sortedDates
            }));
        }

        // --- 4. DELETION TOOLS ---
        if (action === 'delete_measurement_id') {
            await connection.query('DELETE FROM measurements WHERE id = ?', [body.id]);
            return new Response(JSON.stringify({ status: 'success' }));
        }

        if (action === 'reset_project_data') {
            const { project_id } = body;
            await connection.query('DELETE FROM measurements WHERE project_id = ?', [project_id]);
            await connection.query('DELETE FROM campaigns WHERE project_id = ?', [project_id]);
            return new Response(JSON.stringify({ status: 'success' }));
        }

        return new Response(JSON.stringify({ status: 'error', message: 'Invalid Action' }));

    } catch (e) {
        console.error("API Admin Error:", e);
        return new Response(JSON.stringify({ status: 'error', message: e.message }));
    }
}

export async function GET({ request }) {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const projectId = url.searchParams.get('project_id');
    const currentUser = url.searchParams.get('user');

    try {
        if (action === 'get_projects') {
            const [u] = await connection.query('SELECT role, company_id FROM users WHERE username = ?', [currentUser]);
            
            if (u.length === 0) return new Response(JSON.stringify([]));
            
            const userRole = u[0].role;
            const userCompany = u[0].company_id;

            let query = '';
            let params = [];

            if (userRole === 'admin') {
                // SUPER ADMIN: Sees everything
                query = `
                    SELECT p.*, c.name as company_name 
                    FROM projects p 
                    LEFT JOIN companies c ON p.company_id = c.id 
                    ORDER BY p.created_at DESC
                `;
            } else {
                // MANAGER, OPERATOR, CLIENT (Viewer): See their company's projects
                query = `
                    SELECT * FROM projects 
                    WHERE company_id = ? 
                    ORDER BY created_at DESC
                `;
                params = [userCompany];
            }

            const [rows] = await connection.query(query, params);
            return new Response(JSON.stringify(rows));
        }

        if (action === 'get_campaigns') {
            // Sort ASC so "Línea Base" (oldest) appears first for calculations
            const [rows] = await connection.query('SELECT * FROM campaigns WHERE project_id = ? ORDER BY created_at ASC', [projectId]);
            return new Response(JSON.stringify(rows));
        }

        if (action === 'get_data') {
            const [rows] = await connection.query(`
                SELECT m.*, c.name as campaign_name 
                FROM measurements m 
                JOIN campaigns c ON m.campaign_id = c.id 
                WHERE m.project_id = ? 
                ORDER BY m.created_at DESC
            `, [projectId]);
            return new Response(JSON.stringify({ data: rows }));
        }

        return new Response(JSON.stringify({ status: 'error', message: 'Action not found' }));

    } catch (e) {
        return new Response(JSON.stringify({ status: 'error', message: e.message }));
    }
}