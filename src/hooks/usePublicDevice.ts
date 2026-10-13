import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ResolvedPublicDevice {
  device_id: string;
  branch_id: string | null;
  merchant_key: string;
  device_type: string;
  device_label: string;
}

export const usePublicDevice = (token: string | null | undefined) => {
  return useQuery({
    queryKey: ["public-device", token],
    queryFn: async (): Promise<ResolvedPublicDevice | null> => {
      if (!token) return null;
      const { data, error } = await supabase.rpc("resolve_public_device", {
        _token: token,
      });
      if (error) throw error;
      return (data?.[0] as ResolvedPublicDevice | undefined) ?? null;
    },
    enabled: Boolean(token),
    retry: false,
    staleTime: 15_000,
  });
};
