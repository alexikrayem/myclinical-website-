import { jest } from '@jest/globals';

export const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(true)
};

export const getRedisClient = jest.fn(() => Promise.resolve(mockRedis));
export const isRedisAvailable = jest.fn(() => true);
