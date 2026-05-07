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

const CarreraSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    entidad_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Entidad' },
    duracion_anios: Number
});

const UserSchema = new mongoose.Schema({
    dni: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    nombre_completo: { type: String, required: true },
    rol: { type: String, required: true }, 
    entidad_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Entidad' },
    avatar_url: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/147/147142.png' },
    estado_academico: { type: String, default: 'Activo' }, // Activo, Egresado, Suspendido
    documentos: [String]
});

const CursoSchema = new mongoose.Schema({
    nombre: String, 
    nivel: String, 
    carrera_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Carrera' },
    entidad_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Entidad' }
});

const MateriaSchema = new mongoose.Schema({
    nombre: String,
    area: String,
    carrera_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Carrera' },
    curso_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso' },
    docente_dni: String,
    ciclo_lectivo: { type: Number, default: new Date().getFullYear() }
});

const InscripcionSchema = new mongoose.Schema({
    alumno_dni: String,
    curso_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso' },
    ciclo_lectivo: Number
});

const NotaSchema = new mongoose.Schema({
    alumno_dni: String,
    materia_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Materia' },
    valor: Number,
    tipo: String, // seguimiento, trimestral, avance
    periodo: String, // 1er Trimestre
    comentario: String, 
    fecha: { type: Date, default: Date.now }
});

const AsistenciaSchema = new mongoose.Schema({
    alumno_dni: String,
    materia_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Materia' },
    estado: { type: String, enum: ['Presente', 'Ausente', 'Tarde', 'Justificado'] },
    fecha: { type: Date, default: Date.now }
});

const NoticiaSchema = new mongoose.Schema({
    titulo: String,
    contenido: String,
    entidad_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Entidad' },
    fecha: { type: Date, default: Date.now }
});

// --- MODELOS ---
const Entidad = mongoose.model('Entidad', EntidadSchema);
const User = mongoose.model('User', UserSchema);
const Curso = mongoose.model('Curso', CursoSchema);
const Materia = mongoose.model('Materia', MateriaSchema);
const Inscripcion = mongoose.model('Inscripcion', InscripcionSchema);
const Nota = mongoose.model('Nota', NotaSchema);
const Noticia = mongoose.model('Noticia', NoticiaSchema);
const Asistencia = mongoose.model('Asistencia', AsistenciaSchema);
const Carrera = mongoose.model('Carrera', CarreraSchema);

async function seedDemo() {
    try {
        const count = await Entidad.countDocuments({ nombre: 'Instituto Perito Moreno' });
        
        if (count === 0) {
            console.log('🔄 Re-inicializando Demo con Avatares y Rutas completas...');
            
            await Entidad.deleteMany({});
            await User.deleteMany({});
            await Curso.deleteMany({});
            await Materia.deleteMany({});
            await Inscripcion.deleteMany({});
            await Nota.deleteMany({});
            await Noticia.deleteMany({});

            const perito = await new Entidad({
                nombre: 'Instituto Perito Moreno',
                direccion: 'Av. Bustillo 123, Bariloche',
                telefono: '294-4556677'
            }).save();

            // Usuarios de Gestión
            await User.create([
                { dni: '123', password: 'admin', nombre_completo: 'Pugliese Nicolas', rol: 'admin_global' },
                { dni: '456', password: 'pass', nombre_completo: 'Director Perito', rol: 'director', entidad_id: perito._id },
                { dni: '789', password: 'pass', nombre_completo: 'Secretaria Marta', rol: 'administrativo', entidad_id: perito._id }
            ]);

            // Docentes
            await User.create([
                { dni: '10', password: 'pass', nombre_completo: 'Julian Alvarez', rol: 'docente', entidad_id: perito._id },
                { dni: '11', password: 'pass', nombre_completo: 'Lionel Messi', rol: 'docente', entidad_id: perito._id }
            ]);

            // Cursos
            const curso1A = await new Curso({ nombre: '1A', nivel: 'secundaria', entidad_id: perito._id }).save();
            const curso2A = await new Curso({ nombre: '2A', nivel: 'secundaria', entidad_id: perito._id }).save();

            // Materias
            await Materia.create([
                { nombre: 'Matemática', area: 'Exactas', curso_id: curso1A._id, docente_dni: '10', ciclo_lectivo: 2026 },
                { nombre: 'Lengua', area: 'Comunicación', curso_id: curso1A._id, docente_dni: '11', ciclo_lectivo: 2026 },
                { nombre: 'Física', area: 'Exactas', curso_id: curso2A._id, docente_dni: '10', ciclo_lectivo: 2026 }
            ]);

            // Alumnos (15 por curso)
            for (let i = 0; i < 15; i++) {
                const dni = (1000 + i).toString();
                await User.create({ dni: dni, password: 'pass', nombre_completo: `Alumno 1A - ${i}`, rol: 'alumno', entidad_id: perito._id });
                await Inscripcion.create({ alumno_dni: dni, curso_id: curso1A._id, ciclo_lectivo: 2026 });
            }

            // Noticias
            await Noticia.create({ titulo: 'Bienvenida 2026', contenido: 'Comienzo de clases el 1 de Marzo.', entidad_id: perito._id });

            console.log('✅ Demo PEI re-inicializada con soporte de Avatares.');
        }
    } catch (err) {
        console.error('Error al seedear:', err.message);
    }
}

module.exports = { Entidad, User, Curso, Materia, Inscripcion, Nota, Noticia, Asistencia, Carrera, mongoose };