import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Merchant {
  id: string;
  merchant_id: string;
  name: string;
  phone_number: string;
  logo_url: string | null;
  banner_url: string | null;
  evc_logo_url: string | null;
  edahab_logo_url: string | null;
  premier_logo_url: string | null;
  ussd_base_code: string;
  currency: string;
  is_active: boolean;
}

export interface MerchantPaymentMethod {
  id: string;
  merchant_id: string;
  provider: string;
  label: string;
  phone_number: string;
  ussd_template: string;
  logo_url: string | null;
  is_active: boolean;
  sort_order: number;
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

export const useMerchantPaymentMethods = (merchantDbId: string | null | undefined) => {
  return useQuery({
    queryKey: ['merchant-payment-methods', merchantDbId],
    queryFn: async (): Promise<MerchantPaymentMethod[]> => {
      if (!merchantDbId) return [];

      const { data, error } = await supabase
        .from('merchant_payment_methods')
        .select('*')
        .eq('merchant_id', merchantDbId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching merchant payment methods:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!merchantDbId,
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
