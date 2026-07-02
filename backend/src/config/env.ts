import dotenv from 'dotenv';
dotenv.config();

export const config = {
  PORT: process.env.PORT || 4000,
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_intern_key_123',
  DATABASE_URL: process.env.DATABASE_URL
};
