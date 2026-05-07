const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'pei.db');
const db = new Database(dbPath);

// Inicializar Tablas
db.exec(`
    CREATE TABLE IF NOT EXISTS entidades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT UNIQUE,
        logo_url TEXT,
        direccion TEXT,
        telefono TEXT,
        configuracion TEXT -- JSON con detalles de la entidad
    );

    CREATE TABLE IF NOT EXISTS usuarios (
        dni TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        nombre_completo TEXT NOT NULL,
        rol TEXT NOT NULL, -- admin_global, director, secretario, docente, alumno, tutor
        entidad_id INTEGER,
        FOREIGN KEY (entidad_id) REFERENCES entidades(id)
    );

    CREATE TABLE IF NOT EXISTS cursos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL, -- Ej: 1A, 2B
        nivel TEXT NOT NULL, -- inicial, primaria, secundaria, terciario
        entidad_id INTEGER,
        FOREIGN KEY (entidad_id) REFERENCES entidades(id)
    );

    CREATE TABLE IF NOT EXISTS materias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        area TEXT, -- Ej: Ciencias Naturales, Matemática, etc.
        curso_id INTEGER,
        docente_dni TEXT,
        FOREIGN KEY (curso_id) REFERENCES cursos(id),
        FOREIGN KEY (docente_dni) REFERENCES usuarios(dni)
    );

    CREATE TABLE IF NOT EXISTS inscripciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alumno_dni TEXT,
        curso_id INTEGER,
        FOREIGN KEY (alumno_dni) REFERENCES usuarios(dni),
        FOREIGN KEY (curso_id) REFERENCES cursos(id)
    );

    CREATE TABLE IF NOT EXISTS notas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alumno_dni TEXT,
        materia_id INTEGER,
        nota REAL,
        tipo TEXT, -- seguimiento, trimestral, final
        periodo TEXT, -- 1er Trimestre, etc.
        comentario TEXT,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (alumno_dni) REFERENCES usuarios(dni),
        FOREIGN KEY (materia_id) REFERENCES materias(id)
    );

    CREATE TABLE IF NOT EXISTS asistencias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alumno_dni TEXT,
        curso_id INTEGER,
        fecha DATE,
        estado TEXT, -- presente, ausente, justificado
        FOREIGN KEY (alumno_dni) REFERENCES usuarios(dni),
        FOREIGN KEY (curso_id) REFERENCES cursos(id)
    );
`);

// Seeding de Datos Demo: Instituto Perito Moreno
function seedDemo() {
    const check = db.prepare('SELECT count(*) as count FROM entidades WHERE nombre = ?').get('Instituto Perito Moreno');
    
    if (check.count === 0) {
        // 1. Crear Entidad
        const insertEntidad = db.prepare('INSERT INTO entidades (nombre, direccion, telefono) VALUES (?, ?, ?)');
        const entidadInfo = insertEntidad.run('Instituto Perito Moreno', 'Av. Bustillo 123, Bariloche', '294-4556677');
        const entidadId = entidadInfo.lastInsertRowid;

        // 2. Crear Usuarios (Admin Global y Admin de Escuela)
        const insertUser = db.prepare('INSERT INTO usuarios (dni, password, nombre_completo, rol, entidad_id) VALUES (?, ?, ?, ?, ?)');
        
        insertUser.run('123', 'admin', 'Pugliese Nicolas', 'admin_global', null);
        insertUser.run('456', 'perito', 'Director Perito Moreno', 'director', entidadId);
        
        // 3. Crear Cursos
        const insertCurso = db.prepare('INSERT INTO cursos (nombre, nivel, entidad_id) VALUES (?, ?, ?)');
        const curso1A = insertCurso.run('1A', 'secundaria', entidadId).lastInsertRowid;
        const curso2A = insertCurso.run('2A', 'secundaria', entidadId).lastInsertRowid;

        // 4. Crear Docentes
        insertUser.run('111', 'docente', 'Prof. Juan Perez', 'docente', entidadId);
        
        // 5. Crear Alumnos
        insertUser.run('1001', 'alumno', 'Alumno Ejemplo 1', 'alumno', entidadId);
        insertUser.run('1002', 'alumno', 'Alumno Ejemplo 2', 'alumno', entidadId);

        // 6. Inscribir Alumnos
        const insertInscripcion = db.prepare('INSERT INTO inscripciones (alumno_dni, curso_id) VALUES (?, ?)');
        insertInscripcion.run('1001', curso1A);
        insertInscripcion.run('1002', curso1A);

        // 7. Crear Materias
        const insertMateria = db.prepare('INSERT INTO materias (nombre, area, curso_id, docente_dni) VALUES (?, ?, ?, ?)');
        insertMateria.run('Matemática', 'Exactas', curso1A, '111');
        insertMateria.run('Lengua', 'Comunicación', curso1A, '111');

        console.log('✅ Demo "Instituto Perito Moreno" creada con éxito.');
    }
}

seedDemo();

module.exports = db;
