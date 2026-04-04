import { Redis, RedisOptions } from 'ioredis';

const redisConfig: RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // BullMQ requirement
};

// Singleton connection for BullMQ
let connection: Redis;

export const getRedisConnection = () => {
    if (!connection) {
        connection = new Redis(redisConfig);
    }
    return connection;
};
