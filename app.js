require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const app = express();

const { User, Entidad, Curso, Materia, Nota, Noticia, mongoose } = require('./database');

// Configuración de Multer
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
    if (['admin_global', 'director', 'secretario'].includes(req.session.userRole)) return next();
    res.status(403).send('No autorizado');
};

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

// API USUARIO
app.get('/api/user', isAuthenticated, (req, res) => {
    res.json({ dni: req.session.userDni, name: req.session.userName, role: req.session.userRole, entidadId: req.session.entidadId });
});

app.get('/api/entidad', isAuthenticated, async (req, res) => {
    if (!req.session.entidadId) return res.json({ nombre: 'PEI Global' });
    const entidad = await Entidad.findById(req.session.entidadId);
    res.json(entidad);
});

// API ACADÉMICA
app.get('/api/materias', isAuthenticated, async (req, res) => {
    let filter = {};
    if (req.session.userRole === 'docente') filter.docente_dni = req.session.userDni;
    if (req.session.entidadId && req.session.userRole !== 'admin_global') {
        // En un caso real filtraríamos por entidad_id a través de curso_id
    }
    const materias = await Materia.find(filter).populate('curso_id');
    res.json(materias);
});

app.get('/api/boletin', isAuthenticated, async (req, res) => {
    const notas = await Nota.find({ alumno_dni: req.session.userDni }).populate('materia_id');
    res.json(notas);
});

app.get('/api/noticias', isAuthenticated, async (req, res) => {
    const filter = req.session.entidadId ? { entidad_id: req.session.entidadId } : {};
    const noticias = await Noticia.find(filter).sort({ fecha: -1 });
    res.json(noticias);
});

// --- GESTIÓN ACADÉMICA (Director/Admin) ---

// Crear Curso
app.post('/api/admin/cursos', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const nuevoCurso = await new Curso({ 
            nombre: req.body.nombre, 
            nivel: req.body.nivel, 
            entidad_id: req.session.entidadId 
        }).save();
        res.json(nuevoCurso);
    } catch (err) {
        res.status(500).json({ error: 'Error al crear curso' });
    }
});

// Crear Materia y Asignar Docente
app.post('/api/admin/materias', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const nuevaMateria = await new Materia({
            nombre: req.body.nombre,
            area: req.body.area,
            curso_id: req.body.curso_id,
            docente_dni: req.body.docente_dni,
            ciclo_lectivo: req.body.ciclo_lectivo || new Date().getFullYear()
        }).save();
        res.json(nuevaMateria);
    } catch (err) {
        res.status(500).json({ error: 'Error al asignar materia' });
    }
});

app.get('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    const filter = req.session.userRole === 'admin_global' ? {} : { entidad_id: req.session.entidadId };
    if (req.query.role) filter.rol = req.query.role; 
    const users = await User.find(filter).sort({ nombre_completo: 1 });
    res.json(users);
});

// Ver Detalle de Usuario (Legajo)
app.get('/api/admin/users/:dni', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const user = await User.findOne({ dni: req.params.dni }).populate('entidad_id');
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        
        // Si es alumno, traer sus notas
        let extra = {};
        if (user.rol === 'alumno') {
            extra.notas = await Nota.find({ alumno_dni: user.dni }).populate('materia_id');
        }
        // Si es docente, traer sus materias
        if (user.rol === 'docente') {
            extra.materias = await Materia.find({ docente_dni: user.dni }).populate('curso_id');
        }

        res.json({ ...user._doc, ...extra });
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener detalle' });
    }
});

// --- GESTIÓN GLOBAL (SuperAdmin) ---

// Listar Instituciones
app.get('/api/admin/entidades', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const entidades = await Entidad.find();
        res.json(entidades);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener instituciones' });
    }
});

// Crear Nueva Institución + Director Inicial
app.post('/api/admin/entidades', isAuthenticated, isAdmin, async (req, res) => {
    const { nombre, direccion, telefono, directorDni, directorNombre, directorPassword } = req.body;
    try {
        const nuevaEntidad = await new Entidad({ nombre, direccion, telefono }).save();
        await new User({
            dni: directorDni,
            password: directorPassword,
            nombre_completo: directorNombre,
            rol: 'director',
            entidad_id: nuevaEntidad._id
        }).save();
        res.json({ message: 'Institución y Director creados con éxito' });
    } catch (err) {
        res.status(500).json({ error: 'Error al crear la institución' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 PEI Masivo activo en puerto ${PORT}`));