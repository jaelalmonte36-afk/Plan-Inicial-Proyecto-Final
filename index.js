// Cargar variables de entorno
require('dotenv').config();

const express = require('express');
const path = require('path');
const exphbs = require('express-handlebars');
const mysql = require('mysql2/promise');
const crypto = require('crypto');

const app = express();

// Puerto
const port = process.env.PORT || 3000;

const db = mysql.createPool({
    host: process.env.DB_HOST || process.env.db_host,
    user: process.env.DB_USER || process.env.db_user,
    password: process.env.DB_PASSWORD || process.env.db_password,
    database: process.env.DB_NAME || process.env.db_name,
    port: process.env.DB_PORT || process.env.db_port || 3306,
    waitForConnections: true,
    connectionLimit: 10,
});

const sessions = new Map();
const sessionCookieName = 'mus_session';
const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
    if (!storedPassword || !storedPassword.includes(':')) return false;

    const [salt, storedHash] = storedPassword.split(':');
    const testHash = hashPassword(password, salt).split(':')[1];

    return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(testHash, 'hex'));
}

function getCookie(req, name) {
    const cookies = req.headers.cookie?.split(';') || [];
    const cookie = cookies.find((item) => item.trim().startsWith(`${name}=`));
    return cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
}

function createSession(res, user) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
        id_usuario: user.id_usuario,
        rol: user.rol,
        username: user.username,
        display_name: user.nombre || user.display_name || user.username,
    });
    res.setHeader('Set-Cookie', `${sessionCookieName}=${token}; HttpOnly; Path=/; SameSite=Lax`);
}

function usernameFromName(name) {
    const base = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    return base || 'cliente';
}

async function getUniqueUsername(connection, name) {
    const base = usernameFromName(name);
    let username = base;
    let suffix = 1;

    while (true) {
        const [existing] = await connection.query(
            'SELECT id_usuario FROM usuario WHERE username = ? LIMIT 1',
            [username]
        );

        if (existing.length === 0) return username;

        suffix += 1;
        username = `${base}_${suffix}`;
    }
}

function formatDate(value) {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatMoney(value) {
    const amount = Number(value || 0);
    return amount.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
    });
}

function statusClass(value) {
    return String(value || 'pending')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'pending';
}

function toPlainNumber(value) {
    return Number(value || 0);
}

function buildProjectChart(rows) {
    const years = [...new Set(rows.map((row) => Number(row.year)))].sort((a, b) => a - b);

    return {
        months: monthLabels,
        years,
        datasets: years.map((year) => ({
            year,
            values: monthLabels.map((_, index) => {
                const item = rows.find((row) => Number(row.year) === year && Number(row.month) === index + 1);
                return item ? Number(item.total) : 0;
            }),
        })),
    };
}

// CONFIGURACIÓN HANDLEBARS
app.engine(
    'hbs',
    exphbs.engine({
        extname: '.hbs',
        defaultLayout: 'main',
        layoutsDir: path.join(__dirname, 'views', 'layouts'),
        partialsDir: path.join(__dirname, 'views', 'partials'),
        helpers: {
            formatDate,
            money: formatMoney,
            statusClass,
            json: (context) => JSON.stringify(context).replace(/</g, '\\u003c'),
        },
    })
);

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// =======================
// MIDDLEWARES
// ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    const token = getCookie(req, sessionCookieName);
    req.session = token && sessions.has(token) ? { user: sessions.get(token), token } : {};
    res.locals.currentUser = req.session.user;
    res.locals.isAdmin = req.session.user?.rol === 'admin';
    next();
});
app.use(express.static(path.join(__dirname, 'public')));

function requireAdmin(req, res, next) {
    if (req.session?.user?.rol !== 'admin') {
        return res.status(403).render('central', {
            title: 'Access denied',
            pageClass: 'access-denied-page',
        });
    }

    return next();
}

function requireAdminApi(req, res, next) {
    if (req.session?.user?.rol !== 'admin') {
        return res.status(403).json({
            message: 'Admin access required.',
        });
    }

    return next();
}

function requireClient(req, res, next) {
    if (!req.session?.user) {
        return res.redirect('/login');
    }

    if (req.session.user.rol !== 'cliente') {
        return res.status(403).render('central', {
            title: 'Client access required',
            pageClass: 'access-denied-page',
        });
    }

    return next();
}

function requireClientApi(req, res, next) {
    if (!req.session?.user) {
        return res.status(401).json({
            message: 'You must be logged in as a client.',
        });
    }

    if (req.session.user.rol !== 'cliente') {
        return res.status(403).json({
            message: 'Only clients can use this option.',
        });
    }

    return next();
}

// =======================
// RUTAS
// =======================

// Página principal
app.get('/', (req, res) => {
    res.render('central'); // views/central.hbs
});

const servicePages = {
    painting: {
        title: 'Painting Services',
        pageClass: 'painting-service-page',
    },
    electrical: {
        title: 'Electrical Repair',
        pageClass: 'electrical-service-page',
    },
    general: {
        title: 'General Repair',
        pageClass: 'general-service-page',
    },
    cleaning: {
        title: 'Cleaning Services',
        pageClass: 'cleaning-service-page',
    },
};

