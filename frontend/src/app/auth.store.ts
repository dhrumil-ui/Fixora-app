import { create } from "zustand";

const API_BASE = (import.meta as any).env?.VITE_API_BASE || "http://localhost:5001";

type Role = "provider" | "customer" | "admin";

type MeUser = {
    _id: string;
    role: Role;
    full_name?: string;
    email?: string;
    provider_status?: string;
    is_profile_complete?: boolean;
    cashback_balance?: number;
    cashback_total_earned?: number;
    cashback_total_spent?: number;
};

type AuthState = {
    me: MeUser | null;
    loadingMe: boolean;
    setMe: (me: MeUser | null) => void;
    clear: () => void;
    refreshMe: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
    me: null,
    loadingMe: true,

    setMe: (me) => set({ me }),
    clear: () => set({ me: null }),

    refreshMe: async () => {
        set({ loadingMe: true });
        try {
            const res = await fetch(`${API_BASE}/api/auth/me`, {
                credentials: "include",
            });
            if (!res.ok) {
                set({ me: null, loadingMe: false });
                return;
            }
            const data = await res.json();
            set({ me: data?.user || null, loadingMe: false });
        } catch {
            set({ me: null, loadingMe: false });
        }
    },
}));