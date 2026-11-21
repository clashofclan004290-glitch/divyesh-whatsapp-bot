const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Get user memory from Supabase
 * @param {string} phone - User's WhatsApp phone number
 * @returns {Promise<object|null>}
 */
async function getUserMemory(phone) {
  try {
    const { data, error } = await supabase
      .from('user_memory')
      .select('*')
      .eq('phone', phone)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, that's okay
      console.error('❌ Supabase getUserMemory error:', error.message);
      return null;
    }
    return data || null;
  } catch (err) {
    console.error('❌ Supabase getUserMemory exception:', err.message);
    return null;
  }
}

/**
 * Upsert user memory into Supabase
 * @param {string} phone - User's WhatsApp phone number
 * @param {object} data - Data to upsert (name, skills, routine, clients, deadlines, facts)
 * @returns {Promise<void>}
 */
async function upsertUserMemory(phone, data) {
  try {
    const payload = {
      phone,
      ...data,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_memory')
      .upsert(payload, { onConflict: 'phone' });

    if (error) {
      console.error('❌ Supabase upsertUserMemory error:', error.message);
    }
  } catch (err) {
    console.error('❌ Supabase upsertUserMemory exception:', err.message);
  }
}

/**
 * Add a new fact to user's memory (from "yaad rakhna" messages)
 * @param {string} phone - User's WhatsApp phone number
 * @param {string} fact - The fact to remember
 * @returns {Promise<void>}
 */
async function addFact(phone, fact) {
  try {
    const existing = await getUserMemory(phone);
    const existingFacts = (existing && existing.facts) ? existing.facts : [];

    // Avoid duplicate facts
    if (!existingFacts.includes(fact)) {
      existingFacts.push(fact);
    }

    await upsertUserMemory(phone, { facts: existingFacts });
    console.log(`✅ Fact saved for ${phone}: "${fact}"`);
  } catch (err) {
    console.error('❌ addFact exception:', err.message);
  }
}

/**
 * Get all users (for sending morning reminders)
 * @returns {Promise<Array>}
 */
async function getAllUsers() {
  try {
    const { data, error } = await supabase
      .from('user_memory')
      .select('phone, name');

    if (error) {
      console.error('❌ Supabase getAllUsers error:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('❌ getAllUsers exception:', err.message);
    return [];
  }
}

module.exports = { getUserMemory, upsertUserMemory, addFact, getAllUsers };