Object.entries(servicePages).forEach(([route, data]) => {
    app.get(`/${route}`, (req, res) => {
        res.render(route, {
            ...data,
            servicePage: true,
        });
    });
});

app.get('/login', (req, res) => {
    res.render('login', {
        title: 'Login',
        pageClass: 'auth-page login-page',
        authPage: true,
    });
});

app.get('/signup', (req, res) => {
    res.render('signup', {
        title: 'Sign Up',
        pageClass: 'auth-page signup-page',
        authPage: true,
    });
});

app.get('/my-requests', requireClient, async (req, res) => {
    const [requests] = await db.query(
        `SELECT
            i.id_inspeccion,
            i.fecha AS inspection_date,
            i.condicion_general,
            i.notas,
            i.costo_estimado,
            d.num_casa,
            d.calle,
            d.ciudad,
            d.estado,
            d.codigo_postal,
            py.id_proyecto,
            py.fecha_inicio,
            py.fecha_estimada_fin,
            ct.id_contrato,
            ct.status AS contract_status,
            ct.monto_acordado,
            cc.id_certificado,
            cc.fecha_finalizacion,
            r.id_resena,
            r.opinion,
            r.fecha AS review_date
        FROM inspeccion i
        JOIN propiedad pr ON pr.id_propiedad = i.id_propiedad
        JOIN direccion d ON d.id_direccion = pr.id_direccion
        LEFT JOIN proyecto py ON py.id_inspeccion = i.id_inspeccion
        LEFT JOIN contrato ct ON ct.id_proyecto = py.id_proyecto
        LEFT JOIN certificado_complecion cc ON cc.id_proyecto = py.id_proyecto
        LEFT JOIN resena r ON r.id_certificado = cc.id_certificado
        WHERE i.id_usuario = ?
        ORDER BY i.id_inspeccion DESC`,
        [req.session.user.id_usuario]
    );

    const normalizedRequests = requests.map((request) => {
        let status = 'Inspection sent';
        let statusText = 'Waiting for Michelle Ultra Services review.';

        if (request.id_proyecto && request.contract_status === 'completado') {
            status = 'Completed';
            statusText = 'Your project is completed. You can leave a review if you have not already.';
        } else if (request.id_proyecto) {
            status = 'Project active';
            statusText = 'Your inspection was approved and a project is active.';
        }

        return {
            ...request,
            status,
            statusText,
            canReview: Boolean(request.id_certificado && !request.id_resena),
        };
    });

    res.render('client-requests', {
        title: 'My Requests',
        pageClass: 'client-page',
        clientPage: true,
        requests: normalizedRequests,
        contactEmail: 'michelleultraservices@gmail.com',
        contactPhone: '(813) 555-0101',
    });
});

app.get('/admin', requireAdmin, async (req, res) => {
    const [[summary]] = await db.query(
        `SELECT
            (SELECT COUNT(*) FROM inspeccion) AS inspections,
            (SELECT COUNT(*) FROM v_inspecciones_sin_proyecto) AS pendingInspections,
            (SELECT COUNT(*) FROM proyecto) AS projects,
            (SELECT COUNT(*) FROM contrato WHERE status = 'activo') AS activeContracts,
            (SELECT COUNT(*) FROM factura_compra) AS purchases,
            (SELECT COALESCE(SUM(total), 0) FROM pago) AS paymentTotal`
    );

    const [recentInspections] = await db.query(
        `SELECT
            i.id_inspeccion,
            i.fecha,
            i.condicion_general,
            p.nombre AS cliente,
            py.id_proyecto
        FROM inspeccion i
        JOIN usuario u ON u.id_usuario = i.id_usuario
        JOIN persona p ON p.id_persona = u.id_persona
        LEFT JOIN proyecto py ON py.id_inspeccion = i.id_inspeccion
        ORDER BY i.id_inspeccion DESC
        LIMIT 6`
    );

    const processes = [
        {
            title: 'Inspections',
            text: 'Review client inspection requests and follow monthly project intake.',
            href: '/admin/inspections',
            icon: 'fa-magnifying-glass-chart',
            metric: `${summary.pendingInspections} pending`,
        },
        {
            title: 'Projects & contracts',
            text: 'Convert approved inspections into active projects and contracts.',
            href: '/admin/projects',
            icon: 'fa-file-signature',
            metric: `${summary.activeContracts} active`,
        },
        {
            title: 'Invoices & payments',
            text: 'Create client invoices and register payments against contracts.',
            href: '/admin/payments',
            icon: 'fa-money-check-dollar',
            metric: formatMoney(summary.paymentTotal),
        },
        {
            title: 'Material purchases',
            text: 'Record provider invoices with material quantity and unit price.',
            href: '/admin/purchases',
            icon: 'fa-cart-flatbed',
            metric: `${summary.purchases} invoices`,
        },
        {
            title: 'Database control',
            text: 'Inspect views, procedures, triggers, key tables and manual catalogs.',
            href: '/admin/database',
            icon: 'fa-database',
            metric: 'DB tools',
        },
    ];

    res.render('admin-dashboard', {
        title: 'Admin Processes',
        pageClass: 'admin-page',
        adminPage: true,
        summary,
        processes,
        recentInspections,
    });
});

