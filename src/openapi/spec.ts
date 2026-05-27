/**
 * Hand-authored OpenAPI 3.0 spec for the Consignment ERP Lite backend.
 * Importable as JS so it can be served by swagger-ui-express AND exported to
 * disk for Postman / external docs.
 */

const securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  },
} as const;

const schemas = {
  Error: {
    type: 'object',
    properties: {
      error: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          message: { type: 'string' },
          details: {},
        },
      },
    },
  },
  Pagination: {
    type: 'object',
    properties: {
      data: { type: 'array', items: {} },
      total: { type: 'integer' },
      page: { type: 'integer' },
      pageSize: { type: 'integer' },
    },
  },

  // ----- Auth -----
  LoginRequest: {
    type: 'object',
    required: ['username', 'password'],
    properties: {
      username: { type: 'string', example: 'admin' },
      password: { type: 'string', example: 'Admin@12345' },
    },
  },
  LoginResponse: {
    type: 'object',
    properties: {
      accessToken: { type: 'string' },
      refreshToken: { type: 'string' },
      user: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          username: { type: 'string' },
          fullName: { type: 'string' },
          role: { type: 'string' },
          permissions: { type: 'array', items: { type: 'string' } },
          employee: { type: 'object', nullable: true },
        },
      },
    },
  },
  ChangePasswordRequest: {
    type: 'object',
    required: ['currentPassword', 'newPassword'],
    properties: {
      currentPassword: { type: 'string' },
      newPassword: { type: 'string', minLength: 8, maxLength: 200 },
    },
  },

  // ----- Master data -----
  Product: {
    type: 'object',
    properties: {
      product_id: { type: 'string' },
      sku_code: { type: 'string' },
      barcode: { type: 'string', nullable: true },
      product_name: { type: 'string' },
      category_id: { type: 'string', nullable: true },
      unit: { type: 'string' },
      cost: { type: 'string' },
      selling_price: { type: 'string' },
      shelf_life_days: { type: 'integer' },
      min_stock: { type: 'string' },
      max_stock: { type: 'string' },
      active_flag: { type: 'boolean' },
    },
  },
  ProductCreate: {
    type: 'object',
    required: ['sku_code', 'product_name'],
    properties: {
      sku_code: { type: 'string', maxLength: 50 },
      barcode: { type: 'string', maxLength: 100 },
      product_name: { type: 'string', maxLength: 255 },
      category_id: { type: 'string' },
      unit: { type: 'string', default: 'PCS' },
      cost: { type: 'string', example: '5.00' },
      selling_price: { type: 'string', example: '12.00' },
      shelf_life_days: { type: 'integer' },
      min_stock: { type: 'string' },
      max_stock: { type: 'string' },
      active_flag: { type: 'boolean' },
    },
  },
  Customer: {
    type: 'object',
    properties: {
      customer_id: { type: 'string' },
      customer_code: { type: 'string' },
      customer_name: { type: 'string' },
      group_id: { type: 'string', nullable: true },
      credit_term_days: { type: 'integer' },
      credit_limit: { type: 'string' },
      active_flag: { type: 'boolean' },
      latitude: { type: 'string', nullable: true },
      longitude: { type: 'string', nullable: true },
      max_capacity_qty: { type: 'string' },
      visit_frequency_days: { type: 'integer' },
    },
  },
  CustomerCreate: {
    type: 'object',
    required: ['customer_code', 'customer_name'],
    properties: {
      customer_code: { type: 'string', maxLength: 50 },
      customer_name: { type: 'string', maxLength: 255 },
      group_id: { type: 'string' },
      owner_name: { type: 'string' },
      phone: { type: 'string' },
      line_id: { type: 'string' },
      address: { type: 'string' },
      province: { type: 'string' },
      latitude: { type: 'string' },
      longitude: { type: 'string' },
      visit_frequency_days: { type: 'integer', default: 3 },
      max_capacity_qty: { type: 'string', default: '0' },
      credit_term_days: { type: 'integer', default: 0 },
      credit_limit: { type: 'string', default: '0' },
      active_flag: { type: 'boolean' },
    },
  },

  // ----- Inventory -----
  WarehouseStock: {
    type: 'object',
    properties: {
      inventory_id: { type: 'string' },
      warehouse_id: { type: 'string' },
      product_id: { type: 'string' },
      qty_on_hand: { type: 'string' },
      qty_reserved: { type: 'string' },
      qty_available: { type: 'string' },
    },
  },
  ConsignmentStock: {
    type: 'object',
    properties: {
      consignment_stock_id: { type: 'string' },
      customer_id: { type: 'string' },
      product_id: { type: 'string' },
      qty_on_hand: { type: 'string' },
      last_visit_date: { type: 'string', nullable: true, format: 'date-time' },
    },
  },
  StockMovement: {
    type: 'object',
    properties: {
      movement_id: { type: 'string' },
      movement_date: { type: 'string', format: 'date-time' },
      movement_type: {
        type: 'string',
        enum: [
          'WAREHOUSE_ADJUSTMENT',
          'PRODUCTION_RECEIPT',
          'LOAD_TO_CUSTOMER',
          'SALE_CONFIRMED',
          'REPLENISHMENT',
          'RETURN_FROM_CUSTOMER',
          'CUSTOMER_ADJUSTMENT',
        ],
      },
      ref_doc_type: { type: 'string', nullable: true },
      ref_doc_id: { type: 'string', nullable: true },
      warehouse_id: { type: 'string', nullable: true },
      customer_id: { type: 'string', nullable: true },
      product_id: { type: 'string' },
      qty_in: { type: 'string' },
      qty_out: { type: 'string' },
      balance_after: { type: 'string' },
      unit_cost: { type: 'string', nullable: true },
      unit_price: { type: 'string', nullable: true },
    },
  },
  AdjustmentRequest: {
    type: 'object',
    required: ['warehouse_id', 'lines'],
    properties: {
      warehouse_id: { type: 'string' },
      remark: { type: 'string' },
      lines: {
        type: 'array',
        items: {
          type: 'object',
          required: ['product_id', 'delta_qty'],
          properties: {
            product_id: { type: 'string' },
            delta_qty: { type: 'string', description: 'positive=add, negative=remove (cannot be zero)' },
            unit_cost: { type: 'string' },
          },
        },
      },
    },
  },
  ProductionReceiptRequest: {
    type: 'object',
    required: ['warehouse_id', 'lines'],
    properties: {
      warehouse_id: { type: 'string' },
      remark: { type: 'string' },
      lines: {
        type: 'array',
        items: {
          type: 'object',
          required: ['product_id', 'qty'],
          properties: {
            product_id: { type: 'string' },
            qty: { type: 'string' },
            unit_cost: { type: 'string' },
            lot_no: { type: 'string', description: 'Optional lot number; when set, a product_lot row is created/topped-up.' },
            manufacturing_date: { type: 'string', format: 'date-time' },
            expiry_date: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
  LoadToCustomerRequest: {
    type: 'object',
    required: ['customer_id', 'warehouse_id', 'lines'],
    properties: {
      customer_id: { type: 'string' },
      warehouse_id: { type: 'string' },
      remark: { type: 'string' },
      override_credit: { type: 'boolean' },
      override_reason: { type: 'string' },
      lines: {
        type: 'array',
        items: {
          type: 'object',
          required: ['product_id', 'qty'],
          properties: {
            product_id: { type: 'string' },
            qty: { type: 'string' },
            unit_price: { type: 'string' },
            unit_cost: { type: 'string' },
          },
        },
      },
    },
  },

  // ----- Sales visit -----
  SalesVisit: {
    type: 'object',
    properties: {
      visit_id: { type: 'string' },
      visit_no: { type: 'string' },
      customer_id: { type: 'string' },
      employee_id: { type: 'string' },
      route_id: { type: 'string', nullable: true },
      visit_date: { type: 'string', format: 'date-time' },
      checkin_time: { type: 'string', format: 'date-time', nullable: true },
      checkout_time: { type: 'string', format: 'date-time', nullable: true },
      visit_status: {
        type: 'string',
        enum: ['DRAFT', 'CHECKED_IN', 'COUNTED', 'CONFIRMED', 'CANCELLED'],
      },
      total_sales_amount: { type: 'string' },
    },
  },
  VisitCreateRequest: {
    type: 'object',
    required: ['customer_id'],
    properties: {
      customer_id: { type: 'string' },
      employee_id: { type: 'string' },
      route_id: { type: 'string' },
      visit_date: { type: 'string', format: 'date-time' },
      note: { type: 'string' },
    },
  },
  VisitRecordItemsRequest: {
    type: 'object',
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['product_id', 'qty_counted'],
          properties: {
            product_id: { type: 'string' },
            qty_counted: { type: 'string' },
            qty_replenished: { type: 'string', default: '0' },
            unit_price: { type: 'string' },
          },
        },
      },
    },
  },
  VisitConfirmRequest: {
    type: 'object',
    properties: {
      warehouse_id: { type: 'string', description: 'Required if any line has qty_replenished > 0' },
      payment_method: { type: 'string', enum: ['CASH', 'BANK_TRANSFER', 'QR_PAYMENT', 'OTHER'] },
      amount_collected: { type: 'string' },
      reference_no: { type: 'string' },
      override_credit: { type: 'boolean' },
      override_reason: { type: 'string' },
    },
  },
  VisitConfirmResponse: {
    type: 'object',
    properties: {
      visit: { $ref: '#/components/schemas/SalesVisit' },
      total_sales_amount: { type: 'string' },
      ar_invoice_id: { type: 'string', nullable: true },
      collection_id: { type: 'string', nullable: true },
    },
  },

  // ----- Collection / AR -----
  Collection: {
    type: 'object',
    properties: {
      collection_id: { type: 'string' },
      collection_no: { type: 'string' },
      customer_id: { type: 'string' },
      visit_id: { type: 'string', nullable: true },
      ar_invoice_id: { type: 'string', nullable: true },
      amount_collected: { type: 'string' },
      total_sales_amount: { type: 'string' },
      payment_method: { type: 'string' },
      reference_no: { type: 'string', nullable: true },
      collection_date: { type: 'string', format: 'date-time' },
    },
  },
  CollectionCreateRequest: {
    type: 'object',
    required: ['customer_id', 'amount_collected', 'payment_method'],
    properties: {
      customer_id: { type: 'string' },
      amount_collected: { type: 'string' },
      payment_method: { type: 'string', enum: ['CASH', 'BANK_TRANSFER', 'QR_PAYMENT', 'OTHER'] },
      reference_no: { type: 'string' },
      note: { type: 'string' },
    },
  },
  ArInvoice: {
    type: 'object',
    properties: {
      ar_invoice_id: { type: 'string' },
      invoice_no: { type: 'string' },
      customer_id: { type: 'string' },
      visit_id: { type: 'string', nullable: true },
      invoice_date: { type: 'string', format: 'date-time' },
      due_date: { type: 'string', format: 'date-time' },
      total_amount: { type: 'string' },
      outstanding_amount: { type: 'string' },
      status: { type: 'string', enum: ['OPEN', 'PARTIAL', 'PAID', 'CANCELLED'] },
    },
  },
  ArInvoiceCreateRequest: {
    type: 'object',
    required: ['customer_id', 'lines'],
    properties: {
      customer_id: { type: 'string' },
      invoice_date: { type: 'string', format: 'date-time' },
      credit_term_days: { type: 'integer' },
      note: { type: 'string' },
      lines: {
        type: 'array',
        items: {
          type: 'object',
          required: ['product_id', 'qty', 'unit_price'],
          properties: {
            product_id: { type: 'string' },
            qty: { type: 'string' },
            unit_price: { type: 'string' },
          },
        },
      },
    },
  },
  ArPaymentRequest: {
    type: 'object',
    required: ['amount', 'payment_method'],
    properties: {
      amount: { type: 'string' },
      payment_method: { type: 'string', enum: ['CASH', 'BANK_TRANSFER', 'QR_PAYMENT', 'OTHER'] },
      reference_no: { type: 'string' },
    },
  },
  ArAgingResponse: {
    type: 'object',
    properties: {
      invoices: { type: 'array', items: {} },
      summary: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: { count: { type: 'integer' }, amount: { type: 'string' } },
        },
      },
    },
  },

  // ----- Credit -----
  CreditExposure: {
    type: 'object',
    properties: {
      customer_id: { type: 'string' },
      ar_outstanding: { type: 'string' },
      consignment_value: { type: 'string' },
      credit_exposure: { type: 'string' },
      credit_limit: { type: 'string' },
      available_credit: { type: 'string' },
      has_limit: { type: 'boolean' },
    },
  },
  CreditValidateRequest: {
    type: 'object',
    properties: {
      additional_value: { type: 'string' },
      lines: {
        type: 'array',
        items: {
          type: 'object',
          required: ['product_id', 'qty'],
          properties: {
            product_id: { type: 'string' },
            qty: { type: 'string' },
            unit_price: { type: 'string' },
          },
        },
      },
    },
  },
};

