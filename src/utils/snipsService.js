// src/utils/snipsService.js
import { supabase } from "../config/supabaseClient";

export async function createSnip(wallet_id, token_id, type, max_price, estado) {
  try {
    const { data, error } = await supabase
      .from("Snips")
      .insert([
        {
          wallet_id,
          token_id,
          type,
          max_price,
          estado,
        },
      ]);

    if (error) {
      throw error;
    }

    console.log("Nuevo Snip creado:", data);
    return data;
  } catch (err) {
    console.error("Error creando Snip:", err);
    return null;
  }
}