app.get('/admin/inspections', requireAdmin, async (req, res) => {
    const [inspections] = await db.query(
        `SELECT
            i.id_inspeccion,
            i.fecha,
            i.condicion_general,
            i.notas,
            i.costo_estimado,
            p.nombre AS cliente,
            p.email,
            py.id_proyecto,
            d.num_casa,
            d.calle,
            d.ciudad,
            d.estado,
            d.codigo_postal
        FROM inspeccion i
        JOIN usuario u ON u.id_usuario = i.id_usuario
        JOIN persona p ON p.id_persona = u.id_persona
        JOIN propiedad pr ON pr.id_propiedad = i.id_propiedad
        JOIN direccion d ON d.id_direccion = pr.id_direccion
        LEFT JOIN proyecto py ON py.id_inspeccion = i.id_inspeccion
        ORDER BY i.id_inspeccion DESC
        LIMIT 100`
    );

    const [[inspectionStats]] = await db.query(
        `SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN py.id_proyecto IS NULL THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN py.id_proyecto IS NOT NULL THEN 1 ELSE 0 END) AS converted,
            COALESCE(SUM(i.costo_estimado), 0) AS estimatedTotal
        FROM inspeccion i
        LEFT JOIN proyecto py ON py.id_inspeccion = i.id_inspeccion`
    );

    const [projectChartRows] = await db.query(
        `SELECT
            YEAR(fecha_inicio) AS year,
            MONTH(fecha_inicio) AS month,
            COUNT(*) AS total
        FROM proyecto
        GROUP BY YEAR(fecha_inicio), MONTH(fecha_inicio)
        ORDER BY year, month`
    );

    res.render('admin-inspections', {
        title: 'Inspection Process',
        pageClass: 'admin-page',
        adminPage: true,
        inspections,
        inspectionStats,
        projectChart: buildProjectChart(projectChartRows),
    });
});

app.get('/admin/projects', requireAdmin, async (req, res) => {
    const [pendingInspections] = await db.query(
        `SELECT
            i.id_inspeccion,
            i.fecha,
            i.condicion_general,
            i.costo_estimado,
            p.nombre AS cliente,
            c.id_cliente,
            pr.id_propiedad,
            CONCAT(d.num_casa, ' ', d.calle, ', ', d.ciudad, ' ', d.estado, ' ', d.codigo_postal) AS address
        FROM inspeccion i
        JOIN usuario u ON u.id_usuario = i.id_usuario
        JOIN persona p ON p.id_persona = u.id_persona
        LEFT JOIN cliente c ON c.id_persona = u.id_persona
        JOIN propiedad pr ON pr.id_propiedad = i.id_propiedad
        JOIN direccion d ON d.id_direccion = pr.id_direccion
        LEFT JOIN proyecto py ON py.id_inspeccion = i.id_inspeccion
        WHERE py.id_proyecto IS NULL
        ORDER BY i.id_inspeccion DESC
        LIMIT 100`
    );

    const [projects] = await db.query(
        `SELECT
            py.id_proyecto,
            py.fecha_inicio,
            py.fecha_estimada_fin,
            py.id_inspeccion,
            ct.id_contrato,
            ct.monto_acordado,
            ct.status,
            p.nombre AS cliente,
            CONCAT(d.num_casa, ' ', d.calle, ', ', d.ciudad, ' ', d.estado) AS address,
            COUNT(fc.id_factura_cliente) AS invoice_count
        FROM proyecto py
        JOIN contrato ct ON ct.id_proyecto = py.id_proyecto
        JOIN cliente c ON c.id_cliente = py.id_cliente
        JOIN persona p ON p.id_persona = c.id_persona
        JOIN propiedad pr ON pr.id_propiedad = py.id_propiedad
        JOIN direccion d ON d.id_direccion = pr.id_direccion
        LEFT JOIN factura_cliente fc ON fc.id_proyecto = py.id_proyecto
        GROUP BY
            py.id_proyecto,
            py.fecha_inicio,
            py.fecha_estimada_fin,
            py.id_inspeccion,
            ct.id_contrato,
            ct.monto_acordado,
            ct.status,
            p.nombre,
            d.num_casa,
            d.calle,
            d.ciudad,
            d.estado
        ORDER BY py.id_proyecto DESC
        LIMIT 100`
    );

    const [[projectStats]] = await db.query(
        `SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN ct.status = 'activo' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN ct.status = 'completado' THEN 1 ELSE 0 END) AS completed,
            COALESCE(SUM(ct.monto_acordado), 0) AS contractedTotal
        FROM proyecto py
        JOIN contrato ct ON ct.id_proyecto = py.id_proyecto`
    );

    res.render('admin-projects', {
        title: 'Projects & Contracts',
        pageClass: 'admin-page',
        adminPage: true,
        pendingInspections,
        projects,
        projectStats,
    });
});

