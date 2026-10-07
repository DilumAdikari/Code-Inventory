import API from './axiosInstance';

export const factoryApi = {
  getAllFactories: () => API.get('/factories'),
  createFactory: (factoryData) => API.post('/factories', factoryData),
};