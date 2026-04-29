import * as admin from 'firebase-admin';
import { Logger } from '@nestjs/common';
import { envs } from 'src/config/envs';

let app: admin.app.App | null = null;
const logger = new Logger('FirebaseAdminProvider');

export function getFirebaseAdmin(): admin.app.App | null {
  if (app) return app;
  const projectId = envs.firebaseProjectId;
  const clientEmail = envs.firebaseClientEmail;
  const privateKey = envs.firebasePrivateKey;
  if (!projectId || !clientEmail || !privateKey) {
    logger.warn('Firebase credentials not configured');
    return null;
  }
  app = admin.initializeApp(
    {
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    },
    'backend',
  );
  return app;
}
