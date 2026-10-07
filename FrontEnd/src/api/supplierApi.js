import API from './axiosInstance';

export const supplierApi = {
  getAllSuppliers: () => API.get('/suppliers'),
  createSupplier: (supplierData) => API.post('/suppliers', supplierData),
};