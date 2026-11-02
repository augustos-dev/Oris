// backend/src/docs/Swagger.ts
import path from 'path'
import swaggerJsdoc from 'swagger-jsdoc'

// ─── Marca ───────────────────────────────────────────────────────────────────
const API_TITLE = 'Oris API'
const API_SUBTITLE = 'Oris Dental'

// ─── Onde estão os comentários @openapi ──────────────────────────────────────
// Usa __dirname para funcionar tanto em desenvolvimento (src/*.ts, via tsx) quanto em produção (dist/*.js).
// Lê os arquivos *.routes.* da pasta docs/routes e, se existirem, também os de routes/** (ao lado do index).
const apis = [
  path.resolve(__dirname, 'routes', '*.routes.{ts,js}'),
  path.resolve(__dirname, '..', 'routes', '**', '*.routes.{ts,js}'),
]

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: API_TITLE,
      version: process.env.npm_package_version || '1.0.0',
      description: [
        `### ${API_SUBTITLE}`,
        '',
        'API de gestão para clínicas odontológicas: pacientes, prontuário e odontograma, agenda, estoque com baixa automática por procedimento, financeiro e rede de clínicas.',
        '',
        '**Autenticação:** envie o token JWT no cabeçalho `Authorization: Bearer <token>` (obtido em `POST /auth/login`). Use o botão **Authorize** acima.',
        '',
        '**Multi-tenant e unidades:** cada requisição opera na *unidade ativa* do token. No plano **Enterprise** (rede de clínicas) o paciente e o prontuário são únicos na rede; ' +
          'troque de unidade com `POST /auth/switch-clinic` e use o novo token.',
        '',
        '**Erros:** todas as falhas seguem o formato `{ "message": "..." }` (e, quando útil, `details`). Limite de requisições por IP: resposta `429`.',
      ].join('\n'),
      contact: {
        name: 'Augusto Dev',
        url: 'https://github.com/augustos-dev',
      },
    },
    servers: [
      {
        url: 'https://odontoflow-bbcl.onrender.com/api',
        description: 'Servidor de produção (Render)',
      },
      {
        url: 'http://localhost:3333/api',
        description: 'Servidor local de desenvolvimento',
      },
    ],
    // servers: [
    //   {
    //     url: process.env.API_PUBLIC_URL || '/api',
    //     description: 'Servidor da API (prefixo /api)',
    //   },
    // ],
    tags: [
      { name: 'Auth', description: 'Login, cadastro de colaborador e perfil' },
      { name: 'Auth - Rede', description: 'Unidades acessíveis e troca da unidade ativa (plano Enterprise)' },
      { name: 'Patients', description: 'Cadastro de pacientes' },
      { name: 'MedicalRecords', description: 'Prontuário, evoluções clínicas e odontograma' },
      { name: 'Medical Records Public', description: 'Preenchimento público de anamnese por link temporário (validade de 36 horas)' },
      { name: 'Appointments', description: 'Agenda e atendimento (dispara a baixa automática de estoque ao finalizar)' },
      { name: 'Treatment Plans', description: 'Planos de tratamento e orçamentos' },
      { name: 'Procedures', description: 'Catálogo de procedimentos e ficha técnica (insumos) por unidade' },
      { name: 'Products', description: 'Estoque e insumos (por unidade)' },
      { name: 'Stock Movements', description: 'Histórico de movimentações de estoque' },
      { name: 'Suppliers', description: 'Fornecedores (por unidade)' },
      { name: 'Transactions', description: 'Financeiro: receitas e despesas (por unidade)' },
      { name: 'Dashboard', description: 'Indicadores da unidade' },
      { name: 'Dashboard - Rede', description: 'Comparativo entre unidades (dono da rede)' },
      { name: 'Clinics', description: 'Unidades (clínicas) do tenant' },
      { name: 'Clinics - White-label', description: 'Identidade visual da unidade' },
      { name: 'Clinics - Catálogo da unidade', description: 'Procedimentos ativos, preços e receitas por unidade (Enterprise)' },
      { name: 'Users', description: 'Usuários da unidade' },
      { name: 'Users - RBAC', description: 'Permissões granulares por papel' },
      { name: 'Users - Rede', description: 'Usuários que atuam em mais de uma unidade (Enterprise)' },
      { name: 'AuditLogs', description: 'Trilha de auditoria' },
    ],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      responses: {
        Unauthorized: {
          description: 'Não autenticado: token ausente, inválido ou expirado',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Forbidden: {
          description: 'Sem permissão para esta ação (papel, plano ou limite do pacote)',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        NotFound: {
          description: 'Registro não encontrado',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Conflict: {
          description: 'Conflito: o registro já existe ou há conflito de horário',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Registro não encontrado.' },
            details: { type: 'object', additionalProperties: true, description: 'Dados extras quando úteis ao front (ex.: patientId)' },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            total: { type: 'integer', example: 42 },
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            totalPages: { type: 'integer', example: 3 },
          },
        },

        // ── Auth ──
        LoginDTO: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'dra.ana@clinica.com' },
            password: { type: 'string', format: 'password' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'JWT. Em /auth/switch-clinic substitui o token anterior.' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                email: { type: 'string', format: 'email' },
                role: { type: 'string', enum: ['ADMIN', 'DENTIST', 'SECRETARY', 'OWNER'] },
                tenantId: { type: 'string', format: 'uuid' },
                clinicId: { type: 'string', format: 'uuid', description: 'Unidade ativa do token' },
                avatarUrl: { type: 'string', nullable: true },
                plan: { type: 'string', enum: ['BASIC', 'PREMIUM', 'ENTERPRISE'] },
              },
            },
          },
        },

        // ── Pacientes ──
        Patient: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            clinicId: { type: 'string', format: 'uuid', description: 'Unidade onde o paciente foi cadastrado' },
            clinic: {
              type: 'object',
              nullable: true,
              properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string' } },
            },
            name: { type: 'string', example: 'Maria Silva' },
            phone: { type: 'string', example: '85999990000' },
            email: { type: 'string', nullable: true },
            cpf: { type: 'string', nullable: true, example: '11122233344', description: 'Somente dígitos. Único por tenant.' },
            birthDate: { type: 'string', format: 'date-time', nullable: true },
            gender: { type: 'string', enum: ['MASCULINO', 'FEMININO', 'OUTRO', 'NAO_INFORMADO'] },
            address: { type: 'string', nullable: true },
            zipCode: { type: 'string', nullable: true },
            city: { type: 'string', nullable: true },
            state: { type: 'string', nullable: true },
            guardianName: { type: 'string', nullable: true },
            guardianCpf: { type: 'string', nullable: true },
            guardianBirthDate: { type: 'string', format: 'date-time', nullable: true },
            insuranceName: { type: 'string', nullable: true, example: 'Particular' },
            insuranceCardNumber: { type: 'string', nullable: true },
            insuranceHolderName: { type: 'string', nullable: true },
            insuranceHolderCpf: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreatePatientDTO: {
          type: 'object',
          required: ['name', 'phone'],
          properties: {
            name: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string', format: 'email' },
            cpf: { type: 'string', description: 'Com ou sem pontuação' },
            birthDate: { type: 'string', format: 'date' },
            gender: { type: 'string', enum: ['MASCULINO', 'FEMININO', 'OUTRO', 'NAO_INFORMADO'] },
            address: { type: 'string' },
            zipCode: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            guardianName: { type: 'string' },
            guardianCpf: { type: 'string' },
            guardianBirthDate: { type: 'string', format: 'date' },
            insuranceName: { type: 'string' },
            insuranceCardNumber: { type: 'string' },
            insuranceHolderName: { type: 'string' },
            insuranceHolderCpf: { type: 'string' },
            chiefComplaint: { type: 'string', description: 'Queixa principal (anamnese inicial)' },
            historyNotes: { type: 'string' },
            allergies: { type: 'string' },
            medications: { type: 'string' },
            bloodType: { type: 'string' },
            habits: { type: 'string' },
            systemicDiseases: { type: 'string' },
          },
        },

        // ── Agenda ──
        Appointment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            clinicId: { type: 'string', format: 'uuid' },
            clinic: { type: 'object', nullable: true, properties: { id: { type: 'string' }, name: { type: 'string' } } },
            patientId: { type: 'string', format: 'uuid' },
            dentistId: { type: 'string', format: 'uuid' },
            procedureId: { type: 'string', format: 'uuid', nullable: true },
            dateTime: { type: 'string', format: 'date-time' },
            durationMin: { type: 'integer', example: 60 },
            status: { type: 'string', enum: ['AGENDADO', 'CONFIRMADO', 'EM_ATENDIMENTO', 'FINALIZADO', 'CANCELADO', 'FALTOU', 'ESPERA'] },
            type: { type: 'string', enum: ['PARTICULAR', 'CONVENIO'] },
            room: { type: 'string', enum: ['SALA_1', 'SALA_2', 'SALA_3', 'SALA_4'] },
            notes: { type: 'string', nullable: true },
            cancellationReason: { type: 'string', nullable: true },
            cancelledAt: { type: 'string', format: 'date-time', nullable: true },
            autoStockDeducted: { type: 'boolean', description: 'Trava de idempotência da baixa automática de estoque' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            patient: { type: 'object', nullable: true, properties: { id: { type: 'string' }, name: { type: 'string' }, phone: { type: 'string' } } },
            dentist: { type: 'object', nullable: true, properties: { id: { type: 'string' }, name: { type: 'string' }, cro: { type: 'string', nullable: true } } },
            procedure: { type: 'object', nullable: true, properties: { id: { type: 'string' }, name: { type: 'string' }, basePrice: { type: 'number' } } },
          },
        },
        CreateAppointmentDTO: {
          type: 'object',
          required: ['patientId', 'dentistId', 'dateTime'],
          properties: {
            patientId: { type: 'string', format: 'uuid' },
            dentistId: { type: 'string', format: 'uuid' },
            procedureId: { type: 'string', format: 'uuid', description: 'Aciona a baixa automática de insumos ao finalizar' },
            dateTime: { type: 'string', format: 'date-time' },
            durationMin: { type: 'integer', default: 60 },
            type: { type: 'string', enum: ['PARTICULAR', 'CONVENIO'] },
            room: { type: 'string', enum: ['SALA_1', 'SALA_2', 'SALA_3', 'SALA_4'] },
            notes: { type: 'string' },
          },
        },
        UpdateAppointmentStatusDTO: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['AGENDADO', 'CONFIRMADO', 'EM_ATENDIMENTO', 'FINALIZADO', 'CANCELADO', 'FALTOU', 'ESPERA'] },
            cancellationReason: { type: 'string', description: 'Obrigatório quando o status é CANCELADO' },
            procedureId: { type: 'string', format: 'uuid', description: 'Confirma o procedimento realizado ao finalizar' },
          },
        },

        // ── Estoque ──
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            clinicId: { type: 'string', format: 'uuid' },
            supplierId: { type: 'string', format: 'uuid', nullable: true },
            name: { type: 'string', example: 'Resina Composta A2' },
            quantity: { type: 'number', example: 12.5 },
            minQuantity: { type: 'number', example: 2 },
            unit: { type: 'string', enum: ['UN', 'ML', 'MG', 'G', 'L', 'CX'] },
            costPrice: { type: 'number', nullable: true },
            itemsPerPackage: { type: 'integer', nullable: true, description: 'Unidades por caixa (fracionamento)' },
            lotNumber: { type: 'string', nullable: true },
            batchNumber: { type: 'string', nullable: true, description: 'Alias de lotNumber' },
            manufacturingDate: { type: 'string', format: 'date-time', nullable: true },
            expiryDate: { type: 'string', format: 'date-time', nullable: true },
            notes: { type: 'string', nullable: true },
            stockStatus: { type: 'string', enum: ['CRITICO', 'BAIXO', 'OK'] },
            isExpiringSoon: { type: 'boolean' },
            supplier: { type: 'object', nullable: true, properties: { id: { type: 'string' }, name: { type: 'string' } } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // ── Financeiro ──
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            clinicId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['RECEITA', 'DESPESA'] },
            amount: { type: 'number', example: 150 },
            paymentMethod: { type: 'string', enum: ['PIX', 'CREDITO', 'DEBITO', 'DINHEIRO', 'CONVENIO', 'BOLETO', 'TRANSFERENCIA'] },
            description: { type: 'string', nullable: true },
            category: { type: 'string', nullable: true },
            costCenter: { type: 'string', nullable: true },
            isReconciled: { type: 'boolean' },
            paidAt: { type: 'string', format: 'date-time' },
            appointmentId: { type: 'string', format: 'uuid', nullable: true },
            treatmentPlanId: { type: 'string', format: 'uuid', nullable: true },
            supplierId: { type: 'string', format: 'uuid', nullable: true },
            appointment: { type: 'object', nullable: true, additionalProperties: true },
            supplier: { type: 'object', nullable: true, additionalProperties: true },
            treatmentPlan: { type: 'object', nullable: true, additionalProperties: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        FinancialReport: {
          type: 'object',
          properties: {
            period: { type: 'object', properties: { startDate: { type: 'string', format: 'date' }, endDate: { type: 'string', format: 'date' } } },
            summary: {
              type: 'object',
              properties: {
                totalReceitas: { type: 'number' },
                totalDespesas: { type: 'number' },
                lucro: { type: 'number' },
                totalTransacoes: { type: 'integer' },
              },
            },
            receitas: { type: 'object', properties: { total: { type: 'number' }, count: { type: 'integer' } } },
            despesas: { type: 'object', properties: { total: { type: 'number' }, count: { type: 'integer' } } },
            receitasPorMetodoPagamento: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  paymentMethod: { type: 'string' },
                  total: { type: 'number' },
                  count: { type: 'integer' },
                },
              },
            },
          },
        },

        // ── Dashboard ──
        DashboardSummary: {
          type: 'object',
          properties: {
            patients: { type: 'object', properties: { total: { type: 'integer' }, newThisMonth: { type: 'integer' } } },
            appointments: {
              type: 'object',
              properties: {
                today: { type: 'integer' },
                thisWeek: { type: 'integer' },
                thisMonth: { type: 'integer' },
                byStatus: { type: 'object', additionalProperties: { type: 'integer' }, example: { FINALIZADO: 40, AGENDADO: 12 } },
              },
            },
            financial: {
              type: 'object',
              properties: {
                todayRevenue: { type: 'number' },
                weekRevenue: { type: 'number' },
                monthRevenue: { type: 'number' },
                monthExpenses: { type: 'number' },
                monthProfit: { type: 'number' },
              },
            },
            inventory: { type: 'object', properties: { lowStockCount: { type: 'integer' }, expiringCount: { type: 'integer' } } },
          },
        },

        // ── Auditoria ──
        AuditLog: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            clinicId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid', nullable: true },
            userName: { type: 'string', nullable: true },
            userRole: { type: 'string', nullable: true, enum: ['ADMIN', 'DENTIST', 'SECRETARY', 'OWNER'] },
            action: { type: 'string', enum: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT', 'READ'] },
            entity: { type: 'string', example: 'PATIENT' },
            entityId: { type: 'string', nullable: true },
            details: { type: 'string', nullable: true },
            ipAddress: { type: 'string', nullable: true },
            userAgent: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            user: {
              type: 'object',
              nullable: true,
              properties: { name: { type: 'string' }, email: { type: 'string' }, role: { type: 'string' } },
            },
          },
        },
      },
    },
  },
  apis,
}

export const swaggerSpec = swaggerJsdoc(options)