import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  PORT: number;
  DATABASE_URL: string;

  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  VITE_FIREBASE_API_KEY: string;
  VITE_FIREBASE_AUTH_DOMAIN: string;
  VITE_FIREBASE_PROJECT_ID: string;

  ALLOWED_ORIGINS?: string;
  AZURE_SERVICE_BUS_CONNECTION_STRING: string;
  AZURE_SERVICE_BUS_TOPIC: string;
  AZURE_SERVICE_BUS_SUBSCRIPTION: string;
}
const envsSchema = joi
  .object({
    PORT: joi.number().required(),
    DATABASE_URL: joi.string().required(),
    FIREBASE_PROJECT_ID: joi.string().required(),
    FIREBASE_CLIENT_EMAIL: joi.string().required(),
    FIREBASE_PRIVATE_KEY: joi.string().required(),
    VITE_FIREBASE_API_KEY: joi.string().required(),
    VITE_FIREBASE_AUTH_DOMAIN: joi.string().required(),
    VITE_FIREBASE_PROJECT_ID: joi.string().required(),
    ALLOWED_ORIGINS: joi.string().optional(),
    AZURE_SERVICE_BUS_CONNECTION_STRING: joi.string().required(),
    AZURE_SERVICE_BUS_TOPIC: joi.string().required(),
    AZURE_SERVICE_BUS_SUBSCRIPTION: joi.string().required(),
  })
  .unknown(true);

let envVarsCache: EnvVars | null = null;

function getEnvVars(): EnvVars {
  if (envVarsCache) return envVarsCache;
  const result = envsSchema.validate(process.env);
  if (result.error) {
    throw new Error(`Config validation error: ${result.error.message}`);
  }
  envVarsCache = result.value as EnvVars;
  return envVarsCache;
}

export const envs = {
  get port() {
    return getEnvVars().PORT;
  },
  get databaseurl() {
    return getEnvVars().DATABASE_URL;
  },
  get firebaseProjectId() {
    return getEnvVars().FIREBASE_PROJECT_ID;
  },
  get firebaseClientEmail() {
    return getEnvVars().FIREBASE_CLIENT_EMAIL;
  },
  get firebasePrivateKey() {
    return getEnvVars().FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
  },
  get firebaseApiKey() {
    return getEnvVars().VITE_FIREBASE_API_KEY;
  },
  get firebaseAuthDomain() {
    return getEnvVars().VITE_FIREBASE_AUTH_DOMAIN;
  },
  get firebaseProjectIdFrontend() {
    return getEnvVars().VITE_FIREBASE_PROJECT_ID;
  },
  get allowedOrigins() {
    return (
      getEnvVars().ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173']
    );
  },
  get azureServiceBusConnectionString() {
    return getEnvVars().AZURE_SERVICE_BUS_CONNECTION_STRING;
  },
  get azureServiceBusTopic() {
    return getEnvVars().AZURE_SERVICE_BUS_TOPIC;
  },
  get azureServiceBusSubscription() {
    return getEnvVars().AZURE_SERVICE_BUS_SUBSCRIPTION;
  },
};