app.get('/admin/payments', requireAdmin, async (req, res) => {
    const [projects] = await db.query(
        `SELECT
            py.id_proyecto,
            p.nombre AS cliente,
            ct.monto_acordado,
            ct.status,
            COALESCE(SUM(fc.total), 0) AS invoiced_total
        FROM proyecto py
        JOIN contrato ct ON ct.id_proyecto = py.id_proyecto
        JOIN cliente c ON c.id_cliente = py.id_cliente
        JOIN persona p ON p.id_persona = c.id_persona
        LEFT JOIN factura_cliente fc ON fc.id_proyecto = py.id_proyecto
        GROUP BY py.id_proyecto, p.nombre, ct.monto_acordado, ct.status
        ORDER BY py.id_proyecto DESC
        LIMIT 100`
    );

    const [invoices] = await db.query(
        `SELECT
            fc.id_factura_cliente,
            fc.id_proyecto,
            ct.id_contrato,
            fc.fecha,
            fc.subtotal,
            fc.impuesto,
            fc.total,
            p.nombre AS cliente,
            COALESCE(SUM(pg.total), 0) AS paid_total,
            fc.total - COALESCE(SUM(pg.total), 0) AS balance
        FROM factura_cliente fc
        JOIN proyecto pr ON pr.id_proyecto = fc.id_proyecto
        JOIN contrato ct ON ct.id_proyecto = pr.id_proyecto
        JOIN cliente c ON c.id_cliente = pr.id_cliente
        JOIN persona p ON p.id_persona = c.id_persona
        LEFT JOIN pago pg ON pg.id_factura_cliente = fc.id_factura_cliente
        GROUP BY
            fc.id_factura_cliente,
            fc.id_proyecto,
            ct.id_contrato,
            fc.fecha,
            fc.subtotal,
            fc.impuesto,
            fc.total,
            p.nombre
        ORDER BY fc.id_factura_cliente DESC
        LIMIT 100`
    );

    const [payments] = await db.query(
        `SELECT
            pg.id_pago,
            pg.id_factura_cliente,
            pg.precio_mano_obra,
            pg.pago_inicial,
            pg.pago_final,
            pg.total,
            fc.id_proyecto,
            p.nombre AS cliente,
            fc.total AS invoice_total
        FROM pago pg
        JOIN factura_cliente fc ON fc.id_factura_cliente = pg.id_factura_cliente
        JOIN proyecto pr ON pr.id_proyecto = fc.id_proyecto
        JOIN cliente c ON c.id_cliente = pr.id_cliente
        JOIN persona p ON p.id_persona = c.id_persona
        ORDER BY pg.id_pago DESC
        LIMIT 100`
    );

    res.render('admin-payments', {
        title: 'Payment Process',
        pageClass: 'admin-page',
        adminPage: true,
        projects,
        invoices,
        payments,
    });
});

app.get('/admin/purchases', requireAdmin, async (req, res) => {
    const [projects] = await db.query(
        `SELECT
            py.id_proyecto,
            p.nombre AS cliente,
            ct.status
        FROM proyecto py
        JOIN contrato ct ON ct.id_proyecto = py.id_proyecto
        JOIN cliente c ON c.id_cliente = py.id_cliente
        JOIN persona p ON p.id_persona = c.id_persona
        ORDER BY py.id_proyecto DESC
        LIMIT 100`
    );

    const [providers] = await db.query(
        `SELECT pr.id_proveedor, p.nombre
        FROM proveedor pr
        JOIN persona p ON p.id_persona = pr.id_persona
        ORDER BY pr.id_proveedor DESC
        LIMIT 100`
    );

    const [materials] = await db.query(
        `SELECT id_material, nombre, categoria, costo_unitario_actual
        FROM material
        ORDER BY id_material DESC
        LIMIT 100`
    );

    const [purchases] = await db.query(
        `SELECT
            fc.id_factura_compra,
            fc.id_proyecto,
            fc.fecha,
            fc.total,
            p.nombre AS proveedor,
            COUNT(dfc.id_material) AS material_count,
            GROUP_CONCAT(CONCAT(m.nombre, ' x', dfc.cantidad) SEPARATOR ', ') AS materials
        FROM factura_compra fc
        JOIN proveedor pr ON pr.id_proveedor = fc.id_proveedor
        JOIN persona p ON p.id_persona = pr.id_persona
        LEFT JOIN detalle_factura_compra dfc ON dfc.id_factura_compra = fc.id_factura_compra
        LEFT JOIN material m ON m.id_material = dfc.id_material
        GROUP BY
            fc.id_factura_compra,
            fc.id_proyecto,
            fc.fecha,
            fc.total,
            p.nombre
        ORDER BY fc.id_factura_compra DESC
        LIMIT 100`
    );

    res.render('admin-purchases', {
        title: 'Material Purchase Process',
        pageClass: 'admin-page',
        adminPage: true,
        projects,
        providers,
        materials,
        purchases,
    });
});

