require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const app = express();

const { User, Entidad, Curso, Materia, Inscripcion, Nota, Noticia, Asistencia, Carrera, mongoose } = require('./database');

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
app.get('/api/user', isAuthenticated, async (req, res) => {
    const user = await User.findOne({ dni: req.session.userDni });
    res.json({ dni: req.session.userDni, name: req.session.userName, role: req.session.userRole, entidadId: req.session.entidadId, avatar_url: user.avatar_url });
});

app.post('/api/user/avatar', isAuthenticated, async (req, res) => {
    try {
        await User.findOneAndUpdate({ dni: req.session.userDni }, { avatar_url: req.body.avatar_url });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error' });
    }
});

app.get('/api/entidad', isAuthenticated, async (req, res) => {
    if (!req.session.entidadId) return res.json({ nombre: 'PEI Global' });
    const entidad = await Entidad.findById(req.session.entidadId);
    res.json(entidad);
});

// API ACADÉMICA
app.get('/api/materias', isAuthenticated, async (req, res) => {
    let filter = { ciclo_lectivo: 2026 };
    if (req.session.userRole === 'docente') filter.docente_dni = req.session.userDni;
    const materias = await Materia.find(filter).populate('curso_id');
    res.json(materias);
});

app.get('/api/cursos', isAuthenticated, async (req, res) => {
    const filter = req.session.entidadId ? { entidad_id: req.session.entidadId } : {};
    const cursos = await Curso.find(filter);
    res.json(cursos);
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

app.get('/api/materias/:id/alumnos', isAuthenticated, async (req, res) => {
    try {
        const materia = await Materia.findById(req.params.id);
        const inscripciones = await Inscripcion.find({ curso_id: materia.curso_id });
        const dnis = inscripciones.map(i => i.alumno_dni);
        const alumnos = await User.find({ dni: { $in: dnis } }).sort({ nombre_completo: 1 });
        res.json(alumnos);
    } catch (err) {
        res.status(500).json({ error: 'Error' });
    }
});

app.post('/api/notas', isAuthenticated, async (req, res) => {
    try {
        const { alumno_dni, materia_id, valor, tipo, periodo, comentario } = req.body;
        await new Nota({ alumno_dni, materia_id, valor, tipo, periodo, comentario }).save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error' });
    }
});

app.post('/api/asistencia', isAuthenticated, async (req, res) => {
    try {
        const { materia_id, registros } = req.body; // registros = [{dni, estado}]
        for (let reg of registros) {
            await new Asistencia({ alumno_dni: reg.dni, materia_id, estado: reg.estado }).save();
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error' });
    }
});

app.get('/api/asistencia/:materiaId', isAuthenticated, async (req, res) => {
    const asistencia = await Asistencia.find({ materia_id: req.params.materiaId }).sort({ fecha: -1 });
    res.json(asistencia);
});

// API ADMINISTRATIVA
app.get('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    const filter = req.session.userRole === 'admin_global' ? {} : { entidad_id: req.session.entidadId };
    const users = await User.find(filter).sort({ nombre_completo: 1 });
    res.json(users);
});

// Crear Nuevo Usuario (Legajo)
app.post('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { dni, password, nombre_completo, rol } = req.body;
        const user = await new User({
            dni,
            password,
            nombre_completo,
            rol,
            entidad_id: req.session.entidadId
        }).save();
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Error al crear usuario (DNI duplicado)' });
    }
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

app.get('/api/admin/cursos/:id/consolidado', isAuthenticated, isAdmin, async (req, res) => {
    const materias = await Materia.find({ curso_id: req.params.id });
    const inscripciones = await Inscripcion.find({ curso_id: req.params.id });
    const alumnos = await User.find({ dni: { $in: inscripciones.map(i => i.alumno_dni) } }).sort({ nombre_completo: 1 });
    const consolidado = [];
    for (let alumno of alumnos) {
        const notas = await Nota.find({ alumno_dni: alumno.dni, materia_id: { $in: materias.map(m => m._id) } });
        consolidado.push({
            nombre: alumno.nombre_completo,
            dni: alumno.dni,
            notas: materias.map(m => {
                const nota = notas.find(n => n.materia_id.equals(m._id));
                return { materia: m.nombre, valor: nota ? nota.valor : '-' };
            })
        });
    }
    res.json({ materias: materias.map(m => m.nombre), consolidado });
});

app.get('/api/carreras', isAuthenticated, async (req, res) => {
    const filter = req.session.entidadId ? { entidad_id: req.session.entidadId } : {};
    const carreras = await Carrera.find(filter);
    res.json(carreras);
});

app.post('/api/admin/carreras', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const carrera = await new Carrera({ ...req.body, entidad_id: req.session.entidadId }).save();
        res.json(carrera);
    } catch (err) {
        res.status(500).json({ error: 'Error' });
    }
});

app.post('/api/admin/promocionar', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { curso_origen_id, curso_destino_id, es_egreso } = req.body;
        const inscripciones = await Inscripcion.find({ curso_id: curso_origen_id, ciclo_lectivo: 2026 });
        
        for (let insc of inscripciones) {
            if (es_egreso) {
                await User.findOneAndUpdate({ dni: insc.alumno_dni }, { estado_academico: 'Egresado' });
            } else {
                await new Inscripcion({
                    alumno_dni: insc.alumno_dni,
                    curso_id: curso_destino_id,
                    ciclo_lectivo: 2027
                }).save();
            }
        }
        res.json({ success: true, count: inscripciones.length });
    } catch (err) {
        res.status(500).json({ error: 'Error en la promoción' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 PEI Platform activa en puerto ${PORT}`));