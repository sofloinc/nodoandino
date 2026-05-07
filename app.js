require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();

// Usamos la base de datos PEI en MongoDB Atlas
const { User, Entidad, Curso, Materia, mongoose } = require('./database');

app.use(session({
    secret: process.env.SESSION_SECRET || 'pei-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const isAuthenticated = (req, res, next) => {
    if (req.session.userDni) return next();
    res.redirect('/');
};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Login por DNI (MongoDB)
app.post('/login', async (req, res) => {
    const { dni, password } = req.body;
    
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).send('Base de datos no disponible');
        }

        const user = await User.findOne({ dni, password });
        
        if (user) {
            req.session.userDni = user.dni;
            req.session.userName = user.nombre_completo;
            req.session.userRole = user.rol;
            req.session.entidadId = user.entidad_id;
            res.redirect('/dashboard');
        } else {
            res.send('Credenciales incorrectas. <a href="/">Volver</a>');
        }
    } catch (err) {
        console.error('Error login:', err);
        res.status(500).send('Error interno');
    }
});

app.get('/dashboard', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/api/user', isAuthenticated, (req, res) => {
    res.json({
        dni: req.session.userDni,
        name: req.session.userName,
        role: req.session.userRole,
        entidadId: req.session.entidadId
    });
});

app.get('/api/entidad', isAuthenticated, async (req, res) => {
    try {
        if (!req.session.entidadId) return res.json({ nombre: 'PEI Global' });
        const entidad = await Entidad.findById(req.session.entidadId);
        res.json(entidad);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener escuela' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 PEI Platform (MongoDB Atlas) en puerto ${PORT}`);
});