// src/utils/logger.js

import { supabase } from '../config/supabaseClient';

export const logSearch = async (wallet, token_id) => {
  // Obtener la fecha y hora actual en el formato ISO
  const timestamp = new Date().toISOString();

  // Crear el objeto de registro
  const newLog = {
    wallet,
    token_id,
    timestamp
  };

  try {
    // Insertar el registro en la tabla search_logs
    const { data, error } = await supabase
      .from('search_logs')
      .insert([newLog]);

    if (error) {
      throw error;
    }

    console.log('Registro de búsqueda guardado:', data);
  } catch (error) {
    console.error('Error al guardar el registro de búsqueda en Supabase:', error.message);
  }
};
