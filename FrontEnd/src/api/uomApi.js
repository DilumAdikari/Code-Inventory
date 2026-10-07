import API from './axiosInstance';

export const uomApi = {
  // Database එකෙන් ඔක්කොම UOMs ටික ඇදලා ගන්න
  getAllUoms: () => API.get('/uoms'),
  
  // අලුතින් UOM එකක් ඇතුළත් කරන්න
  createUom: (uomData) => API.post('/uoms', uomData),
};