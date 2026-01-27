import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Tabeeb API',
            version: '1.0.0',
            description: 'API documentation for Tabeeb dental education platform',
            contact: {
                name: 'API Support',
                email: 'support@tabeeb.com',
            },
        },
        servers: [
            {
                url: process.env.API_URL || 'http://localhost:5001/api',
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                Article: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        title: { type: 'string' },
                        slug: { type: 'string' },
                        excerpt: { type: 'string' },
                        content: { type: 'string' },
                        cover_image: { type: 'string' },
                        author: { type: 'string' },
                        tags: { type: 'array', items: { type: 'string' } },
                        article_type: { type: 'string', enum: ['article', 'clinical_case'] },
                        is_featured: { type: 'boolean' },
                        publication_date: { type: 'string', format: 'date-time' },
                    },
                },
                Course: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        price: { type: 'number' },
                        duration_hours: { type: 'number' },
                        instructor: { type: 'string' },
                        is_featured: { type: 'boolean' },
                    },
                },
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        phone_number: { type: 'string' },
                        display_name: { type: 'string' },
                    },
                },
                Credits: {
                    type: 'object',
                    properties: {
                        balance: { type: 'number' },
                        video_watch_minutes: { type: 'number' },
                        article_credits: { type: 'number' },
                        total_earned: { type: 'number' },
                        total_spent: { type: 'number' },
                    },
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                    },
                },
                Pagination: {
                    type: 'object',
                    properties: {
                        total: { type: 'integer' },
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        pages: { type: 'integer' },
                    },
                },
            },
        },
        tags: [
            { name: 'Articles', description: 'Article management endpoints' },
            { name: 'Courses', description: 'Course management endpoints' },
            { name: 'Auth', description: 'Authentication endpoints' },
            { name: 'Credits', description: 'Credit system endpoints' },
            { name: 'Admin', description: 'Admin panel endpoints' },
        ],
    },
    apis: ['./routes/*.js'], // Path to the API files
};

const specs = swaggerJsdoc(options);

/**
 * Setup Swagger documentation
 * @param {Express} app - Express application
 */
export const setupSwagger = (app) => {
    // Serve Swagger UI
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Tabeeb API Documentation',
    }));

    // Serve OpenAPI spec as JSON
    app.get('/api/docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(specs);
    });

    console.log('📚 API Documentation available at /api/docs');
};

export default specs;
