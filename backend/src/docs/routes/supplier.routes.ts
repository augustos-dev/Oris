import { Router } from 'express'
import { authenticate } from '../../middlewares/authMiddlewares'
import {
  createSupplierController,
  listSuppliersController,
  getSupplierByIdController,
  updateSupplierController,
  deleteSupplierController,
} from '../../controllers/supplierController'

const router = Router()

router.use(authenticate)

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateSupplierDTO:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           example: "Dental Cremer Produtos Odontológicos"
 *         cnpj:
 *           type: string
 *           nullable: true
 *           example: "12345678000190"
 *         phone:
 *           type: string
 *           nullable: true
 *           example: "(85) 99999-0000"
 *         email:
 *           type: string
 *           nullable: true
 *           example: "contato@dentalcremer.com.br"
 *         contact:
 *           type: string
 *           nullable: true
 *           example: "João Vendedor"
 *     
 *     UpdateSupplierDTO:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: "Dental Cremer S.A."
 *         cnpj:
 *           type: string
 *           nullable: true
 *         phone:
 *           type: string
 *           nullable: true
 *         email:
 *           type: string
 *           nullable: true
 *         contact:
 *           type: string
 *           nullable: true
 *
 *     SupplierResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "5f8d410f-1234-4567-89ab-cdef01234567"
 *         tenantId:
 *           type: string
 *           format: uuid
 *         clinicId:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *           example: "Dental Cremer"
 *         cnpj:
 *           type: string
 *           nullable: true
 *           example: "12345678000190"
 *         phone:
 *           type: string
 *           nullable: true
 *           example: "(85) 99999-0000"
 *         email:
 *           type: string
 *           nullable: true
 *           example: "contato@dentalcremer.com.br"
 *         contact:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         _count:
 *           type: object
 *           properties:
 *             products:
 *               type: integer
 *               example: 5
 *
 *     PaginatedSuppliersResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SupplierResponse'
 *         total:
 *           type: integer
 *           example: 42
 *         page:
 *           type: integer
 *           example: 1
 *         limit:
 *           type: integer
 *           example: 20
 *         totalPages:
 *           type: integer
 *           example: 3
 */

/**
 * @swagger
 * /suppliers:
 *   post:
 *     summary: Cadastra um novo fornecedor
 *     description: Fornecedores são por unidade (cada clínica da rede mantém os seus). Não há restrição de papel nesta rota (qualquer usuário autenticado).
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSupplierDTO'
 *     responses:
 *       201:
 *         description: Fornecedor criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SupplierResponse'
 *       400:
 *         description: Nome do fornecedor ausente ou dados inválidos
 *       401:
 *         description: Não autorizado (JWT ausente ou inválido)
 *
 *   get:
 *     summary: Lista os fornecedores da clínica com busca e paginação
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Termo de busca por Nome, CNPJ ou E-mail
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Quantidade de registros por página
 *     responses:
 *       200:
 *         description: Lista paginada de fornecedores
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedSuppliersResponse'
 *       401:
 *         description: Não autorizado
 */
router.post('/', createSupplierController)
router.get('/', listSuppliersController)

/**
 * @swagger
 * /suppliers/{id}:
 *   get:
 *     summary: Busca a ficha detalhada de um fornecedor pelo ID
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do Fornecedor
 *     responses:
 *       200:
 *         description: Dados do fornecedor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SupplierResponse'
 *       404:
 *         description: Fornecedor não encontrado
 *
 *   put:
 *     summary: Atualiza os dados de um fornecedor
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateSupplierDTO'
 *     responses:
 *       200:
 *         description: Fornecedor atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SupplierResponse'
 *       404:
 *         description: Fornecedor não encontrado
 *
 *   delete:
 *     summary: Remove um fornecedor (bloqueado se houver produtos associados)
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Mensagem de confirmação de exclusão
 *         content:
 *           application/json:
 *             example:
 *               message: "Fornecedor removido com sucesso."
 *       400:
 *         description: Fornecedor possui produtos vinculados no estoque
 *       404:
 *         description: Fornecedor não encontrado
 */
router.get('/:id', getSupplierByIdController)
router.put('/:id', updateSupplierController)
router.delete('/:id', deleteSupplierController)

export default router