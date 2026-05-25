"use client";

import { useQuery } from '@tanstack/react-query';
import { api } from './api';

type Page<T> = { data: T[]; total: number };

export type CustomerOpt = { customer_id: string; customer_code: string; customer_name: string; credit_term_days: number; credit_limit: string };
export type WarehouseOpt = { warehouse_id: string; warehouse_code: string; warehouse_name: string };
export type ProductOpt = { product_id: string; sku_code: string; product_name: string; selling_price: string };
export type EmployeeOpt = { employee_id: string; employee_code: string; employee_name: string };
export type RouteOpt = { route_id: string; route_code: string; route_name: string };
export type CustomerGroupOpt = { group_id: string; group_name: string };
export type ProductCategoryOpt = { category_id: string; category_code: string; category_name: string };
export type RoleOpt = { role_id: string; role_name: string };

export function useCustomers() {
  return useQuery({
    queryKey: ['lookup', 'customers'],
    queryFn: () => api<Page<CustomerOpt>>('/customers?pageSize=200&active=true').then((r) => r.data),
    staleTime: 60_000,
  });
}
export function useWarehouses() {
  return useQuery({
    queryKey: ['lookup', 'warehouses'],
    queryFn: () => api<Page<WarehouseOpt>>('/warehouses?pageSize=200&active=true').then((r) => r.data),
    staleTime: 60_000,
  });
}
export function useProducts() {
  return useQuery({
    queryKey: ['lookup', 'products'],
    queryFn: () => api<Page<ProductOpt>>('/products?pageSize=500&active=true').then((r) => r.data),
    staleTime: 60_000,
  });
}
export function useEmployees() {
  return useQuery({
    queryKey: ['lookup', 'employees'],
    queryFn: () => api<Page<EmployeeOpt>>('/employees?pageSize=200&active=true').then((r) => r.data),
    staleTime: 60_000,
  });
}
export function useRoutes() {
  return useQuery({
    queryKey: ['lookup', 'routes'],
    queryFn: () => api<Page<RouteOpt>>('/routes?pageSize=200&active=true').then((r) => r.data),
    staleTime: 60_000,
  });
}
export function useCustomerGroups() {
  return useQuery({
    queryKey: ['lookup', 'customer-groups'],
    queryFn: () => api<Page<CustomerGroupOpt>>('/customer-groups?pageSize=200').then((r) => r.data),
    staleTime: 60_000,
  });
}
export function useProductCategories() {
  return useQuery({
    queryKey: ['lookup', 'product-categories'],
    queryFn: () => api<Page<ProductCategoryOpt>>('/product-categories?pageSize=200').then((r) => r.data),
    staleTime: 60_000,
  });
}
export function useRoles() {
  return useQuery({
    queryKey: ['lookup', 'roles'],
    queryFn: () => api<Page<RoleOpt>>('/roles?pageSize=200').then((r) => r.data),
    staleTime: 60_000,
  });
}
