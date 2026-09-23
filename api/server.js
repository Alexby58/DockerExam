require('dotenv').config(); // <-- 1. Cargar variables del archivo .env al inicio

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// 2. Definir la conexión asegurando que ningún campo sea undefined
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'DockerPR',
  user: process.env.DB_USER || 'postgres',
  password: String(process.env.DB_PASSWORD || 'Univalle.'),
});

function calcularEstado(hProgIng, hRealIng, hProgSal, hRealSal) {
  if (hRealIng > hProgIng) {
    return 'ATRASO';
  }
  return 'PUNTUAL';
}

app.get('/api/marcaciones', async (req, res) => {
  try {
    const { empleado, fecha } = req.query;
    let query = 'SELECT * FROM marcaciones WHERE 1=1';
    let params = [];

    if (empleado) {
      params.push(empleado);
      query += ` AND codigo_empleado = $${params.length}`;
    }
    if (fecha) {
      params.push(fecha);
      query += ` AND fecha = $${params.length}`;
    }

    query += ' ORDER BY id DESC';
    const result = await pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/marcaciones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM marcaciones WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Marcación no encontrada' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/marcaciones', async (req, res) => {
  try {
    const { codigo_empleado, nombre_empleado, fecha, hora_ingreso_programada, hora_ingreso_real, hora_salida_programada, hora_salida_real, observacion } = req.body;

    if (!codigo_empleado || !fecha || !hora_ingreso_real || !hora_salida_real) {
      return res.status(400).json({ error: 'Campos obligatorios faltantes' });
    }

    if (hora_salida_real < hora_ingreso_real) {
      return res.status(400).json({ error: 'La hora de salida no puede ser anterior a la hora de ingreso' });
    }

    const estado = calcularEstado(hora_ingreso_programada, hora_ingreso_real, hora_salida_programada, hora_salida_real);

    const query = `
      INSERT INTO marcaciones 
      (codigo_empleado, nombre_empleado, fecha, hora_ingreso_programada, hora_ingreso_real, hora_salida_programada, hora_salida_real, estado, observacion) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`;
    
    const values = [codigo_empleado, nombre_empleado, fecha, hora_ingreso_programada, hora_ingreso_real, hora_salida_programada, hora_salida_real, estado, observacion || ''];
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/marcaciones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo_empleado, nombre_empleado, fecha, hora_ingreso_programada, hora_ingreso_real, hora_salida_programada, hora_salida_real, observacion } = req.body;

    if (hora_salida_real < hora_ingreso_real) {
      return res.status(400).json({ error: 'La hora de salida no puede ser anterior a la hora de ingreso' });
    }

    const estado = calcularEstado(hora_ingreso_programada, hora_ingreso_real, hora_salida_programada, hora_salida_real);

    const query = `
      UPDATE marcaciones SET 
      codigo_empleado=$1, nombre_empleado=$2, fecha=$3, hora_ingreso_programada=$4, 
      hora_ingreso_real=$5, hora_salida_programada=$6, hora_salida_real=$7, estado=$8, observacion=$9 
      WHERE id=$10 RETURNING *`;
    
    const values = [codigo_empleado, nombre_empleado, fecha, hora_ingreso_programada, hora_ingreso_real, hora_salida_programada, hora_salida_real, estado, observacion, id];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) return res.status(404).json({ message: 'Marcación no encontrada' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/marcaciones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM marcaciones WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Marcación no encontrada' });
    res.status(200).json({ message: 'Marcación eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API corriendo en puerto ${PORT}`));