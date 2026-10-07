import API from './axiosInstance';

export const materialApi = {
  // 1. Database එකේ තියෙන ඔක්කොම බඩු ලැයිස්තුව ගන්න
  getAllMaterials: () => API.get('/materials'),

  // 2. අලුතින් Material එකක් Database එකට ඇතුළත් කරන්න
  createMaterial: (materialData) => API.post('/materials', materialData),
};