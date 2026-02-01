import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Merchant {
  id: string;
  merchant_id: string;
  name: string;
  phone_number: string;
  logo_url: string | null;
  ussd_base_code: string;
  currency: string;
  is_active: boolean;
}

export const useMerchant = (merchantId: string | null) => {
  return useQuery({
    queryKey: ['merchant', merchantId],
    queryFn: async (): Promise<Merchant | null> => {
      if (!merchantId) return null;
      
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching merchant:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!merchantId,
  });
};

export const useMerchants = () => {
  return useQuery({
    queryKey: ['merchants'],
    queryFn: async (): Promise<Merchant[]> => {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching merchants:', error);
        throw error;
      }
      
      return data || [];
    },
  });
};