app.get('/admin/database', requireAdmin, async (req, res) => {
    const importantTables = [
        'usuario',
        'persona',
        'cliente',
        'direccion',
        'inspeccion',
        'proyecto',
        'contrato',
        'factura_cliente',
        'pago',
        'proveedor',
        'material',
        'factura_compra',
        'detalle_factura_compra',
    ];

    const tableCountSql = importantTables
        .map((table) => `SELECT '${table}' AS table_name, COUNT(*) AS total FROM ${table}`)
        .join(' UNION ALL ');

    const [tableCounts] = await db.query(tableCountSql);

    const [views] = await db.query(
        `SELECT TABLE_NAME AS name
        FROM information_schema.VIEWS
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME`
    );

    const [routines] = await db.query(
        `SELECT
            ROUTINE_NAME AS name,
            ROUTINE_TYPE AS type
        FROM information_schema.ROUTINES
        WHERE ROUTINE_SCHEMA = DATABASE()
        ORDER BY ROUTINE_TYPE, ROUTINE_NAME`
    );

    const [triggers] = await db.query(
        `SELECT
            TRIGGER_NAME AS name,
            EVENT_MANIPULATION AS event_name,
            EVENT_OBJECT_TABLE AS table_name
        FROM information_schema.TRIGGERS
        WHERE TRIGGER_SCHEMA = DATABASE()
        ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME`
    );

    const [providers] = await db.query(
        `SELECT
            pr.id_proveedor,
            p.nombre,
            COALESCE(pr.email, p.email) AS email,
            COALESCE(pr.telefono, p.telefono) AS telefono
        FROM proveedor pr
        JOIN persona p ON p.id_persona = pr.id_persona
        ORDER BY pr.id_proveedor DESC
        LIMIT 100`
    );

    const [materials] = await db.query(
        `SELECT
            m.id_material,
            m.nombre,
            m.categoria,
            m.costo_unitario_actual,
            p.nombre AS proveedor
        FROM material m
        JOIN proveedor pr ON pr.id_proveedor = m.id_proveedor
        JOIN persona p ON p.id_persona = pr.id_persona
        ORDER BY m.id_material DESC
        LIMIT 100`
    );

    res.render('admin-database', {
        title: 'Database Control',
        pageClass: 'admin-page',
        adminPage: true,
        tableCounts,
        views,
        routines,
        triggers,
        providers,
        materials,
    });
});

app.get('/api/session', (req, res) => {
    if (!req.session?.user) {
        return res.json({
            loggedIn: false,
            user: null,
        });
    }

    return res.json({
        loggedIn: true,
        user: req.session.user,
    });
});

app.post('/api/signup', async (req, res) => {
    const {
        name,
        company,
        email,
        password,
    } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            message: 'Please complete all required fields.',
        });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [existingPeople] = await connection.query(
            'SELECT id_persona FROM persona WHERE email = ? LIMIT 1',
            [email.trim()]
        );

        if (existingPeople.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                message: 'There is already an account with this email.',
            });
        }

        const [personResult] = await connection.query(
            'INSERT INTO persona (nombre, email, telefono) VALUES (?, ?, NULL)',
            [name.trim(), email.trim()]
        );

        const username = await getUniqueUsername(connection, name.trim());
        const [userResult] = await connection.query(
            `INSERT INTO usuario
                (id_persona, rol, username, password_hash)
            VALUES (?, 'cliente', ?, ?)`,
            [personResult.insertId, username, hashPassword(password)]
        );

        await connection.commit();

        createSession(res, {
            id_usuario: userResult.insertId,
            rol: 'cliente',
            username,
            nombre: name.trim(),
        });

        return res.status(201).json({
            message: 'Account created successfully!',
            redirectTo: '/',
        });
    } catch (error) {
        await connection.rollback();
        console.error('Signup error:', error);
        return res.status(500).json({
            message: 'Could not create the account.',
        });
    } finally {
        connection.release();
    }
});

app.post('/api/admin/projects', requireAdminApi, async (req, res) => {
    const {
        id_inspeccion,
        fecha_inicio,
        fecha_estimada_fin,
        monto_acordado,
        terminos,
    } = req.body;

    if (!id_inspeccion || !fecha_inicio || !fecha_estimada_fin || !monto_acordado) {
        return res.status(400).json({
            message: 'Inspection, dates and agreed amount are required.',
        });
    }

    const connection = await db.getConnection();

    try {
        const [inspections] = await connection.query(
            `SELECT
                i.id_inspeccion,
                i.id_propiedad,
                u.id_persona,
                c.id_cliente,
                pr.id_direccion,
                py.id_proyecto
            FROM inspeccion i
            JOIN usuario u ON u.id_usuario = i.id_usuario
            JOIN propiedad pr ON pr.id_propiedad = i.id_propiedad
            LEFT JOIN cliente c ON c.id_persona = u.id_persona
            LEFT JOIN proyecto py ON py.id_inspeccion = i.id_inspeccion
            WHERE i.id_inspeccion = ?
            LIMIT 1`,
            [id_inspeccion]
        );

        if (inspections.length === 0) {
            return res.status(404).json({
                message: 'Inspection not found.',
            });
        }

        const inspection = inspections[0];

        if (inspection.id_proyecto) {
            return res.status(409).json({
                message: 'This inspection already has a project.',
            });
        }

        let idCliente = inspection.id_cliente;

        if (!idCliente) {
            const [clientResult] = await connection.query(
                'INSERT INTO cliente (id_persona, id_direccion, empresa) VALUES (?, ?, NULL)',
                [inspection.id_persona, inspection.id_direccion]
            );
            idCliente = clientResult.insertId;
        }

        await connection.query(
            'CALL sp_crear_proyecto(?, ?, ?, ?, ?, ?, ?)',
            [
                idCliente,
                inspection.id_propiedad,
                inspection.id_inspeccion,
                fecha_inicio,
                fecha_estimada_fin,
                Number(monto_acordado),
                terminos?.trim() || 'Project created from approved inspection.',
            ]
        );

        return res.status(201).json({
            message: 'Project and contract created successfully.',
        });
    } catch (error) {
        console.error('Project process error:', error);
        return res.status(500).json({
            message: error.sqlMessage || 'Could not create project.',
        });
    } finally {
        connection.release();
    }
});

