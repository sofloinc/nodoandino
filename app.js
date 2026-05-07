require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const app = express();

const { User, Entidad, Curso, Materia, mongoose } = require('./database');

// Configuración de Multer para subida de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/legajos/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.use(session({
    secret: process.env.SESSION_SECRET || 'pei-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const isAuthenticated = (req, res, next) => {
    if (req.session.userDni) return next();
    res.redirect('/');
};

const isAdmin = (req, res, next) => {
    if (['admin_global', 'director'].includes(req.session.userRole)) return next();
    res.status(403).send('No autorizado');
};

// --- RUTAS DE LOGIN Y DASHBOARD ---

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.post('/login', async (req, res) => {
    const { dni, password } = req.body;
    try {
        const user = await User.findOne({ dni, password });
        if (user) {
            req.session.userDni = user.dni;
            req.session.userName = user.nombre_completo;
            req.session.userRole = user.rol;
            req.session.entidadId = user.entidad_id;
            res.redirect('/dashboard');
        } else {
            res.redirect('/?error=login_failed');
        }
    } catch (err) {
        res.status(500).send('Error');
    }
});

app.get('/dashboard', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

// --- API DE USUARIO Y ENTIDAD ---

app.get('/api/user', isAuthenticated, (req, res) => {
    res.json({ dni: req.session.userDni, name: req.session.userName, role: req.session.userRole, entidadId: req.session.entidadId });
});

app.get('/api/entidad', isAuthenticated, async (req, res) => {
    if (!req.session.entidadId) return res.json({ nombre: 'PEI Global' });
    const entidad = await Entidad.findById(req.session.entidadId);
    res.json(entidad);
});

// --- GESTIÓN DE LEGAJOS ---

app.get('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    const filter = req.session.userRole === 'admin_global' ? {} : { entidad_id: req.session.entidadId };
    const users = await User.find(filter).sort({ nombre_completo: 1 });
    res.json(users);
});

app.post('/api/admin/users/upload-doc/:dni', isAuthenticated, isAdmin, upload.single('documento'), async (req, res) => {
    // Aquí se guardaría la referencia del archivo en el legajo del usuario
    res.json({ message: 'Documento subido con éxito', file: req.file.filename });
});

// --- IMPORTACIÓN EXCEL ---

app.post('/api/admin/import-excel', isAuthenticated, isAdmin, multer({ dest: 'uploads/excel/' }).single('excel'), async (req, res) => {
    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        for (let row of data) {
            // Se asume columnas: DNI, Nombre, Password, Rol
            await User.findOneAndUpdate(
                { dni: row.DNI.toString() },
                { 
                    dni: row.DNI.toString(),
                    nombre_completo: row.Nombre,
                    password: row.Password.toString(),
                    rol: row.Rol || 'alumno',
                    entidad_id: req.session.entidadId
                },
                { upsert: true }
            );
        }
        fs.unlinkSync(req.file.path);
        res.json({ message: `Importados ${data.length} registros con éxito.` });
    } catch (err) {
        res.status(500).json({ error: 'Error al procesar Excel' });
    }
});

// --- ACADÉMICO ---

app.get('/api/cursos', isAuthenticated, async (req, res) => {
    const filter = req.session.entidadId ? { entidad_id: req.session.entidadId } : {};
    const cursos = await Curso.find(filter);
    res.json(cursos);
});

app.get('/api/materias', isAuthenticated, async (req, res) => {
    let filter = {};
    if (req.session.userRole === 'docente') filter.docente_dni = req.session.userDni;
    const materias = await Materia.find(filter).populate('curso_id');
    res.json(materias);
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 PEI Platform Premium activa en puerto ${PORT}`));