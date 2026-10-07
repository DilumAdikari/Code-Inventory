import API from './axiosInstance';

export const colorApi = {
  // Database එකේ තියෙන ඔක්කොම පාටවල් ලැයිස්තුව ගන්න
  getAllColors: () => API.get('/colors'),
  
  // අලුතින් පාටක් Database එකට ඇතුළත් කරන්න
  createColor: (colorData) => API.post('/colors', colorData),
};