require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();

const { User } = require('./database');

app.use(session({
    secret: process.env.SESSION_SECRET || 'nodo-andino-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Middleware para proteger rutas
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/');
};

// RUTA 1: Landing Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// RUTA 2: Procesar el Login (Async para MongoDB)
app.post('/login', async (req, res) => {
    const { usuario, password } = req.body;
    
    try {
        const user = await User.findOne({ usuario, password });
        
        if (user) {
            req.session.userId = user._id;
            req.session.username = user.usuario;
            res.redirect('/dashboard');
        } else {
            res.send('Acceso denegado. <a href="/">Volver</a>');
        }
    } catch (err) {
        console.error('Error en el login:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// RUTA 3: El Dashboard (Protegida)
app.get('/dashboard', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// RUTA 4: Cerrar Sesión
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor en puerto ${PORT}`);
});