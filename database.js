require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("⚠️ ERROR: MONGO_URI no definida.");
} else {
    mongoose.connect(MONGO_URI)
        .then(async () => {
            console.log("✅ Conectado a MongoDB Atlas (PEI Core)");
            seedDemo();
        })
        .catch(err => console.error("❌ Error MongoDB:", err));
}

// --- ESQUEMAS ---

const EntidadSchema = new mongoose.Schema({
    nombre: { type: String, required: true, unique: true },
    logo_url: String,
    direccion: String,
    telefono: String,
    configuracion: Object
});

const UserSchema = new mongoose.Schema({
    dni: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    nombre_completo: { type: String, required: true },
    rol: { type: String, required: true }, 
    entidad_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Entidad' },
    documentos: [String] // Rutas a archivos subidos
});

const CursoSchema = new mongoose.Schema({
    nombre: String, // Ej: 1A
    nivel: String, // inicial, primaria, secundaria, terciario
    entidad_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Entidad' }
});

const MateriaSchema = new mongoose.Schema({
    nombre: String,
    area: String,
    curso_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso' },
    docente_dni: String
});

// --- MODELOS ---
const Entidad = mongoose.model('Entidad', EntidadSchema);
const User = mongoose.model('User', UserSchema);
const Curso = mongoose.model('Curso', CursoSchema);
const Materia = mongoose.model('Materia', MateriaSchema);

async function seedDemo() {
    try {
        const count = await Entidad.countDocuments({ nombre: 'Instituto Perito Moreno' });
        if (count === 0) {
            await User.deleteMany({});
            await Curso.deleteMany({});
            await Materia.deleteMany({});
            
            const perito = await new Entidad({
                nombre: 'Instituto Perito Moreno',
                direccion: 'Av. Bustillo 123, Bariloche',
                telefono: '294-4556677'
            }).save();

            // Usuarios
            await User.create([
                { dni: '123', password: 'admin', nombre_completo: 'Pugliese Nicolas', rol: 'admin_global' },
                { dni: '456', password: 'perito', nombre_completo: 'Director Perito', rol: 'director', entidad_id: perito._id },
                { dni: '111', password: 'docente', nombre_completo: 'Prof. Juan Perez', rol: 'docente', entidad_id: perito._id },
                { dni: '1001', password: 'alumno', nombre_completo: 'Alumno Ejemplo 1', rol: 'alumno', entidad_id: perito._id }
            ]);

            // Cursos
            const c1A = await new Curso({ nombre: '1A', nivel: 'secundaria', entidad_id: perito._id }).save();
            const c2A = await new Curso({ nombre: '2A', nivel: 'secundaria', entidad_id: perito._id }).save();

            // Áreas ESRN (Ejemplos)
            const areasESRN = [
                { nombre: 'Matemática', area: 'Matemática e Informática', curso_id: c1A._id, docente_dni: '111' },
                { nombre: 'Lengua y Literatura', area: 'Lengua y Literatura', curso_id: c1A._id, docente_dni: '111' },
                { nombre: 'Biología', area: 'Ciencias Naturales', curso_id: c1A._id, docente_dni: '111' },
                { nombre: 'Historia', area: 'Ciencias Sociales', curso_id: c1A._id, docente_dni: '111' }
            ];
            await Materia.insertMany(areasESRN);

            console.log('✅ Demo PEI recreada con Áreas ESRN y legajos.');
        }
    } catch (err) {
        console.error('Error al seedear Mongo:', err.message);
    }
}

module.exports = { Entidad, User, Curso, Materia, mongoose };