app.post('/api/admin/invoices', requireAdminApi, async (req, res) => {
    const {
        id_proyecto,
        subtotal,
        impuesto,
    } = req.body;

    if (!id_proyecto || !subtotal) {
        return res.status(400).json({
            message: 'Project and subtotal are required.',
        });
    }

    const cleanSubtotal = Number(subtotal);
    const cleanTax = Number(impuesto || 0);

    if (cleanSubtotal <= 0 || cleanTax < 0) {
        return res.status(400).json({
            message: 'Subtotal must be greater than zero and tax cannot be negative.',
        });
    }

    try {
        const [project] = await db.query(
            'SELECT id_proyecto FROM proyecto WHERE id_proyecto = ? LIMIT 1',
            [id_proyecto]
        );

        if (project.length === 0) {
            return res.status(404).json({
                message: 'Project not found.',
            });
        }

        await db.query(
            `INSERT INTO factura_cliente
                (id_proyecto, fecha, subtotal, impuesto, total)
            VALUES (?, CURDATE(), ?, ?, ?)`,
            [id_proyecto, cleanSubtotal, cleanTax, cleanSubtotal + cleanTax]
        );

        return res.status(201).json({
            message: 'Client invoice created successfully.',
        });
    } catch (error) {
        console.error('Invoice process error:', error);
        return res.status(500).json({
            message: 'Could not create client invoice.',
        });
    }
});

app.post('/api/admin/payments', requireAdminApi, async (req, res) => {
    const {
        id_factura_cliente,
        precio_mano_obra,
        pago_inicial,
        pago_final,
    } = req.body;

    if (!id_factura_cliente || !precio_mano_obra) {
        return res.status(400).json({
            message: 'Invoice and labor price are required.',
        });
    }

    try {
        const [invoice] = await db.query(
            `SELECT fc.id_factura_cliente, ct.id_contrato
            FROM factura_cliente fc
            JOIN contrato ct ON ct.id_proyecto = fc.id_proyecto
            WHERE fc.id_factura_cliente = ?
            LIMIT 1`,
            [id_factura_cliente]
        );

        if (invoice.length === 0) {
            return res.status(404).json({
                message: 'Invoice not found.',
            });
        }

        await db.query(
            'CALL sp_registrar_pago(?, ?, ?, ?, ?)',
            [
                id_factura_cliente,
                invoice[0].id_contrato,
                Number(precio_mano_obra),
                Number(pago_inicial || 0),
                Number(pago_final || 0),
            ]
        );

        return res.status(201).json({
            message: 'Payment saved successfully.',
        });
    } catch (error) {
        console.error('Payment process error:', error);
        return res.status(500).json({
            message: 'Could not save payment.',
        });
    }
});

app.post('/api/admin/purchases', requireAdminApi, async (req, res) => {
    const {
        id_proyecto,
        id_proveedor,
        materiales,
    } = req.body;

    if (!id_proyecto || !id_proveedor || !Array.isArray(materiales) || materiales.length === 0) {
        return res.status(400).json({
            message: 'Project, provider and at least one material are required.',
        });
    }

    const cleanMaterials = materiales
        .map((material) => ({
            id_material: Number(material.id_material),
            cantidad: Number(material.cantidad),
            precio_mom: Number(material.precio_mom),
        }))
        .filter((material) => material.id_material && material.cantidad > 0 && material.precio_mom >= 0);

    if (cleanMaterials.length === 0) {
        return res.status(400).json({
            message: 'Material rows must have material, quantity and unit price.',
        });
    }

    try {
        await db.query(
            'CALL sp_registrar_factura_compra(?, ?, CURDATE(), CAST(? AS JSON))',
            [id_proyecto, id_proveedor, JSON.stringify(cleanMaterials)]
        );
        return res.status(201).json({
            message: 'Material purchase saved successfully.',
        });
    } catch (error) {
        console.error('Purchase process error:', error);
        return res.status(500).json({
            message: 'Could not save material purchase.',
        });
    }
});

