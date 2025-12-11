const express = require ('express');
const bodyParser = require('body-parser');
const session = require ('express-session');
const mysql =require ('mysql2/promise');
const cors =require ('cors'); 

const app = express ();

//Middlewares

app.use(cors({
    origin: 'http://localhost:5173', 
    credentials: true, 
  }));
  
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());


//Configuracion de la sesion

app.use(session({
    secret:'Misecreto',
    resave:false,
    saveUninitialized:true,
    cookie:{secure:false}
}))

//configuracion de la base de datos 

const dbConfig ={
    host:'localhost',
    user:'root',
    password:'',
    database:"boardai"
}

const db = mysql.createPool(dbConfig); 

const multer = require("multer");

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });


//Ruta de prueba 
app.get('/',async(req,res)=>{
    try{
        const connection =await mysql.createConnection(dbConfig);
        await connection.connect();
        res.send('Servidor en correcto funcionamiento y base de datos conectada');
        await connection.end();
    }
    catch(error){
        console.error('Error al conectar a la base de datos:',error);
        res.status(500).send('Error al conectar la base de datos')
    }
});

//Ruta de regsitro de usuarioss 
app.post('/register', async(req,res)=>{
    const {nombre, email,contrasena,rol}=req.body;
    
    //Validacion de campos obligatorios 
    if(!nombre || !email || !contrasena || !rol){
        return res.json({
            success: false,
        message:"Todos los campos son Obligatorios" });
    }

    //Validar Rol 

    if (rol !=='profesor' && rol !== 'estudiante'){
        return res.json({
            success:false,
            message:"Rol invalido"
        });
    }

    try{

        //Conectamos base de datos 
        const connection =await mysql.createConnection(dbConfig);

        //Verificamos si el correro no existe 

        const [exist] =await connection.execute(
            "SELECT * FROM usuarios WHERE email = ?",[email]
        );
        if(exist.length > 0){
            return res.json({
                success:false,
                message:"El Email Ya esta registrado"
            });
        }

        //Encriptamos Contraseña
        //const hashedPassword =await bcrypt.hash(contrasena,10);


        //insertamos usuarios a la base de datos 
        await connection.execute(
            "INSERT INTO usuarios (nombre, email, rol, contrasena) VALUES (?, ?, ?, ?)",
            [nombre, email, rol, contrasena]      
        );

        //Cerrar conexion 
        await connection.end();

        res.json({
            success:true,
            message:"Usuarios Registrado"
        });

    }
    catch(error){
        console.error(error);
        res.status(500).json({
            success:false,
            message:"Error en el servido"
      })
    }
});

//Ruta de Login
app.post("/login", async (req, res) => {
    const { email, contrasena } = req.body;

    if (!email || !contrasena) {
        return res.status(400).json({
            success: false,
            message: "Faltan datos"
        });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(
            "SELECT * FROM usuarios WHERE email = ?",
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Usuario no encontrado"
            });
        }

        const usuario = rows[0];

        if (contrasena !== usuario.contrasena) {
            return res.status(401).json({
                success: false,
                message: "Contraseña incorrecta"
            });
        }

        // Guardamos sesión
        req.session.userId = usuario.id_usuario;
        req.session.rol = usuario.rol;

        res.json({
            success: true,
            message: "Login exitoso",
            rol: usuario.rol,
            nombre: usuario.nombre
        });

        await connection.end();
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error en el servidor" });
    }
});

// Ruta Perfil
app.get("/profile", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: "No autorizado" });
    }

    try {
      const connection = await mysql.createConnection(dbConfig);
      const [rows] = await connection.execute(
        "SELECT id_usuario, nombre, email, rol, foto_perfil FROM usuarios WHERE id_usuario = ?",
        [req.session.userId]
      );
      await connection.end();

      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: "Usuario no encontrado" });
      }

      res.json({ success: true, usuario: rows[0] });

    } catch (error) {
      console.log(error);
      res.status(500).json({ success: false, message: "Error del servidor" });
    }
});




////////////////////////////////////////
//Rutas Para Editar usuarios como profe y estudiante
////////////////////////////////////////


//Se usa para e tema de las imagnes desde el file , para que se guarden y no se rompan 
app.use("/uploads", express.static("uploads"));


//Obtenemos informacion del estudiante
app.get("/userinfo", async (req, res) => {
  if (!req.session.userId) {
    return res.json({ error: "No autenticado" });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute(
      "SELECT id_usuario, nombre, email, rol, foto_perfil FROM usuarios WHERE id_usuario = ?",
      [req.session.userId]
    );

    await connection.end();

    if (rows.length === 0) {
      return res.json({ error: "Usuario no encontrado" });
    }

    res.json({ success: true, usuario: rows[0] });

  } catch (error) {
    res.json({ error });
  }
});

