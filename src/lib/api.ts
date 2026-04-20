import { supabase } from './supabase';
import { getTrackingData } from './tracking';

export interface LeadFormData {
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  vin: string;
  km: number;
  drivable: boolean;
  up_to: number;
  postal_code: string;
  slot_type: string;
  selected_slot_id: string;
  selected_slot_datetime: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  client_address: string;
  payment_preference: 'cash' | 'interac';
  terms_accepted: boolean;
  inspection_accepted: boolean;
  marketing_opt_in: boolean;
}

export async function submitLead(formData: LeadFormData): Promise<{ lead_id: string }> {
  const tracking = getTrackingData();

  const payload = {
    ...formData,
    tracking,
    honeypot: '', // Anti-spam field
  };

  const { data, error } = await supabase.functions.invoke('create-lead', {
    body: payload,
  });

  if (error) {
    console.error('Lead submission error:', error);
    throw new Error('Failed to submit lead. Please try again.');
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to submit lead');
  }

  return data.data;
}
