import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path' // 👈 1. Import do path
import router from './routes/index'
import { errorHandler } from './middlewares/errorHandler.middleware'
import { apiLimiter, loginLimiter } from './middlewares/rateLimiter.middleware'
import { assertRequiredEnv } from './config/env'
import { swaggerSpec } from './docs/Swagger'
import swaggerUi from 'swagger-ui-express'

process.on('uncaughtException', (err) => {
  console.error('❌ uncaughtException:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('❌ unhandledRejection:', reason)
  process.exit(1)
})

// Falha no boot (e não no primeiro login) se faltar JWT_SECRET: sem ele qualquer pessoa forja tokens.
try {
  assertRequiredEnv()
} catch (err) {
  console.error('❌', err instanceof Error ? err.message : err)
  process.exit(1)
}

const app = express()
const PORT = process.env.PORT ?? 3333

// Atrás de proxy/load balancer (Railway, Render, Nginx...) defina TRUST_PROXY=1; sem isso o rate limit
// enxerga o IP do proxy (todos os usuários viram um só) e req.ip/auditoria ficam errados.
if (process.env.TRUST_PROXY) {
  const n = Number(process.env.TRUST_PROXY)
  app.set('trust proxy', Number.isNaN(n) ? process.env.TRUST_PROXY : n)
}

// CORS: defina CORS_ORIGINS="https://app.seudominio.com,https://outro.com". Sem a variável, aceita qualquer origem (como antes).
const corsOrigins = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean)
if (corsOrigins.length === 0 && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  CORS_ORIGINS não definido: a API está aceitando requisições de qualquer origem.')
}

app.use(
  cors({
    origin: corsOrigins.length > 0 ? corsOrigins : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'accept'],
  })
)

app.use(express.json())

// Limite geral por IP e limite estrito de login (o rateLimiter.middleware existia, mas não estava montado em lugar nenhum).
// O limiter de login usa req.body.email, por isso vem DEPOIS do express.json().
app.use('/api', apiLimiter)
app.use('/api/auth/login', loginLimiter)

// /uploads/temp guarda áudios de consultas (dado de saúde): nunca servir, mesmo que o arquivo exista.
app.use('/uploads/temp', (_req, res) => {
  res.sendStatus(404)
})

// 👈 2. Libera o acesso público à pasta de uploads para servir fotos/anexos
// ATENÇÃO: esta rota NÃO tem autenticação (quem tem a URL acessa). Se nada local depende dela, remova.
// Anexos clínicos (radiografias, exames) não devem ficar aqui nem em bucket público: use URL assinada.
app.use(
  '/uploads',
  express.static(path.resolve(__dirname, '..', 'uploads'), { dotfiles: 'deny', index: false })
)

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Oris API — Documentação',
}))

app.use('/api', router)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use(errorHandler)

const portNumber = Number(PORT)

app.listen(portNumber, '0.0.0.0', () => {
  console.log(`🚀 Oris API rodando com sucesso na porta ${portNumber}!`)
  console.log(`📖 Swagger em http://localhost:${portNumber}/docs`)
  console.log(`📁 Pasta de uploads acessível em http://localhost:${portNumber}/uploads`)
}).on('error', (err) => {
  console.error('❌ Erro ao iniciar servidor:', err)
  process.exit(1)
})