app.post('/api/admin/providers', requireAdminApi, async (req, res) => {
    const {
        nombre,
        email,
        telefono,
        num_casa,
        calle,
        ciudad,
        estado,
        codigo_postal,
    } = req.body;

    if (!nombre || !email || !telefono || !num_casa || !calle || !ciudad || !estado || !codigo_postal) {
        return res.status(400).json({
            message: 'Provider name, contact and full address are required.',
        });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [personResult] = await connection.query(
            'INSERT INTO persona (nombre, email, telefono) VALUES (?, ?, ?)',
            [nombre.trim(), email.trim(), telefono.trim()]
        );

        const [addressResult] = await connection.query(
            `INSERT INTO direccion
                (num_casa, calle, ciudad, estado, codigo_postal)
            VALUES (?, ?, ?, ?, ?)`,
            [
                num_casa.trim(),
                calle.trim(),
                ciudad.trim(),
                estado.trim().toUpperCase(),
                codigo_postal.trim(),
            ]
        );

        await connection.query(
            `INSERT INTO proveedor
                (id_persona, telefono, email, id_direccion)
            VALUES (?, ?, ?, ?)`,
            [personResult.insertId, telefono.trim(), email.trim(), addressResult.insertId]
        );

        await connection.commit();

        return res.status(201).json({
            message: 'Provider registered successfully.',
        });
    } catch (error) {
        await connection.rollback();
        console.error('Provider process error:', error);
        return res.status(500).json({
            message: error.code === 'ER_DUP_ENTRY'
                ? 'There is already a person with this email.'
                : 'Could not register provider.',
        });
    } finally {
        connection.release();
    }
});

app.post('/api/admin/materials', requireAdminApi, async (req, res) => {
    const {
        id_proveedor,
        nombre,
        categoria,
        costo_unitario_actual,
    } = req.body;

    if (!id_proveedor || !nombre || !categoria || !costo_unitario_actual) {
        return res.status(400).json({
            message: 'Provider, material name, type and unit price are required.',
        });
    }

    const unitPrice = Number(costo_unitario_actual);

    if (unitPrice < 0) {
        return res.status(400).json({
            message: 'Unit price cannot be negative.',
        });
    }

    try {
        await db.query(
            `INSERT INTO material
                (nombre, categoria, costo_unitario_actual, id_proveedor)
            VALUES (?, ?, ?, ?)`,
            [nombre.trim(), categoria.trim(), unitPrice, id_proveedor]
        );

        return res.status(201).json({
            message: 'Material registered successfully.',
        });
    } catch (error) {
        console.error('Material process error:', error);
        return res.status(500).json({
            message: 'Could not register material.',
        });
    }
});

app.patch('/api/admin/inspections/:id', requireAdminApi, async (req, res) => {
    const { condicion_general, notas, costo_estimado } = req.body;

    if (!condicion_general) {
        return res.status(400).json({
            message: 'House condition is required.',
        });
    }

    try {
        const [result] = await db.query(
            `UPDATE inspeccion
            SET condicion_general = ?, notas = ?, costo_estimado = ?
            WHERE id_inspeccion = ?`,
            [
                condicion_general.trim(),
                notas?.trim() || null,
                costo_estimado === '' || costo_estimado == null ? null : Number(costo_estimado),
                req.params.id,
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: 'Inspection not found.',
            });
        }

        return res.json({
            message: 'Inspection updated successfully.',
        });
    } catch (error) {
        console.error('Inspection update error:', error);
        return res.status(500).json({
            message: 'Could not update inspection.',
        });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: 'Email and password are required.',
        });
    }

    try {
        const [users] = await db.query(
            `SELECT u.id_usuario, u.rol, u.username, u.password_hash, p.nombre
            FROM usuario u
            JOIN persona p ON p.id_persona = u.id_persona
            WHERE p.email = ?
            LIMIT 1`,
            [email.trim()]
        );

        if (users.length === 0 || !verifyPassword(password, users[0].password_hash)) {
            return res.status(401).json({
                message: 'Invalid email or password.',
            });
        }

        createSession(res, users[0]);

        return res.json({
            message: 'Logged in successfully!',
            redirectTo: '/',
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            message: 'Could not log in.',
        });
    }
});

