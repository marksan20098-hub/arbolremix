import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  createPunto,
  deletePunto,
  getPuntoById,
  isSupabaseConfigured,
  listPuntos,
  restoreSeedPuntos,
  StoreConflictError,
  StoreNotFoundError,
  updatePunto,
} from './src/server/store.ts';
import { validatePuntoInput } from './src/types/punto.ts';
import type { TareaTipo } from './src/types/punto.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  // Healthcheck endpoint for Render
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'arboleda-gis-api',
      database: isSupabaseConfigured() ? 'supabase' : 'local',
      table: 'puntos_arbolado',
      timestamp: new Date().toISOString(),
    });
  });

  // Public runtime config (never exposes Supabase private keys)
  app.get('/api/public-config', (_req, res) => {
    res.json({
      googleMapsApiKey:
        process.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ||
        process.env.GOOGLE_MAPS_API_KEY?.trim() ||
        '',
      storageMode: isSupabaseConfigured() ? 'supabase' : 'local',
    });
  });

  // List tree points (optional filter by tarea: riego | poda, and search query q)
  app.get('/api/puntos', async (req, res) => {
    try {
      const rawTarea = typeof req.query.tarea === 'string' ? req.query.tarea.trim().toLowerCase() : 'todas';
      if (rawTarea !== 'todas' && rawTarea !== 'riego' && rawTarea !== 'poda') {
        return res.status(400).json({
          error: 'El parámetro "tarea" debe ser "riego", "poda" o "todas".',
        });
      }

      const search = typeof req.query.q === 'string' ? req.query.q : undefined;
      const puntos = await listPuntos({
        tarea: rawTarea as TareaTipo | 'todas',
        search,
      });

      return res.json({
        data: puntos,
        meta: {
          total: puntos.length,
          storageMode: isSupabaseConfigured() ? 'supabase' : 'local',
        },
      });
    } catch (error) {
      console.error('GET /api/puntos error:', error);
      return res.status(500).json({
        error: 'No se pudieron obtener los puntos de arbolado.',
      });
    }
  });

  // Get single tree point by ID
  app.get('/api/puntos/:id', async (req, res) => {
    try {
      const id = req.params.id?.trim();
      if (!id) {
        return res.status(400).json({ error: 'ID inválido.' });
      }
      const punto = await getPuntoById(id);
      return res.json({ data: punto });
    } catch (error) {
      if (error instanceof StoreNotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      console.error('GET /api/puntos/:id error:', error);
      return res.status(500).json({ error: 'No se pudo obtener el punto solicitado.' });
    }
  });

  // Create new tree point
  app.post('/api/puntos', async (req, res) => {
    try {
      const validation = validatePuntoInput(req.body ?? {});
      if (!validation.valid || !validation.normalized) {
        return res.status(400).json({
          error: 'Datos inválidos. Revisá los campos ingresados.',
          fields: validation.errors,
        });
      }

      const created = await createPunto(validation.normalized);
      return res.status(201).json({ data: created });
    } catch (error) {
      if (error instanceof StoreConflictError) {
        return res.status(409).json({ error: error.message });
      }
      console.error('POST /api/puntos error:', error);
      return res.status(500).json({ error: 'No se pudo registrar el punto de arbolado.' });
    }
  });

  // Update tree point
  const handleUpdate = async (req: express.Request, res: express.Response) => {
    try {
      const id = req.params.id?.trim();
      if (!id) {
        return res.status(400).json({ error: 'ID inválido.' });
      }

      const validation = validatePuntoInput(req.body ?? {});
      if (!validation.valid || !validation.normalized) {
        return res.status(400).json({
          error: 'Datos inválidos. Revisá los campos ingresados.',
          fields: validation.errors,
        });
      }

      const updated = await updatePunto(id, validation.normalized);
      return res.json({ data: updated });
    } catch (error) {
      if (error instanceof StoreNotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      if (error instanceof StoreConflictError) {
        return res.status(409).json({ error: error.message });
      }
      console.error('PUT/PATCH /api/puntos/:id error:', error);
      return res.status(500).json({ error: 'No se pudo actualizar el punto.' });
    }
  };

  app.put('/api/puntos/:id', handleUpdate);
  app.patch('/api/puntos/:id', handleUpdate);

  // Delete tree point
  app.delete('/api/puntos/:id', async (req, res) => {
    try {
      const id = req.params.id?.trim();
      if (!id) {
        return res.status(400).json({ error: 'ID inválido.' });
      }

      await deletePunto(id);
      return res.json({ deleted: true, id });
    } catch (error) {
      if (error instanceof StoreNotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      console.error('DELETE /api/puntos/:id error:', error);
      return res.status(500).json({ error: 'No se pudo eliminar el punto.' });
    }
  });

  // Restore missing sample records
  app.post('/api/puntos/seed', async (_req, res) => {
    try {
      const data = await restoreSeedPuntos();
      return res.json({ data });
    } catch (error) {
      console.error('POST /api/puntos/seed error:', error);
      return res.status(500).json({ error: 'No se pudieron restaurar los tres ejemplos.' });
    }
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Arboleda GIS listening on http://0.0.0.0:${PORT} (${isSupabaseConfigured() ? 'Supabase' : 'Local fallback'})`
    );
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
