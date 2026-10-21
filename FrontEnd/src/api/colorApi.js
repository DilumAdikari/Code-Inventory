import API from './axiosInstance';

export const colorApi = {
 
  getAllColors: () => API.get('/colors'),
  
 
  createColor: (colorData) => API.post('/colors', colorData),
};