// Ruta para subir foto de perfil
app.post("/upload-profile-pic", upload.single("foto"), async (req, res) => {
  if (!req.session.userId) {
      return res.status(401).json({ success: false, message: "No autorizado" });
  }

  if (!req.file) {
      return res.json({ success: false, message: "No se recibió ninguna imagen" });
  }

  const nuevaFoto = "/uploads/" + req.file.filename;

  try {
      const connection = await mysql.createConnection(dbConfig);

      await connection.execute(
          "UPDATE usuarios SET foto_perfil = ? WHERE id_usuario = ?",
          [nuevaFoto, req.session.userId]
      );

      await connection.end();

      res.json({
          success: true,
          foto: nuevaFoto
      });

  } catch (error) {
      console.error(error);
      res.json({ success: false, message: "Error al subir imagen" });
  }
});

//Ruta actualizada para editar perfil
app.put("/update-profile", async (req, res) => {
  if (!req.session.userId) {
      return res.status(401).json({
          success: false,
          message: "No autorizado"
      });
  }

  const { nombre, email, foto_perfil, contrasena } = req.body;

  try {
      const connection = await mysql.createConnection(dbConfig);

      if (contrasena && contrasena.trim() !== "") {
          await connection.execute(
              "UPDATE usuarios SET nombre = ?, email = ?, foto_perfil = ?, contrasena = ? WHERE id_usuario = ?",
              [nombre, email, foto_perfil, contrasena, req.session.userId]
          );
      } else {
          await connection.execute(
              "UPDATE usuarios SET nombre = ?, email = ?, foto_perfil = ? WHERE id_usuario = ?",
              [nombre, email, foto_perfil, req.session.userId]
          );
      }

      await connection.end();

      res.json({
          success: true,
          message: "Perfil actualizado"
      });

  } catch (error) {
      console.error(error);
      res.status(500).json({
          success: false,
          message: "Error al actualizar perfil"
      });
  }
});

//////////////////////////////////
//Fin
/////////////////////////////////



////////////////////////////////////////
//Rutas para materias 
////////////////////////////////////////

// Crear materia (solo profesor)
app.post("/crear-materia", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "No autorizado"
    });
  }

  const { nombre, descripcion } = req.body;

  if (!nombre || nombre.trim() === "") {
    return res.json({
      success: false,
      message: "El nombre es obligatorio"
    });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Verificar que el usuario sea profesor
    const [prof] = await connection.execute(
      "SELECT rol FROM usuarios WHERE id_usuario = ?",
      [req.session.userId]
    );

    if (prof.length === 0 || prof[0].rol !== "profesor") {
      await connection.end();
      return res.json({
        success: false,
        message: "Solo los profesores pueden crear materias"
      });
    }

    // Insertar la materia
    await connection.execute(
      "INSERT INTO materias (nombre, descripcion, id_profesor) VALUES (?, ?, ?)",
      [nombre, descripcion, req.session.userId]
    );

    await connection.end();

    res.json({
      success: true,
      message: "Materia creada correctamente"
    });

  } catch (error) {
    console.error(error);
    res.json({
      success: false,
      message: "Error al crear materia"
    });
  }
});

// Obtener materias del profesor logueado
app.get("/materias/profesor", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "No autenticado" });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Verificar que sea profesor
    const [prof] = await connection.execute(
      "SELECT rol FROM usuarios WHERE id_usuario = ?",
      [req.session.userId]
    );

    if (prof.length === 0 || prof[0].rol !== "profesor") {
      await connection.end();
      return res.json({
        success: false,
        message: "Solo los profesores pueden ver sus materias"
      });
    }

    // Obtener materias
    const [materias] = await connection.execute(
      "SELECT * FROM materias WHERE id_profesor = ?",
      [req.session.userId]
    );

    await connection.end();

    return res.json({
      success: true,
      materias
    });

  } catch (error) {
    console.log(error);
    return res.json({
      success: false,
      message: "Error en el servidor"
    });
  }
});

