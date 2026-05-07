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
    documentos: [String]
});

const CursoSchema = new mongoose.Schema({
    nombre: String, 
    nivel: String, 
    entidad_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Entidad' }
});

const MateriaSchema = new mongoose.Schema({
    nombre: String,
    area: String,
    curso_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso' },
    docente_dni: String
});

const NotaSchema = new mongoose.Schema({
    alumno_dni: String,
    materia_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Materia' },
    valor: Number,
    tipo: String, // seguimiento, trimestral
    periodo: String, // 1er Trimestre
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
const Nota = mongoose.model('Nota', NotaSchema);
const Noticia = mongoose.model('Noticia', NoticiaSchema);

async function seedDemo() {
    try {
        const count = await Entidad.countDocuments({ nombre: 'Instituto Perito Moreno' });
        
        // Forzamos resiembra si el usuario lo pide o si está incompleto
        if (count === 0 || (await User.countDocuments({ rol: 'alumno' })) < 40) {
            console.log('🔄 Iniciando carga masiva de Demo...');
            
            // Limpieza
            await Entidad.deleteMany({});
            await User.deleteMany({});
            await Curso.deleteMany({});
            await Materia.deleteMany({});
            await Nota.deleteMany({});
            await Noticia.deleteMany({});

            const perito = await new Entidad({
                nombre: 'Instituto Perito Moreno',
                direccion: 'Av. Bustillo 123, Bariloche',
                telefono: '294-4556677'
            }).save();

            // 1. Administradores
            await User.create([
                { dni: '123', password: 'admin', nombre_completo: 'Pugliese Nicolas', rol: 'admin_global' },
                { dni: '456', password: 'perito', nombre_completo: 'Director Perito', rol: 'director', entidad_id: perito._id }
            ]);

            // 2. Docentes (5 docentes)
            const docentes = [];
            for (let i = 1; i <= 5; i++) {
                const d = await User.create({
                    dni: (200 + i).toString(),
                    password: 'pass',
                    nombre_completo: `Prof. Docente ${i}`,
                    rol: 'docente',
                    entidad_id: perito._id
                });
                docentes.push(d);
            }

            // 3. Cursos (1A, 1B, 2A, 2B)
            const cursos = [];
            const nombresCursos = ['1A', '1B', '2A', '2B'];
            for (let n of nombresCursos) {
                const c = await new Curso({ nombre: n, nivel: 'secundaria', entidad_id: perito._id }).save();
                cursos.push(c);
            }

            // 4. Materias (ESRN)
            const materias = [];
            const areasESRN = ['Matemática', 'Lengua', 'Biología', 'Historia', 'Física', 'Inglés'];
            for (let c of cursos) {
                for (let i = 0; i < areasESRN.length; i++) {
                    const m = await Materia.create({
                        nombre: areasESRN[i],
                        area: 'Área ESRN',
                        curso_id: c._id,
                        docente_dni: docentes[i % docentes.length].dni
                    });
                    materias.push(m);
                }
            }

            // 5. Alumnos (10 por curso = 40 alumnos)
            let dniCounter = 3000;
            for (let c of cursos) {
                for (let i = 1; i <= 10; i++) {
                    const dni = dniCounter.toString();
                    await User.create({
                        dni: dni,
                        password: 'pass',
                        nombre_completo: `Alumno ${i} de ${c.nombre}`,
                        rol: 'alumno',
                        entidad_id: perito._id
                    });
                    
                    // 6. Cargar algunas Notas (Boletín)
                    for (let m of materias.filter(x => x.curso_id.equals(c._id)).slice(0, 3)) {
                        await Nota.create({
                            alumno_dni: dni,
                            materia_id: m._id,
                            valor: Math.floor(Math.random() * 4) + 7, // Notas entre 7 y 10
                            tipo: 'trimestral',
                            periodo: '1er Trimestre'
                        });
                    }
                    dniCounter++;
                }
            }

            // 7. Noticias
            await Noticia.create([
                { titulo: 'Bienvenida Ciclo 2026', contenido: 'Bienvenidos a todos los alumnos del Instituto Perito Moreno.', entidad_id: perito._id },
                { titulo: 'Exámenes Trimestrales', contenido: 'Las fechas han sido publicadas en el panel de avisos.', entidad_id: perito._id },
                { titulo: 'Feria de Ciencias', contenido: 'Se invita a toda la comunidad el próximo viernes.', entidad_id: perito._id }
            ]);

            // Usuario demo original
            await User.create({ dni: '1001', password: 'alumno', nombre_completo: 'Alumno Demo Especial', rol: 'alumno', entidad_id: perito._id });

            console.log('✅ CARGA MASIVA COMPLETA: 4 cursos, 5 docentes, 40 alumnos y boletines inicializados.');
        }
    } catch (err) {
        console.error('Error al seedear masivo:', err.message);
    }
}

module.exports = { Entidad, User, Curso, Materia, Nota, Noticia, mongoose };