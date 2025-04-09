// src/config/supabaseClient.js
//import { createClient } from '@supabase/supabase-js';
const { createClient } = require("@supabase/supabase-js");

// Asegúrate de tener estas variables en tu archivo .env
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Crear el cliente de Supabase y exportarlo como una exportación nombrada
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