// ELIMINAR MATERIA
app.delete("/materias/eliminar/:id", async (req, res) => {
  if (!req.session.userId) {
      return res.status(401).json({
          success: false,
          message: "No autorizado"
      });
  }

  const idMateria = req.params.id;

  try {
      const connection = await mysql.createConnection(dbConfig);

      // Verificar que la materia pertenece al profesor
      const [rows] = await connection.execute(
          "SELECT * FROM materias WHERE id_materia = ? AND id_profesor = ?",
          [idMateria, req.session.userId]
      );

      if (rows.length === 0) {
          await connection.end();
          return res.json({
              success: false,
              message: "No puedes eliminar esta materia"
          });
      }

      // Eliminar
      await connection.execute(
          "DELETE FROM materias WHERE id_materia = ?",
          [idMateria]
      );

      await connection.end();

      res.json({
          success: true,
          message: "Materia eliminada correctamente"
      });

  } catch (error) {
      console.log(error);
      res.json({
          success: false,
          message: "Error al eliminar materia"
      });
  }
});


////////////////////////////////////////////////////
//Fin
//////////////////////////////////////////////////




///////////////////////////////////////////////////////
//Inscribirse a materia
////////////////////////////////////////////////////////

function autenticarEstudiante(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "No autorizado. Inicia sesión."
    });
  }

  // Guardamos los datos del usuario en req.user
  req.user = { id: req.session.userId };
  next();
}


//Ver materias disponibles (no inscritas)
app.get("/materias/disponibles", async (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: "No autorizado" });
  }

  const id_estudiante = req.session.userId;

  try {
    const connection = await mysql.createConnection(dbConfig);

    const [materias] = await connection.execute(
      `SELECT m.id_materia, m.nombre, m.descripcion
       FROM materias m
       WHERE m.id_materia NOT IN (
         SELECT id_materia FROM inscripciones WHERE id_estudiante = ?
       )`,
      [id_estudiante]
    );

    await connection.end();
    res.json({ success: true, materias });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error de servidor" });
  }
});


//Ruta para que el estudiante vea sus materias inscritas
app.post("/inscribirse/:id_materia", async (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: "No autorizado" });
  }

  const id_estudiante = req.session.userId;
  const id_materia = req.params.id_materia;

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Verificar si ya está inscrito
    const [exist] = await connection.execute(
      "SELECT * FROM inscripciones WHERE id_estudiante = ? AND id_materia = ?",
      [id_estudiante, id_materia]
    );

    if (exist.length > 0) {
      return res.json({
        success: false,
        message: "Ya estás inscrito en esta materia."
      });
    }

    await connection.execute(
      "INSERT INTO inscripciones (id_materia, id_estudiante, fecha_inscripcion) VALUES (?,?,NOW())",
      [id_materia, id_estudiante]
    );

    await connection.end();

    res.json({ success: true, message: "Inscripción exitosa" });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error de servidor" });
  }
});

//
app.get("/mis-materias", autenticarEstudiante, async (req, res) => {
  const id_estudiante = req.user.id;

  const query = `
    SELECT m.*, i.id_inscripcion
    FROM inscripciones i
    INNER JOIN materias m ON m.id_materia = i.id_materia
    WHERE i.id_estudiante = ?
  `;
  
  const materias = await db.query(query, [id_estudiante]);

  res.json({ success: true, materias });
});

//Necesario para poder eliminar
app.delete("/inscripciones/:id_inscripcion", autenticarEstudiante, async (req, res) => {
  const id_inscripcion = req.params.id_inscripcion;

  await db.query(
    "DELETE FROM inscripciones WHERE id_inscripcion = ?",
    [id_inscripcion]
  );

  res.json({ success: true, message: "Te has salido de la materia" });
});




/////////////////////////////////////////////////
//Lisatado de estudiantes
///////////////////////////////////////////////////

// Middleware para autenticar profesor
function autenticarProfesor(req, res, next) {
  if (!req.session.userId || req.session.rol !== "profesor") {
    return res.status(401).json({ success: false, message: "No autorizado" });
  }
  next();
}


//  Obtener estudiantes inscritos en una materia
app.get("/profesor/materia/:id_materia/estudiantes", autenticarProfesor, async (req, res) => {
  const id_profesor = req.session.userId;
  const id_materia = req.params.id_materia;

  try {
    const connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute(
      `SELECT u.id_usuario, u.nombre, u.email 
       FROM inscripciones i
       INNER JOIN usuarios u ON u.id_usuario = i.id_estudiante
       INNER JOIN materias m ON m.id_materia = i.id_materia
       WHERE m.id_materia = ? AND m.id_profesor = ?`,
      [id_materia, id_profesor]
    );

    await connection.end();

    res.json({ success: true, estudiantes: rows });

  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Error en servidor" });
  }
});




/////////////////////////////////////////////////
//Fin
///////////////////////////////////////////////////










//Inicializa el servidor
app.listen(5000,()=>{
    console.log('Servidor corriendo el en puerto 5000')
})