const tag = (name: string, description: string) => ({ name, description });

const param = (
  name: string,
  type = 'string',
  required = false,
  location: 'query' | 'path' | 'header' = 'query',
  description?: string,
) => ({
  name,
  in: location,
  required,
  description,
  schema: { type },
});

const auth = [{ bearerAuth: [] as string[] }];

const json = (schemaName: string) => ({
  content: { 'application/json': { schema: { $ref: `#/components/schemas/${schemaName}` } } },
});

const ok = (schemaName: string) => ({ description: 'OK', ...json(schemaName) });
const created = (schemaName: string) => ({ description: 'Created', ...json(schemaName) });

const errorResponses = {
  '400': { description: 'Bad request', ...json('Error') },
  '401': { description: 'Unauthenticated', ...json('Error') },
  '403': { description: 'Forbidden', ...json('Error') },
  '404': { description: 'Not found', ...json('Error') },
  '409': { description: 'Conflict / domain rule violation', ...json('Error') },
  '422': { description: 'Validation error', ...json('Error') },
};

const paginatedQuery = [
  param('page', 'integer'),
  param('pageSize', 'integer'),
  param('sort', 'string'),
];

const crudPaths = (
  base: string,
  tagName: string,
  schemaName: string,
  createSchemaName: string,
  permissionRead: string,
  permissionWrite: string,
  extra?: Record<string, unknown>,
) => ({
  [`/api/v1${base}`]: {
    get: {
      tags: [tagName],
      summary: `List ${tagName}`,
      security: auth,
      parameters: [...paginatedQuery, param('q', 'string')],
      responses: { '200': ok('Pagination'), ...errorResponses },
      'x-permissions': [permissionRead],
    },
    post: {
      tags: [tagName],
      summary: `Create ${tagName}`,
      security: auth,
      requestBody: { required: true, ...json(createSchemaName) },
      responses: { '201': created(schemaName), ...errorResponses },
      'x-permissions': [permissionWrite],
    },
  },
  [`/api/v1${base}/{id}`]: {
    get: {
      tags: [tagName],
      summary: `Get ${tagName} by id`,
      security: auth,
      parameters: [param('id', 'string', true, 'path')],
      responses: { '200': ok(schemaName), ...errorResponses },
      'x-permissions': [permissionRead],
    },
    put: {
      tags: [tagName],
      summary: `Update ${tagName}`,
      security: auth,
      parameters: [param('id', 'string', true, 'path')],
      requestBody: { required: true, ...json(createSchemaName) },
      responses: { '200': ok(schemaName), ...errorResponses },
      'x-permissions': [permissionWrite],
    },
    delete: {
      tags: [tagName],
      summary: `Soft-delete ${tagName}`,
      security: auth,
      parameters: [param('id', 'string', true, 'path')],
      responses: { '200': ok(schemaName), ...errorResponses },
      'x-permissions': [permissionWrite],
    },
  },
  ...(extra ?? {}),
});

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Consignment ERP Lite — API',
    version: '0.1.0',
    description:
      'REST API for the Consignment / Van Sales / Route Accounting backend. ' +
      'All money fields are decimal strings (precision 18, scale 2). ' +
      'All ids are BigInt-as-string. Authenticated endpoints require a Bearer JWT obtained from `/api/v1/auth/login`.',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local dev' },
  ],
  tags: [
    tag('Auth', 'Login + current user'),
    tag('Products', 'Product + category master data'),
    tag('Customers', 'Customer + group master data and per-customer queries'),
    tag('Warehouses', 'Warehouse master data'),
    tag('Employees', 'Employee master data'),
    tag('Routes', 'Route + customer-route mapping'),
    tag('Users', 'App user / role / permission management'),
    tag('Inventory', 'Warehouse stock, ledger, adjustments, production, load/return'),
    tag('Sales Visits', 'Visit lifecycle + confirm (sale + replenishment + payment)'),
    tag('Collections', 'Standalone FIFO settlement and collection history'),
    tag('AR', 'AR invoice + payment + aging'),
    tag('Credit', 'Exposure, validate, policy, risk'),
    tag('Reports', 'Dashboard + analytical reports'),
    tag('Mobile', 'Endpoints optimised for the van-sales mobile app'),
    tag('Imports', 'Bulk-upsert master data from CSV'),
    tag('Notifications', 'Outbound webhook / LINE Notify alerting'),
    tag('Audit', 'Audit log queries'),
    tag('Ops', 'Health, readiness, Prometheus metrics'),
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Auth'],
        summary: 'Liveness probe',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with username + password and obtain JWT',
        requestBody: { required: true, ...json('LoginRequest') },
        responses: { '200': ok('LoginResponse'), ...errorResponses },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get the current authenticated user',
        security: auth,
        responses: { '200': { description: 'OK' }, ...errorResponses },
      },
    },
    '/api/v1/auth/change-password': {
      put: {
        tags: ['Auth'],
        summary: "Change the calling user's own password (verifies current password)",
        security: auth,
        requestBody: { required: true, ...json('ChangePasswordRequest') },
        responses: { '200': { description: 'OK' }, ...errorResponses },
      },
    },

    ...crudPaths(
      '/products',
      'Products',
      'Product',
      'ProductCreate',
      'product.read',
      'product.write',
    ),
    ...crudPaths(
      '/customers',
      'Customers',
      'Customer',
      'CustomerCreate',
      'customer.read',
      'customer.write',
      {
        '/api/v1/customers/{id}/stock': {
          get: {
            tags: ['Customers'],
            summary: 'Consignment stock currently held by a customer',
            security: auth,
            parameters: [param('id', 'string', true, 'path')],
            responses: { '200': { description: 'OK' }, ...errorResponses },
            'x-permissions': ['customer.read'],
          },
        },
        '/api/v1/customers/{id}/sales-history': {
          get: {
            tags: ['Customers'],
            summary: 'Visit + sale history for a customer',
            security: auth,
            parameters: [param('id', 'string', true, 'path'), ...paginatedQuery],
            responses: { '200': ok('Pagination'), ...errorResponses },
            'x-permissions': ['customer.read'],
          },
        },
        '/api/v1/customers/{id}/collection-history': {
          get: {
            tags: ['Customers'],
            summary: 'Collection history for a customer',
            security: auth,
            parameters: [param('id', 'string', true, 'path'), ...paginatedQuery],
            responses: { '200': ok('Pagination'), ...errorResponses },
            'x-permissions': ['customer.read'],
          },
        },
        '/api/v1/customers/{id}/ar': {
          get: {
            tags: ['Customers'],
            summary: 'AR invoices for a customer',
            security: auth,
            parameters: [param('id', 'string', true, 'path'), ...paginatedQuery],
            responses: { '200': ok('Pagination'), ...errorResponses },
            'x-permissions': ['customer.read'],
          },
        },
        '/api/v1/customers/{id}/credit-exposure': {
          get: {
            tags: ['Customers'],
            summary: 'Compute live credit exposure for a customer',
            security: auth,
            parameters: [param('id', 'string', true, 'path')],
            responses: { '200': ok('CreditExposure'), ...errorResponses },
            'x-permissions': ['credit.read'],
          },
        },
      },
    ),

    '/api/v1/inventory/warehouse': {
      get: {
        tags: ['Inventory'],
        summary: 'List warehouse stock balances',
        security: auth,
        parameters: [
          param('warehouse_id', 'string'),
          param('product_id', 'string'),
          param('low_stock', 'string', false, 'query', 'true to filter qty_on_hand <= min_stock'),
          ...paginatedQuery,
        ],
        responses: { '200': ok('Pagination'), ...errorResponses },
        'x-permissions': ['inventory.read'],
      },
    },
    '/api/v1/inventory/consignment': {
      get: {
        tags: ['Inventory'],
        summary: 'List consignment stock balances',
        security: auth,
        parameters: [
          param('customer_id', 'string'),
          param('product_id', 'string'),
          ...paginatedQuery,
        ],
        responses: { '200': ok('Pagination'), ...errorResponses },
        'x-permissions': ['inventory.read'],
      },
    },
    '/api/v1/inventory/lots': {
      get: {
        tags: ['Inventory'],
        summary: 'List product lots (FEFO source-of-truth) with per-location balances',
        security: auth,
        parameters: [
          param('product_id', 'string'),
          param('warehouse_id', 'string'),
          param('customer_id', 'string'),
          param('expiring_before', 'string'),
          ...paginatedQuery,
        ],
        responses: { '200': ok('Pagination'), ...errorResponses },
        'x-permissions': ['inventory.read'],
      },
    },
    '/api/v1/inventory/movements': {
      get: {
        tags: ['Inventory'],
        summary: 'List stock movements (the audit ledger)',
        security: auth,
        parameters: [
          param('warehouse_id', 'string'),
          param('customer_id', 'string'),
          param('product_id', 'string'),
          param('movement_type', 'string'),
          param('ref_doc_type', 'string'),
          param('ref_doc_id', 'string'),
          param('date_from', 'string'),
          param('date_to', 'string'),
          ...paginatedQuery,
        ],
        responses: { '200': ok('Pagination'), ...errorResponses },
        'x-permissions': ['inventory.read'],
      },
    },
    '/api/v1/inventory/adjustment': {
      post: {
        tags: ['Inventory'],
        summary: 'Adjust warehouse stock (manual delta) — creates a WAREHOUSE_ADJUSTMENT movement',
        security: auth,
        requestBody: { required: true, ...json('AdjustmentRequest') },
        responses: { '201': { description: 'Created' }, ...errorResponses },
        'x-permissions': ['inventory.adjust'],
      },
    },
    '/api/v1/inventory/production-receipt': {
      post: {
        tags: ['Inventory'],
        summary: 'Record stock received from production',
        security: auth,
        requestBody: { required: true, ...json('ProductionReceiptRequest') },
        responses: { '201': { description: 'Created' }, ...errorResponses },
        'x-permissions': ['inventory.production_receipt'],
      },
    },
    '/api/v1/inventory/load-to-customer': {
      post: {
        tags: ['Inventory'],
        summary: 'Load stock to a customer (or replenish). Credit-checked.',
        security: auth,
        requestBody: { required: true, ...json('LoadToCustomerRequest') },
        responses: { '201': { description: 'Created' }, ...errorResponses },
        'x-permissions': ['inventory.load'],
      },
    },
    '/api/v1/inventory/return-from-customer': {
      post: {
        tags: ['Inventory'],
        summary: 'Return stock from a customer back to the warehouse',
        security: auth,
        requestBody: { required: true, ...json('LoadToCustomerRequest') },
        responses: { '201': { description: 'Created' }, ...errorResponses },
        'x-permissions': ['inventory.return'],
      },
    },

    '/api/v1/sales-visits': {
      get: {
        tags: ['Sales Visits'],
        summary: 'List sales visits',
        security: auth,
        parameters: [
          param('customer_id', 'string'),
          param('employee_id', 'string'),
          param('route_id', 'string'),
          param('status', 'string'),
          param('date_from', 'string'),
          param('date_to', 'string'),
          ...paginatedQuery,
        ],
        responses: { '200': ok('Pagination'), ...errorResponses },
        'x-permissions': ['visit.read'],
      },
      post: {
        tags: ['Sales Visits'],
        summary: 'Create a sales visit (DRAFT)',
        security: auth,
        requestBody: { required: true, ...json('VisitCreateRequest') },
        responses: { '201': created('SalesVisit'), ...errorResponses },
        'x-permissions': ['visit.write'],
      },
    },
    '/api/v1/sales-visits/{id}': {
      get: {
        tags: ['Sales Visits'],
        summary: 'Get visit detail including items, collections, and AR invoices',
        security: auth,
        parameters: [param('id', 'string', true, 'path')],
        responses: { '200': ok('SalesVisit'), ...errorResponses },
        'x-permissions': ['visit.read'],
      },
    },
    '/api/v1/sales-visits/{id}/checkin': {
      post: {
        tags: ['Sales Visits'],
        summary: 'Check in (record GPS + timestamp)',
        security: auth,
        parameters: [param('id', 'string', true, 'path')],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  gps_latitude: { type: 'string' },
                  gps_longitude: { type: 'string' },
                  photo_url: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': ok('SalesVisit'), ...errorResponses },
        'x-permissions': ['visit.write'],
      },
    },
    '/api/v1/sales-visits/{id}/items': {
      post: {
        tags: ['Sales Visits'],
        summary: 'Record per-SKU counts + replenish intents (qty_sold/sales_amount computed)',
        security: auth,
        parameters: [param('id', 'string', true, 'path')],
        requestBody: { required: true, ...json('VisitRecordItemsRequest') },
        responses: { '200': ok('SalesVisit'), ...errorResponses },
        'x-permissions': ['visit.write'],
      },
    },
    '/api/v1/sales-visits/{id}/confirm': {
      post: {
        tags: ['Sales Visits'],
        summary: 'Atomic confirm: SALE_CONFIRMED + REPLENISHMENT + collection / AR invoice',
        security: auth,
        parameters: [param('id', 'string', true, 'path')],
        requestBody: { required: true, ...json('VisitConfirmRequest') },
        responses: { '200': ok('VisitConfirmResponse'), ...errorResponses },
        'x-permissions': ['visit.confirm'],
      },
    },
    '/api/v1/sales-visits/{id}/checkout': {
      post: {
        tags: ['Sales Visits'],
        summary: 'Record checkout time',
        security: auth,
        parameters: [param('id', 'string', true, 'path')],
        responses: { '200': ok('SalesVisit'), ...errorResponses },
        'x-permissions': ['visit.write'],
      },
    },
    '/api/v1/sales-visits/{id}/cancel': {
      post: {
        tags: ['Sales Visits'],
        summary: 'Cancel a non-confirmed visit',
        security: auth,
        parameters: [param('id', 'string', true, 'path')],
        responses: { '200': ok('SalesVisit'), ...errorResponses },
        'x-permissions': ['visit.write'],
      },
    },

    '/api/v1/collections': {
      get: {
        tags: ['Collections'],
        summary: 'List collections',
        security: auth,
        parameters: [
          param('customer_id', 'string'),
          param('visit_id', 'string'),
          param('date_from', 'string'),
          param('date_to', 'string'),
          ...paginatedQuery,
        ],
        responses: { '200': ok('Pagination'), ...errorResponses },
        'x-permissions': ['collection.read'],
      },
      post: {
        tags: ['Collections'],
        summary: 'Standalone collection that settles outstanding AR FIFO by due_date',
        security: auth,
        requestBody: { required: true, ...json('CollectionCreateRequest') },
        responses: { '201': { description: 'Created' }, ...errorResponses },
        'x-permissions': ['collection.write'],
      },
    },
    '/api/v1/collections/{id}': {
      get: {
        tags: ['Collections'],
        summary: 'Get a collection',
        security: auth,
        parameters: [param('id', 'string', true, 'path')],
        responses: { '200': ok('Collection'), ...errorResponses },
        'x-permissions': ['collection.read'],
      },
    },

    '/api/v1/ar/invoices': {
      get: {
        tags: ['AR'],
        summary: 'List AR invoices',
        security: auth,
        parameters: [
          param('customer_id', 'string'),
          param('status', 'string'),
          param('overdue_only', 'string'),
          ...paginatedQuery,
        ],
        responses: { '200': ok('Pagination'), ...errorResponses },
        'x-permissions': ['ar.read'],
      },
      post: {
        tags: ['AR'],
        summary: 'Create AR invoice manually',
        security: auth,
        requestBody: { required: true, ...json('ArInvoiceCreateRequest') },
        responses: { '201': created('ArInvoice'), ...errorResponses },
        'x-permissions': ['ar.invoice.create_manual'],
      },
    },
    '/api/v1/ar/invoices/{id}': {
      get: {
        tags: ['AR'],
        summary: 'Get AR invoice',
        security: auth,
        parameters: [param('id', 'string', true, 'path')],
        responses: { '200': ok('ArInvoice'), ...errorResponses },
        'x-permissions': ['ar.read'],
      },
    },
    '/api/v1/ar/invoices/{id}/payments': {
      post: {
        tags: ['AR'],
        summary: 'Record a payment against a specific invoice',
        security: auth,
        parameters: [param('id', 'string', true, 'path')],
        requestBody: { required: true, ...json('ArPaymentRequest') },
        responses: { '201': { description: 'Created' }, ...errorResponses },
        'x-permissions': ['ar.payment.write'],
      },
    },
    '/api/v1/ar/aging': {
      get: {
        tags: ['AR'],
        summary: 'AR aging report (CURRENT / 1_30 / 31_60 / 61_90 / OVER_90)',
        security: auth,
        parameters: [param('customer_id', 'string')],
        responses: { '200': ok('ArAgingResponse'), ...errorResponses },
        'x-permissions': ['ar.read'],
      },
    },
    '/api/v1/ar/outstanding': {
      get: {
        tags: ['AR'],
        summary: 'Outstanding AR summary by customer',
        security: auth,
        responses: { '200': { description: 'OK' }, ...errorResponses },
        'x-permissions': ['ar.read'],
      },
    },

    '/api/v1/credit/customers/{id}/exposure': {
      get: {
        tags: ['Credit'],
        summary: 'Compute current credit exposure',
        security: auth,
        parameters: [param('id', 'string', true, 'path')],
        responses: { '200': ok('CreditExposure'), ...errorResponses },
        'x-permissions': ['credit.read'],
      },
    },
    '/api/v1/credit/customers/{id}/validate': {
      post: {
        tags: ['Credit'],
        summary: 'Preview a load and check whether the projected exposure would exceed the limit',
        security: auth,
        parameters: [param('id', 'string', true, 'path')],
        requestBody: { required: true, ...json('CreditValidateRequest') },
        responses: { '200': { description: 'OK' }, ...errorResponses },
        'x-permissions': ['credit.read'],
      },
    },
    '/api/v1/credit/customers/{id}/policy': {
      put: {
        tags: ['Credit'],
        summary: 'Update credit limit / term (writes customer_credit_history)',
        security: auth,
        parameters: [param('id', 'string', true, 'path')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  credit_limit: { type: 'string' },
                  credit_term_days: { type: 'integer' },
                  reason: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': ok('Customer'), ...errorResponses },
        'x-permissions': ['credit.policy.write'],
      },
    },
    '/api/v1/credit/risk': {
      get: {
        tags: ['Credit'],
        summary: 'Customers near or above their credit limit',
        security: auth,
        parameters: [param('threshold_pct', 'integer', false, 'query', 'default 80')],
        responses: { '200': { description: 'OK' }, ...errorResponses },
        'x-permissions': ['credit.read'],
      },
    },

    '/api/v1/reports/dashboard': {
      get: {
        tags: ['Reports'],
        summary: 'Dashboard KPIs',
        security: auth,
        responses: { '200': { description: 'OK' }, ...errorResponses },
        'x-permissions': ['report.read'],
      },
    },
    '/api/v1/reports/sales-by-customer': {
      get: { tags: ['Reports'], summary: 'Sales grouped by customer', security: auth, parameters: [param('date_from', 'string'), param('date_to', 'string')], responses: { '200': { description: 'OK' }, ...errorResponses }, 'x-permissions': ['report.read'] },
    },
    '/api/v1/reports/sales-by-sku': {
      get: { tags: ['Reports'], summary: 'Sales grouped by SKU', security: auth, parameters: [param('date_from', 'string'), param('date_to', 'string')], responses: { '200': { description: 'OK' }, ...errorResponses }, 'x-permissions': ['report.read'] },
    },
    '/api/v1/reports/sales-by-employee': {
      get: { tags: ['Reports'], summary: 'Sales grouped by employee', security: auth, parameters: [param('date_from', 'string'), param('date_to', 'string')], responses: { '200': { description: 'OK' }, ...errorResponses }, 'x-permissions': ['report.read'] },
    },
    '/api/v1/reports/current-stock': {
      get: { tags: ['Reports'], summary: 'Current warehouse stock', security: auth, responses: { '200': { description: 'OK' }, ...errorResponses }, 'x-permissions': ['report.read'] },
    },
    '/api/v1/reports/consignment-stock': {
      get: { tags: ['Reports'], summary: 'Consignment stock by customer', security: auth, responses: { '200': { description: 'OK' }, ...errorResponses }, 'x-permissions': ['report.read'] },
    },
    '/api/v1/reports/collection': {
      get: { tags: ['Reports'], summary: 'Daily collection by payment method', security: auth, parameters: [param('date_from', 'string'), param('date_to', 'string')], responses: { '200': { description: 'OK' }, ...errorResponses }, 'x-permissions': ['report.read'] },
    },
    '/api/v1/reports/ar-aging': {
      get: { tags: ['Reports'], summary: 'AR aging (derived OVERDUE)', security: auth, parameters: [param('customer_id', 'string')], responses: { '200': { description: 'OK' }, ...errorResponses }, 'x-permissions': ['report.read'] },
    },
    '/api/v1/reports/ar-outstanding': {
      get: { tags: ['Reports'], summary: 'Outstanding AR summary by customer', security: auth, responses: { '200': { description: 'OK' }, ...errorResponses }, 'x-permissions': ['report.read'] },
    },
    '/api/v1/reports/best-sellers': {
      get: { tags: ['Reports'], summary: 'Best-selling SKUs', security: auth, parameters: [param('date_from', 'string'), param('date_to', 'string'), param('limit', 'integer')], responses: { '200': { description: 'OK' }, ...errorResponses }, 'x-permissions': ['report.read'] },
    },
    '/api/v1/reports/slow-movers': {
      get: { tags: ['Reports'], summary: 'Slow-moving SKUs', security: auth, parameters: [param('date_from', 'string'), param('date_to', 'string'), param('limit', 'integer')], responses: { '200': { description: 'OK' }, ...errorResponses }, 'x-permissions': ['report.read'] },
    },
    '/api/v1/reports/dead-stock': {
      get: { tags: ['Reports'], summary: 'Dead stock alert (no SALE_CONFIRMED within N days)', security: auth, parameters: [param('days', 'integer', false, 'query', 'default 30')], responses: { '200': { description: 'OK' }, ...errorResponses }, 'x-permissions': ['report.read'] },
    },
    '/api/v1/mobile/me': {
      get: { tags: ['Mobile'], summary: 'Slim profile of the calling user', security: auth, responses: { '200': { description: 'OK' }, ...errorResponses } },
    },
    '/api/v1/mobile/today': {
      get: {
        tags: ['Mobile'],
        summary: "Today's visits for the calling rep, with current consignment stock",
        security: auth,
        responses: { '200': { description: 'OK' }, ...errorResponses },
      },
    },
    '/api/v1/mobile/visits/{id}/sync': {
      post: {
        tags: ['Mobile'],
        summary: 'Batch check-in + record-items in a single call (network-friendly)',
        security: auth,
        parameters: [param('id', 'string', true, 'path')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items'],
                properties: {
                  checkin: {
                    type: 'object',
                    properties: {
                      gps_latitude: { type: 'string' },
                      gps_longitude: { type: 'string' },
                      photo_url: { type: 'string' },
                    },
                  },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['product_id', 'qty_counted'],
                      properties: {
                        product_id: { type: 'string' },
                        qty_counted: { type: 'string' },
                        qty_replenished: { type: 'string' },
                        unit_price: { type: 'string' },
                      },
                    },
                  },
                  note: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'OK' }, ...errorResponses },
      },
    },
    '/api/v1/mobile/uploads/sign': {
      post: {
        tags: ['Mobile'],
        summary: 'Get a (stubbed) presigned PUT URL for visit / product photos',
        security: auth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['filename'],
                properties: {
                  filename: { type: 'string' },
                  content_type: { type: 'string' },
                  purpose: { type: 'string', enum: ['visit_photo', 'product', 'avatar'] },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'OK' }, ...errorResponses },
      },
    },
    '/api/v1/reports/production-planning': {
      get: { tags: ['Reports'], summary: 'Suggested production quantities based on avg daily sales', security: auth, parameters: [param('date_from', 'string'), param('date_to', 'string'), param('lead_time_days', 'integer')], responses: { '200': { description: 'OK' }, ...errorResponses }, 'x-permissions': ['report.read'] },
    },

    '/api/v1/ar/invoices/{id}/pdf': {
      get: { tags: ['AR'], summary: 'Download invoice as PDF', security: auth, parameters: [param('id', 'string', true)], responses: { '200': { description: 'PDF stream', content: { 'application/pdf': {} } }, ...errorResponses }, 'x-permissions': ['ar.read'] },
    },
    '/api/v1/sales-visits/{id}/receipt.pdf': {
      get: { tags: ['Sales Visits'], summary: 'Download visit receipt as PDF', security: auth, parameters: [param('id', 'string', true)], responses: { '200': { description: 'PDF stream', content: { 'application/pdf': {} } }, ...errorResponses }, 'x-permissions': ['visit.read'] },
    },

    '/api/v1/imports/products': {
      post: {
        tags: ['Imports'],
        summary: 'Bulk-upsert products from CSV (text/csv body)',
        security: auth,
        requestBody: {
          required: true,
          content: {
            'text/csv': { schema: { type: 'string' } },
            'application/json': { schema: { type: 'object', properties: { csv: { type: 'string' } } } },
          },
        },
        responses: { '200': { description: 'OK' }, ...errorResponses },
        'x-permissions': ['product.write'],
      },
    },
    '/api/v1/imports/products/sample.csv': {
      get: { tags: ['Imports'], summary: 'Sample CSV template for products', security: auth, responses: { '200': { description: 'CSV', content: { 'text/csv': {} } }, ...errorResponses } },
    },
    '/api/v1/imports/customers': {
      post: {
        tags: ['Imports'],
        summary: 'Bulk-upsert customers from CSV (text/csv body)',
        security: auth,
        requestBody: {
          required: true,
          content: {
            'text/csv': { schema: { type: 'string' } },
            'application/json': { schema: { type: 'object', properties: { csv: { type: 'string' } } } },
          },
        },
        responses: { '200': { description: 'OK' }, ...errorResponses },
        'x-permissions': ['customer.write'],
      },
    },
    '/api/v1/imports/customers/sample.csv': {
      get: { tags: ['Imports'], summary: 'Sample CSV template for customers', security: auth, responses: { '200': { description: 'CSV', content: { 'text/csv': {} } }, ...errorResponses } },
    },

    '/api/v1/notifications/providers': {
      get: { tags: ['Notifications'], summary: 'List configured outbound providers', security: auth, responses: { '200': { description: 'OK' }, ...errorResponses } },
    },
    '/api/v1/notifications/test': {
      post: { tags: ['Notifications'], summary: 'Send a test notification through every provider', security: auth, responses: { '200': { description: 'OK' }, ...errorResponses } },
    },
    '/api/v1/notifications/ar-overdue-scan': {
      post: { tags: ['Notifications'], summary: 'Scan AR invoices past due and dispatch per-customer alerts', security: auth, responses: { '200': { description: 'OK' }, ...errorResponses }, 'x-permissions': ['ar.read'] },
    },

    '/api/v1/audit': {
      get: { tags: ['Audit'], summary: 'Query audit log entries', security: auth, parameters: [param('page', 'integer'), param('pageSize', 'integer'), param('table_name', 'string'), param('record_id', 'string'), param('action_type', 'string'), param('changed_by', 'string'), param('date_from', 'string'), param('date_to', 'string')], responses: { '200': { description: 'OK' }, ...errorResponses }, 'x-permissions': ['user.read'] },
    },

    '/metrics': {
      get: { tags: ['Ops'], summary: 'Prometheus exposition (text/plain)', responses: { '200': { description: 'metrics' } } },
    },
    '/ready': {
      get: { tags: ['Ops'], summary: 'Readiness probe (verifies DB connectivity)', responses: { '200': { description: 'OK' }, '503': { description: 'DB unavailable' } } },
    },
  },
  components: { securitySchemes, schemas },
} as const;
