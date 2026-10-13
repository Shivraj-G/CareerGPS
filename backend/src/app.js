import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFoundHandler } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { internalIngestionRoutes } from './modules/ingestion/ingestion.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  // Parse configured origins, strip trailing slashes, and support comma-separated values
  const configuredOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim().replace(/\/$/, ''));
  const allowedOrigins = new Set(configuredOrigins);
  
  if (env.NODE_ENV !== 'production') {
    allowedOrigins.add('http://localhost:5173');
    allowedOrigins.add('http://localhost:5174');
  }

  app.use(cors({ 
    origin: Array.from(allowedOrigins), 
    credentials: true 
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  app.get('/', (_req, res) => {
    res.json({
      service: 'Goa Career Pathway Intelligence Platform API',
      status: 'ok',
      apiVersion: 'v1'
    });
  });

  app.use('/api/v1', apiRoutes);
  app.use('/internal/v1/ingestion', internalIngestionRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
