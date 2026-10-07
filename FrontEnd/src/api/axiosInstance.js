import axios from 'axios';

// Backend server එකේ මූලික URL එක මෙතනින් සෙට් කරනවා
const API = axios.create({
  baseURL: 'http://192.168.1.30:5003/api',
  timeout: 10000, // තත්පර 10ක් ඇතුළත response එකක් ආවේ නැත්නම් cancel වෙනවා
  headers: {
    'Content-Type': 'application/json',
  }
});

export default API;