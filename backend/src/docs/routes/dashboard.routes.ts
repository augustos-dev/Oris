// backend/src/routes/dashboard.routes.ts

import { Router } from 'express'
import {
  getDashboardSummaryController,
  getRevenueChartController,
  getUpcomingAppointmentsController,
  getTopDentistsController,
  getClinicsBreakdownController,
} from '../../controllers/dashboardController'
import { authenticate, authorize } from '../../middlewares/authMiddlewares'

const router = Router()

// ─── Todas as rotas do dashboard são privadas e exclusivas de ADMIN (e OWNER) ─

router.use(authenticate)
router.use(authorize('ADMIN'))

/**
 * @openapi
 * components:
 *   parameters:
 *     DashboardScope:
 *       in: query
 *       name: scope
 *       schema: { type: string, enum: [clinic, network], default: clinic }
 *       description: >
 *         `clinic` (padrão) = unidade ativa. `network` = consolidado de todas as unidades do tenant
 *         (exclusivo do OWNER; 403 para os demais).
 *   schemas:
 *     ClinicBreakdownRow:
 *       type: object
 *       properties:
 *         clinicId: { type: string, format: uuid }
 *         name: { type: string, example: "Messejana" }
 *         monthRevenue: { type: number }
 *         monthExpenses: { type: number }
 *         monthProfit: { type: number }
 *         appointmentsThisMonth: { type: integer }
 *         appointmentsFinalizedThisMonth: { type: integer }
 *         newPatientsThisMonth: { type: integer }
 */

/**
 * @openapi
 * /dashboard/summary:
 *   get:
 *     summary: Retorna visão geral consolidada (pacientes, agendamentos, financeiro, estoque)
 *     tags: [Dashboard]
 *     parameters:
 *       - $ref: '#/components/parameters/DashboardScope'
 *     responses:
 *       200:
 *         description: Resumo do dia, semana e mês
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardSummary'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/summary', getDashboardSummaryController)

/**
 * @openapi
 * /dashboard/revenue-chart:
 *   get:
 *     summary: Retorna receita e despesa diária para gráfico no período informado
 *     tags: [Dashboard]
 *     parameters:
 *       - $ref: '#/components/parameters/DashboardScope'
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         description: Padrão é o início do mês atual
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *         description: Padrão é o fim do mês atual
 *     responses:
 *       200:
 *         description: Array com receitas, despesas e lucro por dia
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   date: { type: string, format: date }
 *                   receitas: { type: number }
 *                   despesas: { type: number }
 *                   lucro: { type: number }
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/revenue-chart', getRevenueChartController)

/**
 * @openapi
 * /dashboard/upcoming-appointments:
 *   get:
 *     summary: Lista os próximos 10 agendamentos confirmados ou agendados
 *     description: Com `scope=network`, cada item traz a unidade (`clinic`).
 *     tags: [Dashboard]
 *     parameters:
 *       - $ref: '#/components/parameters/DashboardScope'
 *     responses:
 *       200:
 *         description: Lista de próximos agendamentos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Appointment' }
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/upcoming-appointments', getUpcomingAppointmentsController)

/**
 * @openapi
 * /dashboard/top-dentists:
 *   get:
 *     summary: Ranking dos 5 dentistas com mais atendimentos finalizados no mês
 *     tags: [Dashboard]
 *     parameters:
 *       - $ref: '#/components/parameters/DashboardScope'
 *     responses:
 *       200:
 *         description: Lista ordenada de dentistas por número de atendimentos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   dentistId: { type: string, format: uuid }
 *                   name: { type: string }
 *                   cro: { type: string }
 *                   appointmentsCount: { type: integer }
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/top-dentists', getTopDentistsController)

/**
 * @openapi
 * /dashboard/clinics-breakdown:
 *   get:
 *     summary: Comparativo do mês entre as unidades da rede (exclusivo do OWNER)
 *     description: Receita, despesa, lucro, atendimentos e pacientes novos do mês corrente, por unidade ativa.
 *     tags: [Dashboard - Rede]
 *     responses:
 *       200:
 *         description: Uma linha por unidade ativa
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/ClinicBreakdownRow' }
 *       403:
 *         description: Exclusivo do dono da rede (OWNER)
 */
router.get('/clinics-breakdown', getClinicsBreakdownController)

export default router