app.post('/api/logout', (req, res) => {
    if (req.session?.token) {
        sessions.delete(req.session.token);
    }

    res.setHeader('Set-Cookie', `${sessionCookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
    return res.json({
        message: 'Logged out successfully.',
    });
});

app.post('/api/reviews', requireClientApi, async (req, res) => {
    const { id_certificado, opinion } = req.body;

    if (!id_certificado || !opinion?.trim()) {
        return res.status(400).json({
            message: 'Select a completed project and write your review.',
        });
    }

    try {
        const [certificates] = await db.query(
            `SELECT
                cc.id_certificado,
                r.id_resena
            FROM certificado_complecion cc
            JOIN proyecto py ON py.id_proyecto = cc.id_proyecto
            JOIN inspeccion i ON i.id_inspeccion = py.id_inspeccion
            LEFT JOIN resena r ON r.id_certificado = cc.id_certificado
            WHERE cc.id_certificado = ?
                AND i.id_usuario = ?
            LIMIT 1`,
            [id_certificado, req.session.user.id_usuario]
        );

        if (certificates.length === 0) {
            return res.status(404).json({
                message: 'Completed project not found for your account.',
            });
        }

        if (certificates[0].id_resena) {
            return res.status(409).json({
                message: 'You already sent a review for this project.',
            });
        }

        await db.query(
            'INSERT INTO resena (id_certificado, opinion, fecha) VALUES (?, ?, CURDATE())',
            [id_certificado, opinion.trim()]
        );

        return res.status(201).json({
            message: 'Thank you. Your review was saved successfully.',
        });
    } catch (error) {
        console.error('Review error:', error);
        return res.status(500).json({
            message: error.sqlMessage || 'Could not save your review.',
        });
    }
});

app.post('/api/inspections', async (req, res) => {
    const {
        num_casa,
        calle,
        ciudad,
        estado,
        codigo_postal,
        service_type,
        condicion_general,
        message,
    } = req.body;

    const currentUserId =
        req.user?.id_usuario ||
        req.user?.id ||
        req.session?.user?.id_usuario ||
        req.session?.user?.id ||
        req.session?.usuario?.id_usuario ||
        req.session?.usuario?.id;

    if (!currentUserId) {
        return res.status(401).json({
            message: 'You must be logged in as a client to request an inspection.',
        });
    }

    if (!num_casa || !calle || !ciudad || !estado || !codigo_postal || !condicion_general || !message) {
        return res.status(400).json({
            message: 'Address, house condition and description are required.',
        });
    }

    if (estado.trim().length !== 2) {
        return res.status(400).json({
            message: 'State must use 2 letters.',
        });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [users] = await connection.query(
            `SELECT
                u.id_usuario,
                u.rol,
                u.id_persona,
                c.id_cliente,
                c.empresa
            FROM usuario u
            LEFT JOIN cliente c ON c.id_persona = u.id_persona
            WHERE u.id_usuario = ?
            LIMIT 1`,
            [currentUserId]
        );

        if (users.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'User not found.',
            });
        }

        const user = users[0];

        if (user.rol !== 'cliente') {
            await connection.rollback();
            return res.status(403).json({
                message: 'Only users with client role can request an inspection.',
            });
        }

        const [addresses] = await connection.query(
            `SELECT id_direccion
            FROM direccion
            WHERE num_casa = ?
                AND calle = ?
                AND ciudad = ?
                AND estado = ?
                AND codigo_postal = ?
            LIMIT 1`,
            [
                num_casa.trim(),
                calle.trim(),
                ciudad.trim(),
                estado.trim().toUpperCase(),
                codigo_postal.trim(),
            ]
        );

        let idDireccion = addresses[0]?.id_direccion;

        if (!idDireccion) {
            const [addressResult] = await connection.query(
                `INSERT INTO direccion
                    (num_casa, calle, ciudad, estado, codigo_postal)
                VALUES (?, ?, ?, ?, ?)`,
                [
                    num_casa.trim(),
                    calle.trim(),
                    ciudad.trim(),
                    estado.trim().toUpperCase(),
                    codigo_postal.trim(),
                ]
            );
            idDireccion = addressResult.insertId;
        }

        let idCliente = user.id_cliente;

        if (!idCliente) {
            const [clientResult] = await connection.query(
                'INSERT INTO cliente (id_persona, id_direccion, empresa) VALUES (?, ?, NULL)',
                [user.id_persona, idDireccion]
            );
            idCliente = clientResult.insertId;
        }

        const [properties] = await connection.query(
            'SELECT id_propiedad FROM propiedad WHERE id_direccion = ? LIMIT 1',
            [idDireccion]
        );

        let idPropiedad = properties[0]?.id_propiedad;

        if (!idPropiedad) {
            const [propertyResult] = await connection.query(
                'INSERT INTO propiedad (id_direccion) VALUES (?)',
                [idDireccion]
            );
            idPropiedad = propertyResult.insertId;
        }

        const notes = [
            `Service requested: ${service_type || 'General inspection'}`,
            '',
            message,
        ].join('\n');

        const [inspectionResult] = await connection.query(
            `INSERT INTO inspeccion
                (id_propiedad, id_usuario, fecha, condicion_general, notas, costo_estimado)
            VALUES (?, ?, CURDATE(), ?, ?, NULL)`,
            [idPropiedad, user.id_usuario, condicion_general, notes]
        );

        await connection.commit();

        return res.status(201).json({
            message: 'Inspection request submitted successfully! Please contact Michelle Ultra Services by Gmail or phone so the team can confirm the review schedule.',
            contact: {
                email: 'michelleultraservices@gmail.com',
                phone: '(813) 555-0101',
            },
            statusUrl: '/my-requests',
            id_inspeccion: inspectionResult.insertId,
        });
    } catch (error) {
        await connection.rollback();
        console.error('Inspection request error:', error);
        return res.status(500).json({
            message: 'Could not submit inspection request.',
        });
    } finally {
        connection.release();
    }
});

// =======================
// SERVIDOR
// =======================
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
