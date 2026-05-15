import { Router } from 'express';
import { authRouter } from './auth/auth.routes';
import { productCategoryRouter, productRouter } from './products/products.routes';
import {
  customerGroupRouter,
  customerRouter,
} from './customers/customers.routes';
import { warehouseRouter } from './warehouses/warehouses.routes';
import { employeeRouter } from './employees/employees.routes';
import { routeRouter, customerRouteRouter } from './routes/routes.routes';
import { roleRouter, permissionRouter } from './security/security.routes';
import { userRouter } from './users/users.routes';
import { inventoryRouter } from './inventory/inventory.routes';
import { consignmentRouter } from './consignment/consignment.routes';
import { salesVisitRouter } from './sales-visits/sales-visits.routes';
import { collectionRouter } from './collections/collections.routes';
import { arRouter } from './ar/ar.routes';
import { creditRouter } from './credit/credit.routes';
import { reportsRouter } from './reports/reports.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/product-categories', productCategoryRouter);
apiRouter.use('/products', productRouter);
apiRouter.use('/customer-groups', customerGroupRouter);
apiRouter.use('/customers', customerRouter);
apiRouter.use('/warehouses', warehouseRouter);
apiRouter.use('/employees', employeeRouter);
apiRouter.use('/routes', routeRouter);
apiRouter.use('/customer-routes', customerRouteRouter);
apiRouter.use('/roles', roleRouter);
apiRouter.use('/permissions', permissionRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/consignment', consignmentRouter);
apiRouter.use('/sales-visits', salesVisitRouter);
apiRouter.use('/collections', collectionRouter);
apiRouter.use('/ar', arRouter);
apiRouter.use('/credit', creditRouter);
apiRouter.use('/reports', reportsRouter);
