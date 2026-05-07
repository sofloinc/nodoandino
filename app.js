require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const app = express();

const { User, Entidad, Curso, Materia, Inscripcion, Nota, Noticia, mongoose } = require('./database');

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
    if (['admin_global', 'director', 'administrativo'].includes(req.session.userRole)) return next();
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

// API ACADÉMICA DOCENTE
app.get('/api/materias', isAuthenticated, async (req, res) => {
    let filter = { ciclo_lectivo: 2026 };
    if (req.session.userRole === 'docente') filter.docente_dni = req.session.userDni;
    const materias = await Materia.find(filter).populate('curso_id');
    res.json(materias);
});

// Obtener alumnos de una materia específica
app.get('/api/materias/:id/alumnos', isAuthenticated, async (req, res) => {
    try {
        const materia = await Materia.findById(req.params.id);
        if (!materia) return res.status(404).json({ error: 'Materia no encontrada' });
        
        // Alumnos inscriptos en el curso de esta materia
        const inscripciones = await Inscripcion.find({ curso_id: materia.curso_id });
        const dnis = inscripciones.map(i => i.alumno_dni);
        const alumnos = await User.find({ dni: { $in: dnis } }).sort({ nombre_completo: 1 });
        
        res.json(alumnos);
    } catch (err) {
        res.status(500).json({ error: 'Error' });
    }
});

// Cargar Nota o Informe de Avance
app.post('/api/notas', isAuthenticated, async (req, res) => {
    try {
        const { alumno_dni, materia_id, valor, tipo, periodo, comentario } = req.body;
        const nuevaNota = await new Nota({ alumno_dni, materia_id, valor, tipo, periodo, comentario }).save();
        res.json(nuevaNota);
    } catch (err) {
        res.status(500).json({ error: 'Error al cargar nota' });
    }
});

// API ADMINISTRATIVA
app.get('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    const filter = req.session.userRole === 'admin_global' ? {} : { entidad_id: req.session.entidadId };
    const users = await User.find(filter).sort({ nombre_completo: 1 });
    res.json(users);
});

app.get('/api/admin/users/:dni', isAuthenticated, isAdmin, async (req, res) => {
    const user = await User.findOne({ dni: req.params.dni }).populate('entidad_id');
    let extra = {};
    if (user.rol === 'alumno') {
        const insc = await Inscripcion.findOne({ alumno_dni: user.dni }).populate('curso_id');
        extra.curso = insc ? insc.curso_id.nombre : 'Sin asignar';
        extra.notas = await Nota.find({ alumno_dni: user.dni }).populate('materia_id');
    }
    res.json({ ...user._doc, ...extra });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 PEI Platform activa en puerto ${PORT}`));