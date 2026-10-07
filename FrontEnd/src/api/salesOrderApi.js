import API from './axiosInstance';

export const salesOrderApi = {
  // 1. සියලුම Sales Orders කියවීම (GET)
  getAllOrders: () => API.get('/sales-orders'),
  
  // 2. මූලික Sales Order එකක් සෑදීම (POST)
  createOrder: (orderData) => API.post('/sales-orders', orderData),
  
  // 3. 🌟 ORDER BREAKDOWN GRID එකට ITEM එකක් ADD කිරීම (POST ලෙස නිවැරදි කළා!)
  addItemToOrder: (id, itemData) => API.post(`/sales-orders/${id}/items`, itemData),
  
  // 4. BREAKDOWN GRID එකෙන් ITEM ROW එකක් DELETE කිරීම (DELETE)
  deleteItemFromOrder: (id, itemId) => API.delete(`/sales-orders/${id}/items/${itemId}`),
};